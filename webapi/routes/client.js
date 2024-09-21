"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express       = require('express');
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();
const ValidationError   = nsvc.exception.ValidationError;

module.exports = {
    path: "/api/client",
    router: router,
    permissions: [
        { name: 'client_admin', group: 'client', description: 'Administrate clients' }
    ]
};

// ############################################################################################################
// Get list of all clients
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let nextItem = null;

            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            const data = await nsvc.clientService.getClientsPaginated(req.query.pageSize, nextItem);
            res.json({
                result: "success",
                data: data.clients,
                next: data.nextObjectID
            });
        });
    })

// ############################################################################################################
// Create client
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const name = nsvc.verify.string(req, "name");
            const email = nsvc.verify.emailAddress(req, "email");

            const client = await nsvc.clientService.createClient(name, email, false);

            if (client === false) {
                res.json({
                    result: "failed",
                    error: "Client with that name already exists"
                });
            } else {
                res.status(201).json({
                    result: "success",
                    data: client._id
                });
            }
        });
    })

// ############################################################################################################
// Modify client
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, "name");
            const publicDownloadAllowed = nsvc.verify.boolean(req, "publicDownloadAllowed");
            const publicQueryAllowed = nsvc.verify.optionalBoolean(req, "publicQueryAllowed", null);
            const publicConversations = nsvc.verify.optionalBoolean(req, "publicConversations", null);
            const publicLikes = nsvc.verify.optionalBoolean(req, "publicLikes", null);
            const publicCategories = nsvc.verify.optionalBoolean(req, "publicCategories", null);
            const publicLicenses = nsvc.verify.optionalBoolean(req, "publicLicenses", null);
            const publicUserInfo = nsvc.verify.optionalBoolean(req, "publicUserInfo", null);
            const jobtypesEnabled = nsvc.verify.stringArray(req, "jobtypesEnabled");
            const datatypesEnabled = nsvc.verify.stringArray(req, "datatypesEnabled");
            const featuresEnabled = nsvc.verify.stringArray(req, "featuresEnabled");
            const jobtypesEnabledForAll = nsvc.verify.optionalStringArray(req, "jobtypesEnabledForAll");
            const datatypesEnabledForAll = nsvc.verify.optionalStringArray(req, "datatypesEnabledForAll");
            const featuresEnabledForAll = nsvc.verify.optionalStringArray(req, "featuresEnabledForAll");
            const pluginsEnabled = nsvc.verify.stringArray(req, "pluginsEnabled");
            const enabledUserAndGroupFeatures = nsvc.verify.optionalBoolean(req, "enabledUserAndGroupFeatures", null);
            const enabledUserAndGroupDatatypes = nsvc.verify.optionalBoolean(req, "enabledUserAndGroupDatatypes", null);
            const enabledUserAndGroupJobtypes = nsvc.verify.optionalBoolean(req, "enabledUserAndGroupJobtypes", null);
            const invitationTokenEnabled = nsvc.verify.boolean(req, "invitationTokenEnabled");
            const defaultUserStorageQuotaGb = nsvc.verify.optionalIntegerNumber(req, "defaultUserStorageQuotaGb");
            const defaultGroupStorageQuotaGb = nsvc.verify.optionalIntegerNumber(req, "defaultGroupStorageQuotaGb");
            const defaultUserTrafficQuotaGb = nsvc.verify.optionalIntegerNumber(req, "defaultUserTrafficQuotaGb");
            const defaultGroupTrafficQuotaGb = nsvc.verify.optionalIntegerNumber(req, "defaultGroupTrafficQuotaGb");
            const conversationMode = nsvc.verify.optionalIntegerNumberRange(req, "conversationMode", 0, 2, null);
            const storages = nsvc.verify.stringArray(req, "storages");
            const nextPlan = nsvc.verify.optionalObjectId(req, "nextPlan");
            const vatNo = nsvc.verify.optionalString(req, "paymentSetup.vatNo");
            const addressName = nsvc.verify.optionalString(req, "paymentSetup.address.name");
            const email = nsvc.verify.emailAddress(req, "paymentSetup.address.email");
            const street = nsvc.verify.optionalString(req, "paymentSetup.address.street");
            const zipcode = nsvc.verify.optionalString(req, "paymentSetup.address.zipcode");
            const city = nsvc.verify.optionalString(req, "paymentSetup.address.city");
            const country = nsvc.verify.optionalString(req, "paymentSetup.address.country");
            const mailerName = nsvc.verify.optionalString(req, "mailerName");
            const mailerAddress = nsvc.verify.optionalEmailAddress(req, "mailerAddress");
            const draftMode = nsvc.verify.optionalString(req, "draftMode");
            const draftGracePeriodDays = nsvc.verify.optionalIntegerNumber(req, "draftGracePeriodDays");

            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: id, deletedAt: null }).populate('paymentSetup').exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "Client not found"
                });
            }
            else {
                // Check for existence of other client with that name
                // -----------------------------------------------------
                if (client.name !== name && await nsvc.clientService.isNameConflict(name)) {
                    res.json({
                        result: "failed",
                        error: "Client with that name already exists"
                    });
                    return;
                }

                // Modify client
                // -----------------------------------------------------
                if (!client.address)
                    client.address = {};

                if (conversationMode !== null)
                    client.conversationMode = conversationMode;

                if (publicQueryAllowed !== null)
                    client.publicQueryAllowed = publicQueryAllowed;

                if (publicConversations !== null)
                    client.publicConversations = publicConversations;

                if (publicLikes !== null)
                    client.publicLikes = publicLikes;

                if (publicCategories !== null)
                    client.publicCategories = publicCategories;

                if (publicLicenses !== null)
                    client.publicLicenses = publicLicenses;

                if (publicUserInfo !== null)
                    client.publicUserInfo = publicUserInfo;

                if (defaultUserStorageQuotaGb !== undefined)
                    client.defaultUserStorageQuotaGb = defaultUserStorageQuotaGb;

                if (defaultGroupStorageQuotaGb !== undefined)
                    client.defaultGroupStorageQuotaGb = defaultGroupStorageQuotaGb;

                if (defaultUserTrafficQuotaGb !== undefined)
                    client.defaultUserTrafficQuotaGb = defaultUserTrafficQuotaGb;

                if (defaultGroupTrafficQuotaGb !== undefined)
                    client.defaultGroupTrafficQuotaGb = defaultGroupTrafficQuotaGb;

                if (enabledUserAndGroupFeatures !== null)
                    client.enabledUserAndGroupFeatures = enabledUserAndGroupFeatures;

                if (enabledUserAndGroupJobtypes !== null)
                    client.enabledUserAndGroupJobtypes = enabledUserAndGroupJobtypes;

                if (enabledUserAndGroupDatatypes !== null)
                    client.enabledUserAndGroupDatatypes = enabledUserAndGroupDatatypes;

                if (jobtypesEnabledForAll !== null)
                    client.jobtypesEnabledForAll = jobtypesEnabledForAll;

                if (datatypesEnabledForAll !== null)
                    client.datatypesEnabledForAll = datatypesEnabledForAll;

                if (featuresEnabledForAll !== null)
                    client.featuresEnabledForAll = featuresEnabledForAll;

                if (mailerName !== undefined)
                    client.mailerName = mailerName;

                if (mailerAddress !== undefined)
                    client.mailerAddress = mailerAddress;
                
                if (draftGracePeriodDays !== undefined) {
                    if (draftGracePeriodDays < 0) {
                        throw new ValidationError("Draft grace period must be a positive number of days.");
                    }

                    client.draftGracePeriodDays = draftGracePeriodDays;
                }

                if (draftMode !== undefined) {
                    const validDraftModes = Object.keys(nsvc.model.DraftMode)
                    if (!validDraftModes.includes(draftMode)) {
                        throw new ValidationError(`Draft mode must be one of: ${validDraftModes.join(", ")}.`);
                    }
                    client.draftMode = draftMode;
                }

                client.name = name;
                client.publicDownloadAllowed = publicDownloadAllowed;
                client.jobtypesEnabled = jobtypesEnabled;
                client.datatypesEnabled = datatypesEnabled;
                client.featuresEnabled = featuresEnabled;
                client.pluginsEnabled = pluginsEnabled;
                client.storages = storages;

                if (vatNo !== undefined)
                    client.paymentSetup.vatNo = vatNo;

                if (addressName !== undefined)
                    client.paymentSetup.address.name = addressName;

                if (email !== undefined)
                    client.paymentSetup.address.email = email;

                if (street !== undefined)
                    client.paymentSetup.address.street = street;

                if (zipcode !== undefined)
                    client.paymentSetup.address.zipcode = zipcode;

                if (city !== undefined)
                    client.paymentSetup.address.city = city;

                if (country !== undefined)
                    client.paymentSetup.address.country = country;

                if (nextPlan && nextPlan !== client.currentPlan) {
                    const Plan = mongoose.model("Plan");
                    const plan = await Plan.findById(nextPlan);

                    if (!plan) {
                        res.json({
                            result: "failed",
                            error: "Plan does not exist"
                        });
                        return;
                    }

                    client.nextPlan = nextPlan;
                }

                if (invitationTokenEnabled && !client.invitationTokenEnabled) {
                    client.invitationTokenEnabled = true;
                    client.invitationToken = await nsvc.security.createRandomPassword();
                } else if (!invitationTokenEnabled && client.invitationTokenEnabled) {
                    client.invitationTokenEnabled = false;
                    client.invitationToken = undefined;
                }

                // update ACLs
                // -----------------------------------------------------------------
                if (req.body.acl) {
                    client.acl = [];

                    for (const acl of req.body.acl) {
                        client.acl.push({
                            user: nsvc.verify.toObjectIdOrNull(acl.user),
                            group: acl.user ? null : nsvc.verify.toObjectIdOrNull(acl.group),
                            can: nsvc.aclTools.filterCanEntries(acl.can)
                        });
                    }
                }

                if (req.body.userPropertiesTemplate) {
                    const isValid = nsvc.clientService.isValidClientTemplate(req.body.userPropertiesTemplate)

                    if (!isValid) {
                        res.json({
                            result: "failed",
                            error: "Invalid user properties template"
                        });
                        return;
                    }

                    client.userPropertiesTemplate = req.body.userPropertiesTemplate;
                } else {
                    client.userPropertiesTemplate = {};
                }

                await client.paymentSetup.save();
                await client.save();

                res.json({
                    result: "success"
                });
            }
        });
    })

