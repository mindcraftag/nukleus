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
const Busboy        = require('busboy');
const { ValidationError } = require('@mindcraftgmbh/nukleus-service/src/exception');
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
    path: "/api/user",
    router: router,
    permissions: [
        { name: 'user_admin', group:"user", description: 'Administrate users' }
    ]
};

// ############################################################################################################
// Get list of users that belong to the same client as the user that is making this request
// If the request is being made by someone who has the "user_admin" permission, then the response includes data about
// the membership of each user. Otherwise the response will only include basic information (id and name of the user)
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let nextItem = null;

            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            const isAdmin = req.user.hasPermissions(['user_admin'], false);

            const data = await nsvc.userService.getUsersByClient(req.user.client, isAdmin, req.query.pageSize, nextItem);
            res.json({
                result: "success",
                data: data.users,
                next: data.nextObjectID
            });
        });
    })

// ############################################################################################################
// Create user
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(20), nsvc.security.checkAccess(['user_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const account = nsvc.verify.emailAddress(req, 'account');
            const name = nsvc.verify.string(req, 'name');
            const displayName = nsvc.verify.optionalString(req, 'displayName');
            const admin = nsvc.verify.boolean(req, 'admin');
            const permissions = nsvc.verify.optionalStringArray(req, 'permissions') || [];
            const storageQuotaGb = nsvc.verify.optionalIntegerNumber(req, "storageQuotaGb");
            const trafficQuotaGb = nsvc.verify.optionalIntegerNumber(req, "trafficQuotaGb");
            const password = nsvc.verify.optionalPassword(req, 'password');
            const country = nsvc.verify.optionalCountryCode(req, 'country');

            const nameError = await nsvc.userService.verifyName(name);
            if (nameError) {
                res.status(400).json({
                    result: 'failed',
                    error: nameError
                });
                return;
            }

            const displayNameError = await nsvc.userService.verifyDisplayName(displayName);
            if (displayNameError) {
                res.status(400).json({
                    result: 'failed',
                    error: displayNameError
                });
                return;
            }

            // Check for user trying to assign permissions, it does not have itself
            // -----------------------------------------------------
            await nsvc.permissionService.verifyPermissions(permissions, req.user);

            if (admin && !req.user.isAdmin()) {
                res.json({
                    result: "failed",
                    error: "Cannot assign admin permission without having it"
                });
                return;
            }

            // Try to find the user by email address. maybe it exists
            // -----------------------------------------------------
            const User = mongoose.model('User');
            let user = await User.findOne({ account: account, deletedAt: { $exists: false } }).exec();

            if (user) {
                // The user already exists. Check for membership and add it
                // -----------------------------------------------------
                for (const membership of user.memberships) {
                    if (membership.client.equals(req.user.client)) {
                        res.json({
                            result: "failed",
                            error: "User with that email address already exists"
                        });
                        return;
                    }
                }

                // Add membership to user
                // -----------------------------------------------------
                user.memberships.push({
                    client: req.user.client,
                    permissions: permissions,
                    admin: admin,
                    primary: false
                });

                user.save();

                // Send new membership mail
                // -----------------------------------------------------
                await nsvc.mailService.createNewMembershipMail(account, req.user.clientName);

                res.status(201).json({
                    result: "success",
                    data: user._id
                });

            } else {
                // Since we are creating a user before that user logs in, we set the location to the default system location.
                if (password) {

                    // The user does not exist yet. Create it using the provided password
                    // -----------------------------------------------------
                    user = await User.create({
                        account : account,
                        name: name,
                        displayName: displayName,
                        location: country ? country : nsvc.config.systemLocation,
                        active: true,
                        superadmin: false,
                        password: nsvc.security.passwordHash(password),
                        memberships: [{
                            client: req.user.client,
                            permissions: permissions,
                            admin: admin,
                            primary: true,
                            storageQuotaGb: storageQuotaGb,
                            trafficQuotaGb: trafficQuotaGb
                        }]
                    });

                    res.status(201).json({
                        result: "success",
                        data: user._id
                    });

                } else {

                    // The user does not exist yet. Create it and send an invitation email
                    // -----------------------------------------------------
                    const invitationToken = await nsvc.security.createRandomPassword(16, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

                    // Create user
                    // -----------------------------------------------------
                    user = await User.create({
                        account : account,
                        name: name,
                        displayName: displayName,
                        location: country ? country : nsvc.config.systemLocation,
                        active: false,
                        invitationToken: invitationToken,
                        superadmin: false,
                        memberships: [{
                            client: req.user.client,
                            permissions: permissions,
                            admin: admin,
                            primary: true
                        }]
                    });

                    // Send invitation link
                    // -----------------------------------------------------
                    await nsvc.mailService.createNewUserMail(account, invitationToken);

                    res.status(201).json({
                        result: "success",
                        data: user._id
                    });
                }
            }
        });
    })

