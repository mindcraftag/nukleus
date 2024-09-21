"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment                = require('moment');
const { ValidationError }   = require("../exception");
const mongoose              = require('@mindcraftgmbh/nukleus-model').mongoose;
const purchasableService    = require('./purchasableService');
const userService           = require('./userService');
const groupService          = require('./groupService');
const paymentService        = require('./paymentService');
const invoiceService        = require('./invoiceService');
const mailService           = require('./mailService');
const limits                = require('../limits');
const logger                = require('../tools/logger');
const { ensureExactFieldsInArray } = require('../common');
const { parseItemsPerPage } = require('../tools/paging');

exports.getMyPurchases = async function(userId, clientId) {
    const Purchase = mongoose.model('Purchase');
    const purchases = await Purchase.find({ client: clientId, user: userId });
    return purchases;
}

exports.getMyPurchasesPaginated = async function(userId, clientId, itemsPerPageStr, firstObjectID) {
    const Purchase = mongoose.model('Purchase');
    const query = Purchase.find();
    const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

    query.where("client").equals(clientId);
    query.where("user").equals(userId);
    query.sort({ _id: "descending" });

    if (firstObjectID) {
        query.where({_id: {
            $lte: firstObjectID
        }})
    }

    query.limit(itemsPerPage + 1);

    const purchases = await query.exec();

    let nextObjectID = null;
    if (purchases.length >= itemsPerPage + 1) {
        nextObjectID = purchases[itemsPerPage]._id;
        purchases.length = itemsPerPage;
    }

    return {
        purchases: ensureExactFieldsInArray(purchases, [
                    "_id", "purchasable", "option", "active", "paymentHistory", "createdAt", "canceledAt", "paidUntil"
                ]),
        nextObjectID: nextObjectID
    };
}

exports.getPurchasableNetPrice = function(purchasable, option, currency) {
    if (!currency) {
        throw new ValidationError("Currency must be specified.");
    }

    if (purchasable.pricesContainVat) {
        const f = 100 / 107.7;
        const netPrice = option.prices.get(currency.toLowerCase()) * f;
        return Math.round(netPrice * 100) / 100;
    } else {
        return option.prices.get(currency.toLowerCase());
    }
}

exports.createAndPayInvoice = async function(purchasable, option, userId, clientId, paymentSetup, date, additionalPositions) {

    // Create an invoice for the purchase and process payment
    // ----------------------------------------------------------------------------------------
    const netPrice = exports.getPurchasableNetPrice(purchasable, option, paymentSetup.currency);
    additionalPositions = additionalPositions || [];
    const positions = [...additionalPositions, {
        name: `${purchasable.name} (${option.name})`,
        singlePrice: netPrice,
        quantity: 1,
        price: netPrice
    }];

    const invoice = await invoiceService.createInvoice(date, undefined, undefined, userId, clientId, positions, paymentSetup, async function(invoice) {
        const paymentIntent = await paymentService.processInvoicePayment(paymentSetup, invoice);
        
        // During units tests, we use the stripe-mock API. However since this API never returns a payment intent
        // with status "succeeded", we need to modify it here.
        if (process.env.NODE_ENV === "testing") {
            paymentIntent.status = "succeeded";
        }

        return paymentIntent;
    });

    if (!invoice) {
        throw "Invoice could not be created!";
    }

    return invoice;
}

exports.calculateRemainingNetValue = async function(purchase, clientId, currency) {
    const { purchasable, option } = await purchasableService.getPurchasableAndOption(purchase.purchasable, clientId, purchase.option);

    const price = exports.getPurchasableNetPrice(purchasable, option, currency);

    if (!purchase.paidUntil)
        throw new ValidationError("Purchase has no paid until date so cannot calculate remaining value.");

    const totalTime = purchase.paidUntil - purchase.createdAt;
    const runningTime = new Date() - purchase.createdAt;

    const depreciation = Math.floor(price / totalTime * runningTime);
    const remainingValue = price - depreciation;

    return remainingValue;
}