// ############################################################################################################
// Delete client
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

            const Client = mongoose.model('Client');
            await Client.updateMany({ _id: idArray, deletedAt: null }, { deletedAt: new Date() }).exec();

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get my client
// ############################################################################################################
router.route('/my')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const isAdmin = req.user.activeMembership.admin;
            if (!isAdmin) {
                res.json({
                    result: "failed",
                    error: "permission denied"
                });
                return;
            }

            const Client = mongoose.model('Client');
            const ClientMetrics = mongoose.model('ClientMetrics');
            const client = await Client.findOne( { _id: req.user.client, deletedAt: null }).populate("paymentSetup").exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "client not found"
                });
                return;
            }
            
            const metricsData = await ClientMetrics.findOne({ client: client._id }).exec();
            if (!metricsData) {
                res.json({
                    result: "failed",
                    error: "client metrics not found"
                });
                return;

            } else {
                // payment info should never go out to the client. Instead make sure, the payment info
                // is replaced by just the info, if a payment method is registered or not.
                const paymentSetup = client.paymentSetup;
                const cardInfo = paymentSetup.cardInfo;
                const customerIdPresent = !!paymentSetup.customerId;
                const paymentMethodIdPresent = !!paymentSetup.paymentMethodId;
                const paymentIsSetup = customerIdPresent && paymentMethodIdPresent;
                const paymentCard = cardInfo ? `${cardInfo.brand || "SEPA Debit"} (...${cardInfo.last4})` : null;

                const metrics = metricsData.metrics;
                const refMetrics = metricsData.refMetrics || { trafficCount: 0, trafficBytes: 0 };
                const trafficCount = metrics.uploadCount + metrics.secureDownloadCount + metrics.publicDownloadCount;
                const trafficBytes = metrics.uploadBytes + metrics.secureDownloadBytes + metrics.publicDownloadBytes;
                const trafficMonthCount = trafficCount - refMetrics.trafficCount;
                const trafficMonthBytes = trafficBytes - refMetrics.trafficBytes;

                res.json({
                    result: "success",
                    data: {
                        _id: client._id,
                        name: client.name,
                        address: {
                            name: paymentSetup.address.name,
                            email: paymentSetup.address.email,
                            emailToConfirm: paymentSetup.address.emailToConfirm,
                            confirmEmailDate: paymentSetup.address.confirmEmailDate,
                            street: paymentSetup.address.street,
                            zipcode: paymentSetup.address.zipcode,
                            city: paymentSetup.address.city,
                            country: paymentSetup.address.country
                        },
                        metrics: {
                            storedCount: metricsData.metrics.storedCount,
                            storedBytes: metricsData.metrics.storedBytes,
                            trafficCount: trafficCount,
                            trafficBytes: trafficBytes,
                            trafficMonthCount: trafficMonthCount,
                            trafficMonthBytes: trafficMonthBytes
                        },
                        draftMode: client.draftMode,
                        draftGracePeriodDays: client.draftGracePeriodDays,
                        paymentIsSetup: paymentIsSetup,
                        paymentCard: paymentCard,
                        acl: client.acl,
                        currentPlan: client.currentPlan,
                        nextPlan: client.nextPlan ? client.nextPlan : null,
                        vatNo: paymentSetup.vatNo,
                        enabledClientJobTypes: client.featuresEnabled.includes("custom_jobagents") ? await nsvc.jobService.getEnabledClientJobTypes(client._id) : undefined,
                        features: client.featuresEnabled,
                        userPropertiesTemplate: client.userPropertiesTemplate || {},
                    }
                });
            }
        });
    })

