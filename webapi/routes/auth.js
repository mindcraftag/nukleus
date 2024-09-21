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
const moment        = require('moment');
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
    path: "/api/auth",
    router: router
};

// ############################################################################################################
// Login user
// ############################################################################################################
router.route('/login')
    .post(nsvc.limiting.createLimiter(100), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            // The non 2FA endpoint may only be used in a development environment!
            if (nsvc.config.server.environment !== "DEV") {
                res.status(403).json({
                    result: 'failed',
                    error: 'forbidden'
                });
                return;
            }

            const account = nsvc.verify.string(req, "account").trim().toLowerCase();
            const password = nsvc.verify.string(req, "password");

            await nsvc.userService.login(res, account, password);
        });
    });

// ############################################################################################################
// Login user
// ############################################################################################################
router.route('/login2fa')
    .post(nsvc.limiting.createLimiter(100), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const account = nsvc.verify.string(req, "account").trim().toLowerCase();
            const password = nsvc.verify.string(req, "password");
            const clientId = nsvc.verify.optionalObjectId(req, "client");

            await nsvc.userService.login2FA(res, account, password, clientId);
        });
    });

// ############################################################################################################
// Login user
// ############################################################################################################
router.route('/confirm2fa')
    .post(nsvc.limiting.createLimiter(100), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const account = nsvc.verify.string(req, "account").trim().toLowerCase();
            const code = nsvc.verify.string(req, "code");

            await nsvc.userService.confirm2FA(res, account, code);
        });
    });

// ############################################################################################################
// Get current users information
// ############################################################################################################
router.route('/me')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            let paymentSetup;
            if (req.user.activeMembership.paymentSetup) {
                const ps = await nsvc.paymentService.getPaymentSetup(req.user.activeMembership.paymentSetup);
                paymentSetup = {
                    cardInfo: {
                        last4: ps.cardInfo?.last4,
                        brand: ps.cardInfo?.brand,
                        exp_month: ps.cardInfo?.exp_month,
                        exp_year: ps.cardInfo?.exp_year
                    },
                    currency: ps.currency,
                    address: {
                        email: ps.address?.email,
                        name: ps.address?.name,
                        street: ps.address?.street,
                        zipcode: ps.address?.zipcode,
                        city: ps.address?.city,
                        country: ps.address?.country
                    }
                }
            }

            let storageUsedGb = req.user.activeMembership.usedStorageQuotaGb;
            let storageQuotaGb = req.user.activeMembership.storageQuotaGb || req.client.defaultUserStorageQuotaGb;

            const Group = mongoose.model('Group');
            const groups = await Group.find({
                _id: req.user.activeMembership.groups,
                deletedAt: { $exists: false }
            }).select("name hasFolder").exec();

            // We only want the features that are enabled for the user, not features that are only available in certain groups.
            const features = await nsvc.featureService.getUserFeatureNames(req.user, null);

            const user = {
                _id: req.user._id,
                name: req.user.name,
                displayName: req.user.displayName,
                client: req.user.clientName,
                clientId: req.user.client,
                memberships: await Promise.all(req.user.memberships.toObject().map(async (membership) =>  ({
                    ...membership,
                    // Use the clientService.getClientProperties function to make sure we don't return anything the user isn't supposed to see.
                    properties: await nsvc.clientService.getClientProperties(membership.client, membership.properties, "private")
                }))),
                account: req.user.account,
                superadmin: req.user.superadmin,
                admin: req.user.activeMembership.admin,
                // If the user has requested a location change, then return the requested location (i.e. "nextLocation"),
                // else return the current location. Otherwise the user might wonder why the location change is not being saved.
                location: req.user.nextLocation || req.user.location,
                permissions: req.user.activeMembership.permissions,
                groups: groups,
                emailToConfirm: req.user.emailToConfirm,
                emailConfirmationDate: req.user.emailConfirmationDate,
                paymentSetup: paymentSetup,
                storageQuotaGb: storageQuotaGb || 0,
                storageUsedGb: storageUsedGb || 0,
                features: features
            };

            res.json({
                result: 'success',
                data: user
            });
        });
    });

// ############################################################################################################
// Make sure the user has a home directory and return its ID
// ############################################################################################################
router.route('/homefolder')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const folder = await nsvc.clientService.createUserHomeFolder(req.user.client, req.userObjectId);

            res.json({
                result: 'success',
                data: folder._id
            });
        });
    });