// ############################################################################################################
// Modify user
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "_id");
            const password = nsvc.verify.optionalPassword(req, 'password');
            const account = nsvc.verify.emailAddress(req, 'account');
            const name = nsvc.verify.string(req, 'name');
            const displayName = nsvc.verify.optionalString(req, 'displayName');
            const location = nsvc.verify.optionalCountryCode(req, "country");
            const admin = nsvc.verify.boolean(req, 'admin');
            const permissions = nsvc.verify.optionalStringArray(req, 'permissions');
            const storageQuotaGb = nsvc.verify.optionalIntegerNumberOrNull(req, "storageQuotaGb");
            const trafficQuotaGb = nsvc.verify.optionalIntegerNumberOrNull(req, "trafficQuotaGb");
            const allowedDatatypes = nsvc.verify.optionalStringArray(req, "allowedDatatypes");
            const allowedJobtypes = nsvc.verify.optionalStringArray(req, "allowedJobtypes");
            const allowedFeatures = nsvc.verify.optionalStringArray(req, "allowedFeatures");
            const paymentSetupAddressEmail = nsvc.verify.optionalEmailAddress(req, "paymentSetup.address.email");
            const paymentSetupAddressName = nsvc.verify.optionalString(req, "paymentSetup.address.name");
            const paymentSetupAddressStreet = nsvc.verify.optionalString(req, "paymentSetup.address.street");
            const paymentSetupAddressZipcode = nsvc.verify.optionalString(req, "paymentSetup.address.zipcode");
            const paymentSetupAddressCity = nsvc.verify.optionalString(req, "paymentSetup.address.city");
            const paymentSetupAddressCountry = nsvc.verify.optionalString(req, "paymentSetup.address.country");

            // We can use the user-supplied ID here, because if it's not
            // associated with a user, the rest of this function won't do
            // anything.
            const nameError = await nsvc.userService.verifyName(name, id);
            if (nameError) {
                res.status(400).json({
                    result: 'failed',
                    error: nameError
                });
                return;
            }

            const displayNameError = await nsvc.userService.verifyDisplayName(displayName);
            if (displayNameError) {
                res.status(400).json({
                    result: 'failed',
                    error: displayNameError
                });
                return;
            }

            const User = mongoose.model('User');
            const user = await User.findOne({
                _id: id,
                deletedAt: { $exists: false }
            }).exec();

            if (!user) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            }
            else {
                // Check if the user is a member of this client
                // -----------------------------------------------------
                let membership = null;
                for (const m of user.memberships) {
                    if (m.client.equals(req.user.client)) {
                        membership = m;
                        break;
                    }
                }

                if (!membership) {
                    res.status(404).json({
                        result: "failed",
                        error: "user not found"
                    });
                    return;
                }

                if (req.body.properties) {
                    const isValid = await nsvc.clientService.isValidClientProperties(req.user.client, req.body.properties, true);
                    if (!isValid) {
                        res.json({
                            result: "failed",
                            error: "Invalid properties"
                        });
                        return;
                    }

                    membership.properties = req.body.properties;
                } else {
                    membership.properties = {};
                }

                // Check for existence of other user with that name
                // -----------------------------------------------------
                if (!admin && await nsvc.userService.isLastAdmin(id, req.user.client)) {
                    res.json({
                        result: "failed",
                        error: "This user is the last admin. You cannot remove this status."
                    });
                    return;
                }

                // Check for existence of other user with that name
                // -----------------------------------------------------
                if (account !== user.account && await nsvc.userService.isNameConflict(account)) {
                    res.json({
                        result: "failed",
                        error: "User with that account already exists"
                    });
                    return;
                }

                // Check for user trying to assign permissions, it does not have itself
                // -----------------------------------------------------
                await nsvc.permissionService.verifyPermissions(permissions, req.user, membership.permissions);

                if (admin && !membership.admin && !req.user.isAdmin()) {
                    res.json({
                        result: "failed",
                        error: "Cannot assign admin permission without having it"
                    });
                    return;
                }

                // Save user changes
                // -----------------------------------------------------
                membership.admin = admin;
                membership.permissions = permissions;

                if (storageQuotaGb !== undefined)
                    membership.storageQuotaGb = storageQuotaGb;

                if (trafficQuotaGb !== undefined)
                    membership.trafficQuotaGb = trafficQuotaGb;

                if (Array.isArray(allowedDatatypes))
                    membership.allowedDatatypes = allowedDatatypes;

                if (Array.isArray(allowedFeatures))
                    membership.allowedFeatures = allowedFeatures;

                if (Array.isArray(allowedJobtypes))
                    membership.allowedJobtypes = allowedJobtypes;

                if (password) {
                    user.password = nsvc.security.passwordHash(password);
                }

                user.account = account;
                user.name = name;
                user.displayName = displayName;
                user.__user = req.userObjectId;

                await user.save({ __user: req.userObjectId });

                if (membership.paymentSetup) {
                    const paymentSetup = await nsvc.paymentService.getPaymentSetup(membership.paymentSetup);
                    let changed = false;

                    if (paymentSetupAddressEmail !== undefined) {
                        paymentSetup.address.email = paymentSetupAddressEmail;
                        changed = true;
                    }

                    if (paymentSetupAddressName !== undefined) {
                        paymentSetup.address.name = paymentSetupAddressName;
                        changed = true;
                    }

                    if (paymentSetupAddressStreet !== undefined) {
                        paymentSetup.address.street = paymentSetupAddressStreet;
                        changed = true;
                    }

                    if (paymentSetupAddressZipcode !== undefined) {
                        paymentSetup.address.zipcode = paymentSetupAddressZipcode;
                        changed = true;
                    }

                    if (paymentSetupAddressCity !== undefined) {
                        paymentSetup.address.city = paymentSetupAddressCity;
                        changed = true;
                    }

                    if (paymentSetupAddressCountry !== undefined) {
                        paymentSetup.address.country = paymentSetupAddressCountry;
                        changed = true;
                    }

                    if (changed)
                        await paymentSetup.save();
                }

                if (location && location !== user.location) {
                    // When the user switches the country, we set the nextLocation to the requested location.
                    // A JobAgent will pick this up and switch the location of the associated items.
                    user.nextLocation = location;
                    await user.save();
                }

                res.json({
                    result: "success"
                });
            }
        });
    })