// ############################################################################################################
// Modify my client
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const isAdmin = req.user.activeMembership.admin;
            if (!isAdmin) {
                res.json({
                    result: "failed",
                    error: "permission denied"
                });
            }

            const name = nsvc.verify.string(req, "name");
            const nextPlan = nsvc.verify.optionalObjectId(req, "nextPlan");
            const vatNo = nsvc.verify.optionalString(req, "vatNo");
            const enabledClientJobTypes = nsvc.verify.optionalStringArray(req, "enabledClientJobTypes");
            const email = nsvc.verify.optionalEmailAddress(req, "address.email");
            const addressName = nsvc.verify.optionalString(req, "address.name");
            const street = nsvc.verify.optionalString(req, "address.street");
            const zipcode = nsvc.verify.optionalString(req, "address.zipcode");
            const city = nsvc.verify.optionalString(req, "address.city");
            const country = nsvc.verify.optionalString(req, "address.country");

            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: req.user.client, deletedAt: null }).populate("paymentSetup").exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "Client not found"
                });
            }
            else {
                // Check for existence of other client with that name
                // -----------------------------------------------------
                if (client.name !== name && await nsvc.clientService.isNameConflict(name)) {
                    res.json({
                        result: "failed",
                        error: "Client with that name already exists"
                    });
                    return;
                }

                // Modify client
                // -----------------------------------------------------
                if (!client.address)
                    client.address = {};
                
                if (req.body.userPropertiesTemplate) {
                    const isValid = nsvc.clientService.isValidClientTemplate(req.body.userPropertiesTemplate)

                    if (!isValid) {
                        res.json({
                            result: "failed",
                            error: "Invalid user properties template"
                        });
                        return;
                    }

                    client.userPropertiesTemplate = req.body.userPropertiesTemplate;
                } else {
                    client.userPropertiesTemplate = {};
                }

                client.name = name;
                client.vatNo = vatNo;
                client.paymentSetup.address.name = addressName;
                client.paymentSetup.address.street = street;
                client.paymentSetup.address.zipcode = zipcode;
                client.paymentSetup.address.city = city;
                client.paymentSetup.address.country = country;

                if (client.paymentSetup.address.email !== email) {
                    client.paymentSetup.address.emailToConfirm = email;
                    client.paymentSetup.address.confirmEmailDate = new Date();
                    client.paymentSetup.address.confirmEmailToken = await nsvc.security.createRandomPassword(16, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
                    await nsvc.mailService.createEmailChangedConfirmationMail(client.paymentSetup.address.emailToConfirm, client.paymentSetup.address.confirmEmailToken);
                }

                if (nextPlan && nextPlan.toString() !== client.currentPlan.toString()) {
                    const Plan = mongoose.model("Plan");
                    const plan = await Plan.findById(nextPlan);

                    if (!plan || (!plan.visible && !req.user.superadmin)) {
                        res.json({
                            result: "failed",
                            error: "Plan does not exist"
                        });
                        return;
                    }

                    client.nextPlan = nextPlan;
                }

                if (nextPlan && nextPlan.toString() === client.currentPlan.toString()) {
                    client.nextPlan = undefined;
                }

                if (enabledClientJobTypes) {
                    if (client.featuresEnabled.includes("custom_jobagents")) {
                        await nsvc.jobService.setEnabledClientJobTypes(client, enabledClientJobTypes);
                    } else {
                        throw new ValidationError("Custom job agents are not enabled for your client");
                    }
                }

                // update ACLs
                // -----------------------------------------------------------------
                if (req.body.acl) {
                    client.acl = [];

                    for (const acl of req.body.acl) {
                        client.acl.push({
                            user: nsvc.verify.toObjectIdOrNull(acl.user),
                            group: acl.user ? null : nsvc.verify.toObjectIdOrNull(acl.group),
                            can: nsvc.aclTools.filterCanEntries(acl.can)
                        });
                    }
                }

                await client.paymentSetup.save();
                await client.save();

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Get categories for client
// ############################################################################################################
router.route('/publiccategories/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            // First check if client exists and its categories are publicly available
            // -----------------------------------------------------------------------
            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: id, deletedAt: { $exists: false }}).select("publicCategories").exec();

            if (!client || !client.publicCategories) {
                res.status(404).json({
                    result: "failed",
                    error: "Client not found or categories not public"
                });
                return;
            }

            // Now get the categories
            // -----------------------------------------------------------------------
            const Category = mongoose.model('Category');
            const categories = await Category.find( { client: id, deletedAt: null }).exec();

            if (!categories) {
                res.json({
                    result: "failed",
                    error: "categories not found"
                });
            }
            else {
                const fields = [
                    "_id", "name"
                ];

                const mappedCategories = categories.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, fields);
                });

                res.json({
                    result: "success",
                    data: mappedCategories
                });
            }
        });
    });