exports.purchase = async function(purchasableId, userId, clientId, optionId) {

    // Verify the user has a payment setup, did not already purchase this item and the purchasable actually exists.
    // ----------------------------------------------------------------------------------------
    const paymentSetup = await userService.getPaymentSetup(userId, clientId);
    if (!paymentSetup || !paymentSetup.paymentMethodId) {
        throw new ValidationError("Cannot purchase without a payment setup.");
    }

    if (await exports.checkUserActivePurchase(purchasableId, userId, clientId)) {
        throw new ValidationError("You already purchased this.");
    }

    const { purchasable, option } = await purchasableService.getPurchasableAndOption(purchasableId, clientId, optionId);

    // In case the purchasable is one of a group, check if the user has an existing active purchase inside this group
    // ----------------------------------------------------------------------------------------
    let cancelGracePeriodUntil = moment().add(limits.PURCHASE_CANCEL_GRACE_PERIOD_MINUTES, 'minute');
    let additionalPositions = [];

    if (purchasable.groupId) {
        const existingPurchase = await exports.getUserPurchaseOfSameGroup(purchasable.groupId, userId, clientId);
        if (existingPurchase) {
            const remainingNetValue = await exports.calculateRemainingNetValue(existingPurchase, clientId, paymentSetup.currency);
            const netOptionPrice = await exports.getPurchasableNetPrice(purchasable, option, paymentSetup.currency);

            if (remainingNetValue > netOptionPrice) {
                throw new ValidationError("Subscriptions can only be upgraded, not downgraded. Existing subscription is still of higher value.");
            }

            existingPurchase.cancellationReason = "upgrade";
            existingPurchase.remainingNetValue = remainingNetValue;
            existingPurchase.paidUntil = new Date();
            existingPurchase.canceledAt = new Date();
            existingPurchase.active = false;

            if (existingPurchase.cancelGracePeriodUntil)
                cancelGracePeriodUntil = existingPurchase.cancelGracePeriodUntil;

            await existingPurchase.save();

            additionalPositions.push({
                name: `Upgrade discount`,
                singlePrice: -remainingNetValue,
                quantity: 1,
                price: -remainingNetValue
            });
        }
    }

    let paidUntil;
    switch(option.interval) {
        case "once":
            // for once payments, paidUntil stays empty
            break;
        case "monthly":
            paidUntil = moment().add(1, 'month').toDate();
            break;
        case "yearly":
            paidUntil = moment().add(1, 'year').toDate();
            break;
        default:
            throw new ValidationError(`Unknown option interval ${option.interval} for purchasable ${purchasable._id}`);
    }

    // Create an invoice for the purchase and process payment
    // ----------------------------------------------------------------------------------------
    const date = new Date();
    const invoice = await exports.createAndPayInvoice(purchasable, option, userId, clientId, paymentSetup, date, additionalPositions);

    // Store the purchase in the location of the user
    const User = mongoose.model('User');
    const user = await User.findOne({_id: userId}).select("location").exec();

    // Create the purchase
    // ----------------------------------------------------------------------------------------
    const Purchase = mongoose.model('Purchase');
    const purchase = new Purchase({
        purchasable: purchasable._id,
        user: userId,
        client: clientId,
        option: optionId,
        location: user.location,
        active: true,
        paidUntil: paidUntil,
        cancelGracePeriodUntil: cancelGracePeriodUntil,
        paymentHistory: [{
            date: date,
            invoice: invoice
        }]
    });

    await purchase.save();

    // Execute activation actions
    // ----------------------------------------------------------------------------------------
    await exports.executeActions(purchasable.activationActions, userId, clientId);

    // Create admin mail
    // -----------------------------------------------------------------------------
    try {
        const Client = mongoose.model('Client');
        const client = await Client.findOne({_id: clientId}).select("name").exec();

        const User = mongoose.model('User');
        const user = await User.findOne({_id: userId}).select("account").exec();

        await mailService.createNewPaymentProcessedMail(client.name, user.account, invoice.totalAmount/100, purchasable.name, client._id);
    }
    catch(err) {
        logger.error(err);
    }

    return purchase;
}