// ############################################################################################################
// Delete user (or just remove a membership)
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "id");

            if (req.user._id.equals(id)) {
                res.json({
                    result: "failed",
                    error: "you cannot delete yourself"
                });
                return;
            }

            await nsvc.userService.deleteUser(id, req.user.client);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get list of users to approve
// ############################################################################################################
router.route('/approvals')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const User = mongoose.model('User');
            const users = await User.find({
                waitingForApproval: true,
                deletedAt: { $exists: false },
                confirmEmailToken: { $exists: false }
            }).select("account name createdAt").exec();

            res.json({
                result: "success",
                data: users
            });
        });
    });

// ############################################################################################################
// Activate a user
// ############################################################################################################
router.route('/activate')
    .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const password = nsvc.verify.password(req, 'password');
            const token = nsvc.verify.string(req, 'token');

            const User = mongoose.model('User');
            const user = await User.findOne({
                invitationToken: token,
                active: false,
                deletedAt: { $exists: false }
            }).exec();

            if (user) {
                user.invitationToken = undefined;
                user.active = true;
                user.password = nsvc.security.passwordHash(password);
                await user.save();

                // Create a home folder for the user
                // -------------------------------------------------------------
                for (const membership of user.memberships) {
                    try {
                        await nsvc.clientService.createUserHomeFolder(membership.client, user._id);
                    } catch (err) {
                        console.error(err);
                    }
                }

                res.json({
                    result: "success"
                });
            }
            else {
                res.json({
                    result: "failed",
                    error: "token invalid"
                });
            }
        });
    });