// ############################################################################################################
// Get categories
// ############################################################################################################
router.route('/categories')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const Category = mongoose.model('Category');
            const categories = await Category.find( { client: req.user.client, deletedAt: null }).exec();

            if (!categories) {
                res.json({
                    result: "failed",
                    error: "categories not found"
                });
            }
            else {
                const fields = [
                    "_id", "name"
                ];

                const mappedCategories = categories.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, fields);
                });

                res.json({
                    result: "success",
                    data: mappedCategories
                });
            }
        });
    })

// ############################################################################################################
// Get categories for client
// ############################################################################################################
router.route('/categories/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            const Category = mongoose.model('Category');
            const categories = await Category.find( { client: id, deletedAt: null }).exec();

            if (!categories) {
                res.json({
                    result: "failed",
                    error: "categories not found"
                });
            }
            else {
                const fields = [
                    "_id", "name"
                ];

                const mappedCategories = categories.map(function(obj) {
                    return nsvc.common.ensureExactFieldsInObject(obj, fields);
                });

                res.json({
                    result: "success",
                    data: mappedCategories
                });
            }
        });
    })

// ############################################################################################################
// Update categories for client
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!Array.isArray(req.body)) {
                res.json({
                    result: "failed",
                    error: "body needs to contain categories array"
                });
                return;
            }

            // Verify and build a list of all contained object IDs
            // ----------------------------------------------------------------
            const catIds = [];
            for (const category of req.body) {
                if (!category.name) {
                    res.json({
                        result: "failed",
                        error: "categories need to have at least a name property."
                    });
                    return;
                }

                if (category._id) {
                    category._id = nsvc.verify.toObjectId(category._id);
                    catIds.push(category._id);
                }
            }

            // Get a list of all existing categories
            // ----------------------------------------------------------------
            const id = nsvc.verify.toObjectId(req.params.id);

            const Category = mongoose.model('Category');
            const existingCategories = await Category.find( { client: id, deletedAt: null }).select("_id").exec();

            // Remove all deleted categories
            // ----------------------------------------------------------------
            const promises = [];
            for (const existingCategory of existingCategories) {
                let found = false;
                for (const catId of catIds) {
                    if (catId.equals(existingCategory._id)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    promises.push(Category.deleteOne({ _id: existingCategory._id }));
                }
            }

            // Write all changes and additions
            // ----------------------------------------------------------------
            for (const category of req.body) {
                if (!category._id) {
                    const cat = new Category();
                    cat.name = category.name;
                    cat.client = id;
                    promises.push(cat.save());
                } else {
                    promises.push(Category.updateMany({
                        _id: category._id,
                        client: id,
                        deletedAt: null
                    }, {
                        name: category.name
                    }));
                }
            }

            await Promise.all(promises);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get client metrics for a specific month
// ############################################################################################################
router.route('/metrics/:year/:month/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const year = parseInt(req.params.year);
            const month = parseInt(req.params.month);

            const ClientStat = mongoose.model('ClientStat');
            const clientStats = await ClientStat.find( { client: id, year: year, month: month }).select("metrics day hour").exec();

            if (!clientStats) {
                res.json({
                    result: "failed",
                    error: "client or metrics not found"
                });
            }
            else {
                res.json({
                    result: "success",
                    data: clientStats
                });
            }
        });
    });