exports.extendSubscription = async function(purchaseId) {

    // Retrieve the purchase
    // -----------------------------------------------------------------------------
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({ _id: purchaseId, active: true });

    if (!purchase) {
        throw new ValidationError("Purchase was not found: " + purchaseId);
    }

    // Verify the user has a payment setup
    // ----------------------------------------------------------------------------------------
    const paymentSetup = await userService.getPaymentSetup(purchase.user, purchase.client);
    if (!paymentSetup || !paymentSetup.paymentMethodId) {
        throw new ValidationError("Cannot purchase without a payment setup.");
    }

    // Retrieve the purchasable and its option
    // -----------------------------------------------------------------------------
    const { purchasable, option } = await purchasableService.getPurchasableAndOption(purchase.purchasable, purchase.client, purchase.option);

    // Calculate a new paid until date
    // -----------------------------------------------------------------------------
    let paidUntil;
    switch(option.interval) {
        case "once":
            throw new ValidationError("Purchase is not a subscription but a pay-once purchase.");
        case "monthly":
            paidUntil = moment(purchase.paidUntil).add(1, 'month').toDate();
            break;
        case "yearly":
            paidUntil = moment(purchase.paidUntil).add(1, 'year').toDate();
            break;
        default:
            throw new ValidationError(`Unknown option interval ${option.interval} for purchasable ${purchasable._id}`);
    }

    // Create an invoice for the purchase and process payment
    // ----------------------------------------------------------------------------------------
    const date = new Date();
    let invoice;

    try {
        invoice = await exports.createAndPayInvoice(purchasable, option, purchase.user, purchase.client, paymentSetup, date);
    }
    catch(err) {
        // invoice creation or payment failed!
        const cardInfo = paymentSetup.cardInfo;
        const card = `${cardInfo.brand}/${cardInfo.last4}`;
        await mailService.createExtendingSubscriptionFailedMail(paymentSetup.address.email, card, purchasable.name, purchase.client);
        return;
    }

    // Change the purchase and save
    // -----------------------------------------------------------------------------
    purchase.paidUntil = paidUntil;
    purchase.paymentHistory.push({
        date: date,
        invoice: invoice
    });
    await purchase.save();

    // Create admin mail
    // -----------------------------------------------------------------------------
    try {
        const Client = mongoose.model('Client');
        const client = await Client.findOne({_id: purchase.client}).select("name").exec();

        const User = mongoose.model('User');
        const user = await User.findOne({_id: purchase.user}).select("account").exec();

        await mailService.createNewPaymentProcessedMail(client.name, user.account, invoice.totalAmount/100, purchasable.name, client._id);
    }
    catch(err) {
        logger.error(err);
    }
}

exports.checkUserActivePurchase = async function(purchasableId, userId, clientId)  {
    const purchase = await exports.getPurchaseByPurchasableId(purchasableId, userId, clientId);
    return !!purchase;
}

exports.getUserPurchaseOfSameGroup = async function(groupId, userId, clientId) {
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({ groupId: groupId, client: clientId, user: userId, active: true });
    return purchase;
}

exports.getPurchaseByPurchasableId = async function(purchasableId, userId, clientId)  {
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({ purchasable: purchasableId, client: clientId, user: userId, active: true });
    return purchase;
}

exports.getPurchase = async function(purchaseId, userId, clientId)  {
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({ _id: purchaseId, client: clientId, user: userId, active: true });
    return purchase;
}

exports.deactivatePurchase = async function(purchaseId) {

    // Retrieve the purchase
    // -----------------------------------------------------------------------------
    const Purchase = mongoose.model('Purchase');
    const purchase = await Purchase.findOne({ _id: purchaseId, active: true });

    if (!purchase) {
        throw new ValidationError("Purchase was not found: " + purchaseId);
    }

    if (!purchase.canceledAt) {
        throw new ValidationError("Purchase was not canceled and thus cannot be deactivated: " + purchaseId);
    }

    // Get the purchasable
    // -----------------------------------------------------------------------------
    const purchasable = await purchasableService.getPurchasable(purchase.purchasable, purchase.client);
    if (!purchasable) {
        throw new ValidationError("Purchasable does not exist.");
    }

    // Deactivate any privileges that the user got from this purchase
    // -----------------------------------------------------------------------------
    await exports.executeActions(purchasable.deactivationActions, purchase.user, purchase.client);

    // Deactivate the purchase
    // -----------------------------------------------------------------------------
    purchase.active = false;
    await purchase.save();
}