// ############################################################################################################
// Modify my user data
// ############################################################################################################
router.route('/myprofile')
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const password = nsvc.verify.optionalPassword(req, 'password');
            const account = nsvc.verify.emailAddress(req, 'account');
            const name = nsvc.verify.string(req, 'name');
            const displayName = nsvc.verify.optionalString(req, 'displayName');
            const location = nsvc.verify.optionalCountryCode(req, "country");
            const paymentSetupAddressEmail = nsvc.verify.optionalEmailAddress(req, "paymentSetup.address.email");
            const paymentSetupAddressName = nsvc.verify.optionalString(req, "paymentSetup.address.name");
            const paymentSetupAddressStreet = nsvc.verify.optionalString(req, "paymentSetup.address.street");
            const paymentSetupAddressZipcode = nsvc.verify.optionalString(req, "paymentSetup.address.zipcode");
            const paymentSetupAddressCity = nsvc.verify.optionalString(req, "paymentSetup.address.city");
            const paymentSetupAddressCountry = nsvc.verify.optionalString(req, "paymentSetup.address.country");

            const User = mongoose.model('User');
            const user = await User.findOne({
                _id: req.userObjectId,
                deletedAt: { $exists: false }
            }).exec();

            if (!user) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            }
            else {

                // Check if the user is a member of this client
                // -----------------------------------------------------
                let membership = null;
                for (const m of user.memberships) {
                    if (m.client.equals(req.user.client)) {
                        membership = m;
                        break;
                    }
                }

                if (!membership) {
                    res.status(404).json({
                        result: "failed",
                        error: "user not found"
                    });
                    return;
                }

                // Check for existence of other user with that name
                // -----------------------------------------------------
                if (account !== user.account && await nsvc.userService.isNameConflict(account)) {
                    res.json({
                        result: "failed",
                        error: "User with that account already exists"
                    });
                    return;
                }

                // Save user changes
                // -----------------------------------------------------
                if (password) {
                    user.password = nsvc.security.passwordHash(password);
                }

                if (req.body.properties) {
                    const isValid = await nsvc.clientService.isValidClientProperties(req.user.client, req.body.properties, false);
                    if (!isValid) {
                        res.json({
                            result: "failed",
                            error: "Invalid properties"
                        });
                        return;
                    }

                    membership.properties = req.body.properties;
                } else {
                    membership.properties = {};
                }

                if (user.account !== account) {
                    user.emailToConfirm = account;
                    user.confirmEmailDate = new Date();
                    user.confirmEmailToken = await nsvc.security.createRandomPassword();
                    await nsvc.mailService.createEmailChangedConfirmationMail(user.emailToConfirm, user.confirmEmailToken);
                }

                const nameError = await nsvc.userService.verifyName(name, user._id);
                if (nameError) {
                    res.status(400).json({
                        result: 'failed',
                        error: nameError
                    });
                    return;
                }

                const displayNameError = await nsvc.userService.verifyDisplayName(displayName);
                if (displayNameError) {
                    res.status(400).json({
                        result: 'failed',
                        error: displayNameError
                    });
                    return;
                }

                user.name = name;
                user.displayName = displayName;
                user.__user = req.userObjectId;

                await user.save({ __user: req.userObjectId });

                if (membership.paymentSetup) {
                    const paymentSetup = await nsvc.paymentService.getPaymentSetup(membership.paymentSetup);
                    let changed = false;

                    if (paymentSetupAddressEmail !== undefined) {
                        paymentSetup.address.email = paymentSetupAddressEmail;
                        changed = true;
                    }

                    if (paymentSetupAddressName !== undefined) {
                        paymentSetup.address.name = paymentSetupAddressName;
                        changed = true;
                    }

                    if (paymentSetupAddressStreet !== undefined) {
                        paymentSetup.address.street = paymentSetupAddressStreet;
                        changed = true;
                    }

                    if (paymentSetupAddressZipcode !== undefined) {
                        paymentSetup.address.zipcode = paymentSetupAddressZipcode;
                        changed = true;
                    }

                    if (paymentSetupAddressCity !== undefined) {
                        paymentSetup.address.city = paymentSetupAddressCity;
                        changed = true;
                    }

                    if (paymentSetupAddressCountry !== undefined) {
                        paymentSetup.address.country = paymentSetupAddressCountry;
                        changed = true;
                    }

                    if (changed)
                        await paymentSetup.save();
                }

                if (location && location !== user.location) {
                    // When the user switches the country, we set the nextLocation to the requested location.
                    // A JobAgent will pick this up and switch the location of the associated items.
                    user.nextLocation = location;
                    await user.save();
                }

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Approve a new user
// ############################################################################################################
router.route('/approveuserregistration/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const user = await nsvc.userService.approveUser(id);
            await nsvc.mailService.createUserApprovedMail(user.account);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Reject a new user
// ############################################################################################################
router.route('/rejectuserregistration/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin'], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            const User = mongoose.model('User');
            const user = await User.findOne({
                _id: id,
                deletedAt: { $exists: false },
            }).exec();

            if (!user) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            }
            else {

                if (!user.waitingForApproval) {
                    res.json({
                        result: "failed",
                        error: "User does not wait for approval"
                    });
                    return;
                }

                user.deletedAt = new Date();
                await user.save();

                await nsvc.mailService.createUserRejectionMail(user.account);

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Upload avatar
// ############################################################################################################
router.route('/uploadAvatar')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const busboy = new Busboy({ headers: req.headers });
            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {
                await nsvc.userService.createAvatarFromStream(req.userId, file, [32, 64, 128, 256]);
                res.json({
                    result: "success"
                });
            });
            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Clear avatar
// ############################################################################################################
router.route('/clearAvatar')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            await nsvc.userService.clearAvatar(req.userId);
            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get public info (name & avatar
// ############################################################################################################
router.route('/publicinfo/:id/:clientId/:avatarSize')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function(req, res) {
        nsvc.common.handleError(req, res,async function() {

            const userId = nsvc.verify.toObjectId(req.params.id);
            const clientId = nsvc.verify.toObjectId(req.params.clientId);
            const size = parseInt(req.params.avatarSize);

            const client = await nsvc.clientService.getClient(clientId, "publicUserInfo");
            if (!client) {
                res.status(404).json({
                    result: "failed",
                    error: "client not found"
                });
                return;
            }

            if (!client.publicUserInfo) {
                res.status(403).json({
                    result: "failed",
                    error: "forbidden"
                });
                return;
            }

            const avatar = await nsvc.userService.getAvatar(userId, size, clientId, !client.publicUserInfo);
            if (!avatar) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            } else {
                res.json({
                    result: "success",
                    data: avatar
                });
            }
        });
    });