// ############################################################################################################
// Add membership to this client to own user
// ############################################################################################################
router.route('/join/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            // Get the client
            // -----------------------------------------------------------------
            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: id, deletedAt: null }).exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "client not found"
                });
            }
            else {
                // Get my user
                // -----------------------------------------------------------------
                const User = mongoose.model('User');
                const user = await User.findOne({ _id: req.userObjectId }).exec();

                // Check the user is not already member
                // -----------------------------------------------------------------
                for (const membership of user.memberships) {
                    if (membership.client.equals(client._id)) {
                        res.json({
                            result: "failed",
                            error: "already member of this client"
                        });
                        return;
                    }
                }

                // Add membership
                // -----------------------------------------------------------------
                user.memberships.push({
                    admin: true,
                    permissions: [],
                    client: client._id,
                    primary: false
                });

                await user.save();

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Remove membership to this client from own user
// ############################################################################################################
router.route('/leave/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            // Get the client
            // -----------------------------------------------------------------
            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: id, deletedAt: null }).exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "client not found"
                });
            }
            else {
                // Get my user
                // -----------------------------------------------------------------
                const User = mongoose.model('User');
                const user = await User.findOne({ _id: req.userObjectId }).exec();

                // Check the user is not already member
                // -----------------------------------------------------------------
                for (const membership of user.memberships) {
                    if (membership.client.equals(client._id)) {

                        if (membership.primary) {
                            res.json({
                                result: "failed",
                                error: "cannot remove primary membership"
                            });
                            return;
                        }

                        user.memberships.removeObject(membership);
                        await user.save();

                        res.json({
                            result: "success"
                        });
                        return;
                    }
                }

                res.json({
                    result: "failed",
                    error: "not member of this client"
                });
            }
        });
    });