exports.cancelPurchase = async function(purchaseId, userId, clientId) {
    const purchase = await exports.getPurchase(purchaseId, userId, clientId);

    if (!purchase) {
        throw new ValidationError("Purchase not found.");
    }

    if (purchase.canceledAt) {
        throw new ValidationError("Purchase is already canceled.");
    }

    const purchasable = await purchasableService.getPurchasable(purchase.purchasable, clientId);
    if (!purchasable) {
        throw new ValidationError("Purchasable does not exist.");
    }

    let option;
    for (const opt of purchasable.options) {
        if (opt._id.equals(purchase.option)) {
            option = opt;
            break;
        }
    }

    if (!option) {
        throw new ValidationError("Option does not exist.");
    }

    if (purchase.cancelGracePeriodUntil && moment().isBefore(purchase.cancelGracePeriodUntil)) {

        if (purchase.paymentHistory && purchase.paymentHistory.length > 0) {

            // Get the last invoice from the payment history and then refund it
            // ----------------------------------------------------------------
            const lastPayment = purchase.paymentHistory[purchase.paymentHistory.length-1];
            const invoiceId = lastPayment.invoice;

            const Invoice = mongoose.model('Invoice');
            const invoice = await Invoice.findOne({ _id: invoiceId }).exec();

            if (!invoice) {
                throw new ValidationError("Invoice not found for the refund.");
            }

            const refund = await paymentService.processRefund(invoice, undefined);
            if (refund.status === "succeeded") {
                invoice.refundedAt = new Date();
                await invoice.save();
            } else {
                logger.error("Refund failed: " + JSON.stringify(refund));
                throw new ValidationError("Refund failed");
            }
        }

        purchase.canceledAt = new Date();
        purchase.paidUntil = new Date();
        purchase.active = false;
        purchase.cancellationReason = "user";
        purchase.remainingNetValue = 0;

        await purchase.save();

        await exports.executeActions(purchasable.deactivationActions, userId, clientId);
    }
    else if (option.interval !== "once") {
        purchase.canceledAt = new Date();
        await purchase.save();
    } else {
      throw new ValidationError("Purchase cannot be canceled. It is not a subscription.")
    }
}

exports.executeActions = async function(actions, userId, clientId) {
    if (!actions)
        return;

    if (!Array.isArray(actions))
        return;

    const result = await userService.getUser(userId, clientId);
    if (!result) {
        logger.error("User not found for executing actions");
    }

    const { user, membership } = result;
    let changes = false;

    for (const action of actions) {
        switch(action.type) {
            case "set_user_quota_gb": {
                const quotaAmountGb = action.params;
                if (typeof quotaAmountGb !== 'number') {
                    logger.error(`Parameter for set_user_quota_gb must be a number!`);
                }

                membership.storageQuotaGb = quotaAmountGb;
                changes = true;
                break;
            }

            case "assign_permission": {
                const permissionName = action.params;
                if (typeof permissionName !== 'string') {
                    logger.error(`Parameter for assign_permission must be a string!`);
                }

                if (!membership.permissions.includes(permissionName)) {
                    membership.permissions.push(permissionName);
                    changes = true;
                }

                break;
            }

            case "revoke_permission": {
                const permissionName = action.params;
                if (typeof permissionName !== 'string') {
                    logger.error(`Parameter for assign_permission must be a string!`);
                }

                if (membership.permissions.removeObject(permissionName))
                    changes = true;

                break;
            }

            case "add_to_group": {
                const groupName = action.params;
                if (typeof groupName !== 'string') {
                    logger.error(`Parameter for add_to_group must be a string!`);
                }

                const group = await groupService.getGroupByName(groupName, clientId);
                if (group) {
                    let found = false;
                    for (const existingGroup of membership.groups) {
                        if (existingGroup.equals(group._id)) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        membership.groups.push(group._id);
                        changes = true;
                    }
                } else {
                    logger.error("Group for purchase action could not be found: " + groupName);
                }

                break;
            }

            case "remove_from_group": {
                const groupName = action.params;
                if (typeof groupName !== 'string') {
                    logger.error(`Parameter for remove_from_group must be a string!`);
                }

                const group = await groupService.getGroupByName(groupName, clientId);
                if (group) {
                    let index = 0;
                    for (const existingGroup of membership.groups) {
                        if (existingGroup.equals(group._id)) {
                            membership.groups.splice(index, 1);
                            changes = true;
                            break;
                        }
                        index++;
                    }
                } else {
                    logger.error("Group for purchase action could not be found: " + groupName);
                }
                break;
            }

            default:
                logger.error(`Could not execute action for purchase. Type is unknown: ${action.type}`);
        }
    }

    if (changes)
        await user.save();
}