// ############################################################################################################
// Get current users client list
// ############################################################################################################
router.route('/myclients')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const User = mongoose.model('User');
            const user = await User.findOne({
                _id: req.user._id,
                deletedAt: { $exists: false }
            }).populate("memberships.client").populate("memberships.paymentSetup").exec();

            const Plan = mongoose.model("Plan");
            const plans = await Plan.find().select("pluginsEnabled conversationsAllowed attributeTemplatesAllowed brandingAllowed mailingEnabled paymentEnabled userPurchasesEnabled").exec();

            const Plugin = mongoose.model("Plugin");
            const plugins = await Plugin.find().exec();

            const clients = [];
            for (const membership of user.memberships) {
                const client = membership.client;
                const clientPlugins = [];

                if (client.deletedAt)
                    continue;

                let plan = null;
                for (const p of plans) {
                    if (p._id.toString() === client.currentPlan.toString()) {
                        plan = p;
                        break;
                    }
                }

                if (!plan) {
                    throw 'Plan is not set for client!';
                }

                for (const plugin of plugins) {
                    if (plugin.alwaysEnabled ||
                        client.pluginsEnabled.includes(plugin.name) ||
                        plan.pluginsEnabled.includes(plugin.name)) {

                        if (plugin.permissionsRequired && !req.user.hasPermissions(plugin.permissionsRequired))
                            continue;

                        if (plugin.needsSuperadmin && !req.user.superadmin)
                            continue;

                        if (Array.isArray(plugin.needsPlanFeatures)) {
                            let skip = false;
                            for (const planFeature of plugin.needsPlanFeatures) {
                                if (!plan[planFeature]) {
                                    skip = true;
                                    break;
                                }
                            }
                            if (skip)
                                continue;
                        }

                        clientPlugins.push(plugin);
                    }
                }

                let paymentIsSetup = false;
                let paymentCard = null;

                if (membership.paymentSetup) {
                    const cardInfo = membership.paymentSetup.cardInfo;
                    if (cardInfo) {
                        const customerIdPresent = !!membership.paymentSetup.customerId;
                        const paymentMethodIdPresent = !!membership.paymentSetup.paymentMethodId;

                        paymentIsSetup = customerIdPresent && paymentMethodIdPresent;
                        paymentCard = cardInfo ? `${cardInfo.brand || "SEPA Debit"} (...${cardInfo.last4})` : null;
                    }
                }

                clients.push({
                    _id: client._id,
                    name: client.name,
                    publicDownloadAllowed: !!client.publicDownloadAllowed,
                    brandingAllowed: !!(client.brandingAllowed && plan.brandingAllowed),
                    conversationMode: plan.conversationsAllowed ? (client.conversationMode || 0) : 0,
                    attributeTemplatesAllowed: !!plan.attributeTemplatesAllowed,
                    userPurchasesEnabled: !!plan.userPurchasesEnabled,
                    paymentIsSetup: paymentIsSetup,
                    paymentCard: paymentCard,
                    primary: membership.primary,
                    plugins: clientPlugins,
                    userStorageQuotaEnabled: !!client.defaultUserStorageQuotaGb,
                    defaultUserStorageQuotaGb: client.defaultUserStorageQuotaGb ? client.defaultUserStorageQuotaGb : null,
                    groupStorageQuotaEnabled: !!client.defaultGroupStorageQuotaGb,
                    defaultGroupStorageQuotaGb: client.defaultGroupStorageQuotaGb ? client.defaultGroupStorageQuotaGb : null,
                    userTrafficQuotaEnabled: !!client.defaultUserTrafficQuotaGb,
                    defaultUserTrafficQuotaGb: client.defaultUserTrafficQuotaGb ? client.defaultUserTrafficQuotaGb : null,
                    groupTrafficQuotaEnabled: !!client.defaultGroupTrafficQuotaGb,
                    defaultGroupTrafficQuotaGb: client.defaultGroupTrafficQuotaGb ? client.defaultGroupTrafficQuotaGb : null
                });
            }

            res.json({
                result: 'success',
                data: clients
            });

        });
    });