// ############################################################################################################
// Get avatar
// ############################################################################################################
router.route('/avatar/:size/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function(req, res) {
        nsvc.common.handleError(req, res,async function() {

            const userId = nsvc.verify.toObjectId(req.params.id);
            const size = parseInt(req.params.size);

            const avatar = await nsvc.userService.getAvatar(userId, size);
            if (!avatar) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            } else {
                res.json({
                    result: "success",
                    data: avatar
                });
            }
        });
    });

// ############################################################################################################
// Get one specific user by id
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);

            const User = mongoose.model('User');
            const user = await User.findOne({
                "memberships.client": req.user.client,
                _id: id,
                deletedAt: { $exists: false }
            }).exec();

            if (!user) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            }
            else {
                let membership;
                for (const m of user.memberships) {
                    if (m.client.equals(req.user.client)) {
                        membership = m;
                        break;
                    }
                }

                let paymentSetup = null;
                if (membership.paymentSetup) {
                    paymentSetup = await nsvc.paymentService.getPaymentSetup(membership.paymentSetup);
                }


                res.json({
                    result: "success",
                    data: {
                        _id: user._id,
                        account: user.account,
                        superadmin: user.superadmin,
                        location: req.user.superadmin ? user.location : undefined,
                        name: user.name,
                        displayName: user.displayName,
                        client: membership.client,
                        permissions: membership.permissions,
                        storageQuotaGb: membership.storageQuotaGb || null,
                        trafficQuotaGb: membership.trafficQuotaGb || null,
                        admin: membership.admin,
                        paymentSetup: paymentSetup,
                        allowedJobtypes: membership.allowedJobtypes || [],
                        allowedDatatypes: membership.allowedDatatypes || [],
                        allowedFeatures: membership.allowedFeatures || [],
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                        // Use the clientService.getClientProperties function so we don't return any properties that are not included in the client properties.
                        properties: await nsvc.clientService.getClientProperties(req.user.client, membership.properties, "system")
                    }
                });
            }
        });
    });