// Query all purchases by user (email), invoice number and creation date.
// The cursor is the cursor returned from the previous query.
// The limit can specify how many purchases should be returned.
exports.queryAllPurchases = async function(startDate, endDate, email, invoice, client, cursor, requestedLimit) {
    // The cursor contains the time of the last purchase. It will be used to determine where to start the next query.
    // The time is used because the purchases are always sorted by time.

    // This query is quite expensive, which is why such a low limit is set.
    const maxLimit = 50;

    const Purchase = mongoose.model('Purchase');
    const aggregate = Purchase.aggregate();

    // Lookup the fields client, purchasable, user and invoice in the paymentHistory.
    aggregate.lookup({
        localField: "client",
        from: "clients",
        as: "client",
        foreignField: "_id"
    });

    aggregate.lookup({
        localField: "purchasable",
        from: "purchasables",
        as: "purchasable",
        foreignField: "_id"
    });

    // Note: this step will output the invoices in a new "invoices" field.
    aggregate.lookup({
        localField: "paymentHistory.invoice",
        from: "invoices",
        as: "invoices",
        foreignField: "_id"
    });

    aggregate.lookup({
        localField: "user",
        from: "users",
        as: "user",
        foreignField: "_id"
    });

    // Unwind the arrays that are created by using lookup. Since all of those arrays
    // will only contain a single object, this won't result in duplicate entries.
    aggregate.unwind({
        path: "$user"
    });

    aggregate.unwind({
        path: "$client"
    });

    aggregate.unwind({
        path: "$purchasable"
    });

    // If a startDate was specified, all purchases need to have been
    // created on or after that date.
    if (startDate) {
        aggregate.match({
            createdAt: {
                $gte: startDate
            }
        });
    }

    // If an endDate was specified, all purchases need to have been
    // created on or before that date.
    if (endDate) {
        aggregate.match({
            createdAt: {
                $lte: endDate
            }
        });
    }

    // If an invoice number was specified, the aggregate pipeline should
    // only match purchases that have an invoice with that number.
    if (invoice && invoice.length) {
        aggregate.match({
            "invoices.number": parseInt(invoice)
        });
    }

    // If an email was specified, the user associated with the purchase
    // needs to have that email.
    if (email && email.length) {
        aggregate.match({
            "user.account": email
        });
    }

    // If a client was specified, the purchase needs to be associated with
    // that client.
    if (client) {
        aggregate.match({
            "client._id": client
        });
    }

    // If a cursor was specified, the aggregate pipeline should only match
    // purchases that were created after the cursor.
    if (cursor) {
        const time = Buffer.from(cursor, 'base64');
        aggregate.match({
            createdAt: {
                $lt: new Date(time)
            }
        });
    }

    let limit = maxLimit;
    if (typeof requestedLimit === "number") {
        if (requestedLimit < maxLimit) {
            limit = requestedLimit;
        } else if (requestedLimit < 1) {
            limit = 1;
        }
    }

    aggregate.limit(limit);

    // Return the most recent purchases at the beginning.
    aggregate.sort({
        createdAt: "descending"
    });

    // Replace the properties user, client and purchasable with only the data that we need.
    const data = (await aggregate.exec()).map(purchase => ({
        ...purchase,
        user: {
            account: purchase.user.account,
            name: purchase.user.name
        },
        client: {
            name: purchase.client.name
        },
        purchasable: {
            name: purchase.purchasable.name,
            options: purchase.purchasable.options
        }
    }));

    return {
        data: data,
        // Set the createdAt time of the last purchase as the cursor for the next query.
        // If this query did not return exactly as many items as was requested, it means
        // that there is no more data, so we return null as the cursor.
        nextCursor: data.length === limit ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64') : null
    };
}