// ############################################################################################################
// Register new user
// ############################################################################################################
router.route('/register')
    .post(nsvc.limiting.createLimiter(20), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const password = nsvc.verify.password(req, 'password');
            const account = nsvc.verify.emailAddress(req, 'account');
            const name = nsvc.verify.string(req, 'name');
            const country = nsvc.verify.countryCode(req, 'country');
            const clientInvitationToken = nsvc.verify.optionalString(req, 'clientInvitationToken');

            // Verify the invitation token if exists
            // -------------------------------------------------------------------------------
            let client;
            if (clientInvitationToken) {
                client = await nsvc.clientService.getClientByInvitationToken(clientInvitationToken);
                if (!client) {
                    res.json({
                        result: 'failed',
                        error: "Client invitation token is invalid"
                    });
                    return;
                }
            }

            // Check if a user with this name already exists
            // -------------------------------------------------------------------------------
            const User = mongoose.model('User');
            const existingUserWithEmail = await User.findOne({
                account: account,
                deletedAt: { $exists: false }
            }).exec();

            if (existingUserWithEmail) {
                if (!existingUserWithEmail.active && existingUserWithEmail.confirmEmailToken) {

                    // The user might already exist but is still not activated so send out the email again and we're done
                    // -------------------------------------------------------------------------------
                    await nsvc.mailService.createEmailConfirmationMail(account, existingUserWithEmail.confirmEmailToken, client);

                    res.json({
                        result: 'success'
                    });

                } else {

                    // User exists already and is active.
                    // -------------------------------------------------------------------------------
                    res.json({
                        result: 'failed',
                        error: "Email address is already registered"
                    });
                }
            } else {
                const nameError = await nsvc.userService.verifyName(name);
                if (nameError) {
                    res.status(400).json({
                        result: 'failed',
                        error: nameError
                    });
                    return;
                }

                // Check if the client validation token is valid in case the user submitted one
                // -------------------------------------------------------------------------------
                let client;
                if (clientInvitationToken) {
                    client = await nsvc.clientService.getClientByInvitationToken(clientInvitationToken);
                    if (!client) {
                        res.json({
                            result: 'failed',
                            error: "Client invitation token is invalid"
                        });
                        return;
                    }
                }

                // Create the user
                // -------------------------------------------------------------------------------
                const initialAttributes = nsvc.userService.processAttributes(req.body.initialAttributes);
                const passwordHash = nsvc.security.passwordHash(password);
                const confirmEmailToken = await nsvc.security.createRandomPassword(16,
                    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

                await User.create({
                    account : account,
                    name: name,
                    location: country,
                    active: false,
                    clientInvitationToken: clientInvitationToken,
                    superadmin: false,
                    password: passwordHash,
                    waitingForApproval: true,
                    confirmEmailToken: confirmEmailToken,
                    initialAttributes: initialAttributes
                });

                await nsvc.mailService.createEmailConfirmationMail(account, confirmEmailToken, client);

                res.json({
                    result: 'success'
                });
            }
        });
    });

// ############################################################################################################
// Delete my account
// ############################################################################################################
router.route('/deletemyaccount')
    .post(nsvc.limiting.createLimiter(20), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const password = nsvc.verify.string(req, "password");

            await nsvc.userService.deleteUser(req.userObjectId, req.user.client, password);

            res.json({
                result: 'success'
            });
        });
    });

// ############################################################################################################
// Confirm email address
// ############################################################################################################
router.route('/confirmemail/:token')
    .get(nsvc.limiting.createLimiter(20), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const token = req.params.token;

            const User = mongoose.model('User');
            const user = await User.findOne({ confirmEmailToken: token }).exec();

            if (!user) {
                res.json({
                    result: 'failed',
                    error: "Token invalid"
                });
            } else {

                user.confirmEmailToken = undefined;
                await user.save();

                if (user.clientInvitationToken) {

                    // In case the user has a client invitation token, we do not need to submit it for
                    // approval. It can be approved right away and added to that client
                    // -----------------------------------------------------------------------------------
                    const client = await nsvc.clientService.getClientByInvitationToken(user.clientInvitationToken);
                    await nsvc.userService.approveUser(user._id);
                    await nsvc.mailService.createUserApprovedMail(user.account, client);
                    await nsvc.mailService.createNewUserJoinedMail(client.name, user.account, client);
                } else {

                    // User needs to be approved next
                    // -----------------------------------------------------------------------------------
                    await nsvc.mailService.createNewUserRegistrationMail(user._id, user.name, user.account);
                }

                res.json({
                    result: 'success'
                });
            }
        });
    });