// ############################################################################################################
// Get one specific client by id
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            const Client = mongoose.model('Client');
            const ClientMetrics = mongoose.model('ClientMetrics');
            const client = await Client.findOne( { _id: id, deletedAt: null }).populate('paymentSetup').exec();

            if (!client) {
                res.json({
                    result: "failed",
                    error: "client not found"
                });
                return;
            }

            const metricsData = await ClientMetrics.findOne({ client: client._id }).exec();
            if (!metricsData) {
                res.json({
                    result: "failed",
                    error: "client metrics not found"
                });
                return;
            } else {
                const fields = [
                    "_id", "name", "metrics", "refMetrics", "paymentSetup", "storages",
                    "jobtypesEnabled", "datatypesEnabled", "featuresEnabled", "workflowsEnabled", "pluginsEnabled", "brandingAllowed",
                    "invitationTokenEnabled", "invitationToken", "createdAt", "updatedAt", "currentPlan", "vatNo",
                    "publicDownloadAllowed", "publicQueryAllowed", "acl", "conversationMode", "publicLikes",
                    "publicConversations", "publicCategories", "publicLicenses", "publicUserInfo",
                    "defaultUserStorageQuotaGb", "defaultGroupStorageQuotaGb", "defaultUserTrafficQuotaGb", "defaultGroupTrafficQuotaGb",
                    "enabledUserAndGroupFeatures", "enabledUserAndGroupJobtypes",
                    "enabledUserAndGroupDatatypes", "jobtypesEnabledForAll", "datatypesEnabledForAll", "featuresEnabledForAll",
                    "mailerName", "mailerAddress", "draftMode", "draftGracePeriodDays", "userPropertiesTemplate"
                ];

                client.metrics = metricsData.metrics;
                client.refMetrics = metricsData.refMetrics;
                client.userPropertiesTemplate = client.userPropertiesTemplate || {};

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(client, fields)
                });
            }
        });
    });

/**
 * This endpoint accepts a body describing a query and returns a page of data.
 * The body may contain the following fields:
 * - searchQuery: if supplied, only clients whose name includes the search query
 *                are returned
 * - cursor: if supplied, the response will contain a specific page
 * 
 * This endpoint returns an object containing the list of clients as an array and
 * a proprty "next", that is either null if this was the last page or a cursor
 * to continue searching. Supply this string as "cursor" in the following
 * request to get the next page.
 * 
 * If the query parameter pageSize is set, then it will be used to determine
 * how many items should be included on a page.
 */
router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            if (!req.body)
                throw new ValidationError("Body is undefined.");

            let searchQuery = nsvc.verify.optionalString(req, "searchQuery");
            let cursor = nsvc.verify.optionalString(req, "cursor", 1000);

            const data = await nsvc.clientService.queryClients(searchQuery, cursor, req.query.pageSize);

            res.json({
                result: "success",
                data: data.clients,
                next: data.next
            });
        });
    });