// ############################################################################################################
// Get users memberships list
// ############################################################################################################
router.route('/memberships/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["user_admin"], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const userId = nsvc.verify.toObjectId(req.params.id);

            const User = mongoose.model('User');
            const user = await User.findOne({
                _id: userId,
                deletedAt: { $exists: false }
            }).populate("memberships.client").exec();

            if (!user) {
                res.status(404).json({
                    result: "failed",
                    error: "user not found"
                });
            } else {
                res.json({
                    result: 'success',
                    data: user.memberships
                });
            }
        });
    });

// ############################################################################################################
// Get user attribute
// ############################################################################################################
router.route('/attribute/:key')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const key = nsvc.verify.toString(req.params.key, "key");
            const value = await nsvc.userService.getAttribute(req.user._id, req.user.client, key);

            res.json({
                result: 'success',
                data: value
            });
        });
    })

// ############################################################################################################
// Set user attribute
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const key = nsvc.verify.toString(req.params.key, "key");
            await nsvc.userService.setAttribute(req.user._id, req.user.client, key, req.body);

            res.json({
                result: 'success'
            });
        });
    })

// ############################################################################################################
// Clear user attribute
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const key = nsvc.verify.toString(req.params.key, "key");
            await nsvc.userService.clearAttribute(req.user._id, req.user.client, key);

            res.json({
                result: 'success'
            });
        });
    });

/**
 * This endpoint accepts a body describing a query and returns a page of data.
 * The body may contain the following fields:
 * - groupID: if supplied, the query will only return users that have a
 *             membership belonging to this group
 * - searchQuery: if supplied, only users whose name includes the search query
 *                are returned
 * - cursor: if supplied, the response will contain a specific page
 * 
 * This endpoint returns an object containing the list of users as an array and
 * a proprty "next", that is either null if this was the last page or a cursor
 * to continue searching. Supply this string as "cursor" in the following
 * request to get the next page.
 * 
 * If the query parameter pageSize is set, then it will be used to determine
 * how many items should be included on a page.
 */
router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['user_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            if (!req.body)
                throw new ValidationError("Body is undefined.");

            let groupID = nsvc.verify.optionalString(req, "groupID");
            let searchQuery = nsvc.verify.optionalString(req, "searchQuery");
            let cursor = nsvc.verify.optionalString(req, "cursor", 1000);

            const data = await nsvc.userService.queryUsers(searchQuery, groupID, req.user.client, cursor, req.query.pageSize);

            res.json({
                result: "success",
                data: data.users,
                next: data.next
            });
        });
    });