// ############################################################################################################
// Confirm changed email
// ############################################################################################################
router.route('/confirmchangedemail/:token')
    .get(nsvc.limiting.createLimiter(20), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const token = req.params.token;
            const maxAge = moment().subtract(1, 'day').toDate();

            // Check if this token is for a user
            // ------------------------------------------------------------------------------
            const User = mongoose.model('User');
            const user = await User.findOne({
                confirmEmailToken: token,
                confirmEmailDate: { $gt: maxAge }
            }).exec();

            if (!user) {

                // We could not find a user with this token, then it is probably for a client
                // ------------------------------------------------------------------------------
                const Client = mongoose.model('Client');
                const client = await Client.findOne({
                    "address.confirmEmailToken": token,
                    "address.confirmEmailDate": { $gt: maxAge }
                }).exec();

                if (!client) {

                    // Token is invalid
                    // ------------------------------------------------------------------------------
                    res.json({
                        result: 'failed',
                        error: "Token invalid"
                    });
                } else {

                    // Token is valid, change the email address
                    // ------------------------------------------------------------------------------
                    client.address.email = client.address.emailToConfirm;
                    client.address.emailToConfirm = undefined;
                    client.address.confirmEmailDate = undefined;
                    client.address.confirmEmailToken = undefined;

                    await client.save();

                    res.json({
                        result: 'success'
                    });
                }
            } else {

                // Token is valid, change the email address
                // ------------------------------------------------------------------------------
                user.account = user.emailToConfirm;
                user.emailToConfirm = undefined;
                user.confirmEmailDate = undefined;
                user.confirmEmailToken = undefined;

                await user.save();

                res.json({
                    result: 'success'
                });
            }
        });
    });

// ############################################################################################################
// Forgot password
// ############################################################################################################
router.route('/forgotpassword')
    .post(nsvc.limiting.createLimiter(20), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const account = nsvc.verify.emailAddress(req, "account");
            let client = nsvc.verify.optionalObjectId(req, "client");

            const User = mongoose.model('User');
            const user = await User.findOne({ account: account }).exec();

            if (user) {

                // If a client was passed, it needs to be verified. The user must be member and
                // if not, client is set to undefined. This is non-critical because the client
                // only decides about the used email template
                // -----------------------------------------------------------------------------------
                if (client) {
                    let found = false;

                    for (const membership of user.memberships) {
                        if (membership.client.equals(client)) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        client = undefined;
                    }
                }

                // Set a token and send the email
                // -----------------------------------------------------------------------------------
                user.forgotPasswordToken = await nsvc.security.createRandomPassword(16, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
                user.forgotPasswordAt = new Date();
                await user.save();
                await nsvc.mailService.createForgotPasswordMail(user.account, user.forgotPasswordToken, client);
            }

            res.json({
                result: 'success'
            });
        });
    });

// ############################################################################################################
// Set new password
// ############################################################################################################
router.route('/setnewpassword')
    .post(nsvc.limiting.createLimiter(20), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const token = nsvc.verify.string(req, "token");
            const password = nsvc.verify.password(req, "password");

            const User = mongoose.model('User');
            const user = await User.findOne({ forgotPasswordToken: token, forgotPasswordAt: { $exists: true } }).exec();

            if (!user) {
                res.json({
                    result: 'failed',
                    error: "Token invalid"
                });
            }
            else {
                const minutes = moment().diff(user.forgotPasswordAt, "minute");
                if (minutes > 120) {
                    res.json({
                        result: 'failed',
                        error: "Token expired"
                    });
                } else {
                    user.forgotPasswordToken = undefined;
                    user.forgotPasswordAt = undefined;
                    user.password = nsvc.security.passwordHash(password);
                    await user.save();

                    res.json({
                        result: 'success'
                    });
                }
            }
        });
    });

// ############################################################################################################
// Check if an account exists with the given email address
// ############################################################################################################
router.route('/accountExists')
    .post(nsvc.limiting.createLimiter(10, 60 * 60), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const account = nsvc.verify.emailAddress(req, 'account');

            // Check if there is an account with this email address
            // -------------------------------------------------------------------------------
            const User = mongoose.model('User');
            const user = await User.findOne({
                account: account,
                deletedAt: { $exists: false }
            }).exec();

            res.json({
                result: 'success',
                data: !!user
            });
        });
    });
