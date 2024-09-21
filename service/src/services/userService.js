"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment            = require('moment');
const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const clientService     = require('./clientService');
const mailService       = require('./mailService');
const security          = require('../tools/security');
const imageTools        = require('../tools/imageTools');
const pagingTools       = require('../tools/paging');
const limits            = require('../limits');
const assert            = require('node:assert/strict');

const {
    QuotaExceededError,
    ValidationError
} = require("../exception");
const nsvc = require("../../index");

exports.isNameConflict = async function(account) {
    const User = mongoose.model('User');
    const conflict = await User.existsByAccount(account);
    return conflict;
};

exports.isLastAdmin = async function(userId, clientId) {
    const User = mongoose.model('User');
    const users = await User.find({"memberships.client": clientId}).exec();

    let adminCount = 0;
    let userIsAdmin = false;

    for (const user of users) {
        for (const membership of user.memberships) {
            if (membership.client.equals(clientId) && membership.admin === true) {

                if (user._id.equals(userId))
                    userIsAdmin = true;

                adminCount++;
                break;
            }
        }
    }

    return userIsAdmin && adminCount <= 1;
};

exports.deleteUser = async function(userId, clientId, optionalPassword) {

    const User = mongoose.model('User');
    const user = await User.findOne({
        _id: userId,
        "memberships.client": clientId,
        deletedAt: { $exists: false }
    }).exec();

    if (!user) {
        throw new ValidationError("User not found");
    }

    // In case the password was passed, verify it is correct before deleting the account
    // ------------------------------------------------------------------------------
    if (optionalPassword) {
        if (!security.comparePasswords(optionalPassword, user.password)) {
            throw new ValidationError("Password invalid");
        }
    }

    // Check if the user is member in the users client and if so, remove membership
    // ------------------------------------------------------------------------------
    let found = false;
    for (const membership of user.memberships) {
        if (membership.client.equals(clientId)) {
            user.memberships.removeObject(membership);
            user.removedMemberships.push(membership);
            found = true;
            break;
        }
    }

    if (!found) {
        throw new ValidationError("User membership not found");
    }

    // Deactivate any purchases of this user in the specified client
    // ------------------------------------------------------------------------------
    const Purchase = mongoose.model('Purchase');
    await Purchase.updateMany({
        user: user._id,
        client: clientId
    }, {
        $set: {
            active: false
        }
    });

    // If this is the last client, mark the user as deleted
    // ------------------------------------------------------------------------------
    if (user.memberships.length === 0) {
        user.deletedAt = new Date();
    }

    await user.save();
}

exports.approveUser = async function(userId, approvalUserId) {

    approvalUserId = approvalUserId || security.getSystemUserId();

    const User = mongoose.model('User');
    const user = await User.findOne({
        _id: userId,
        deletedAt: { $exists: false }
    }).exec();

    if (!user) {
        throw new ValidationError("User not found");
    }

    if (user.confirmEmailToken) {
        throw new ValidationError("User did not yet confirm the email address. No approval possible.");
    }

    if (!user.waitingForApproval) {
        throw new ValidationError("User does not wait for approval");
    }

    // Create a client for that user or add it to an existing client
    // -------------------------------------------------------------
    const Client = mongoose.model("Client");

    if (user.clientInvitationToken) {
        const client = await Client.findOne({
            invitationToken: user.clientInvitationToken,
            invitationTokenEnabled: true
        }).exec();

        if (!client) {
            throw "User has an invalid client invitation token";
        } else {
            user.memberships = [{
                client: client._id,
                permissions: ["job_create"],
                admin: false,
                primary: true,
                attributes: user.initialAttributes
            }];
        }

        // Create a home folder for the user
        // -------------------------------------------------------------
        await clientService.createUserHomeFolder(client._id, userId);

    } else {
        const client = await clientService.createClient(user.name, user.account, true);

        user.memberships = [{
            client: client._id,
            permissions: [],
            admin: true,
            primary: true,
            attributes: user.initialAttributes
        }];
    }

    // Update and activate the user
    // -------------------------------------------------------------
    user.active = true;
    user.__user = approvalUserId;

    await user.save({ __user: approvalUserId });

    await User.updateMany({
        _id: userId
    }, {
        $unset: {
            clientInvitationToken: true,
            confirmEmailToken: true,
            waitingForApproval: true,
            initialAttributes: true
        }
    });

    return user;
}

exports.createAvatarFromStream = async function(userId, stream, sizes) {
    const User = mongoose.model('User');
    const user = await User.findOne({ _id: userId, deletedAt: { $exists: false }}).exec();

    if (!user)
        throw "User not found!";

    const resizeOptions = sizes.map(size => ({
        width: size, 
        height: size, 
        outputDataType: "BASE_64",
        outputMimeType: "JPEG", 
        resizeStrategy: "SCALE_TO_FIT",
        quality: 90
    }));

    const imagesWithDimensions = await imageTools.generateResizedImagesFromStream(stream, resizeOptions);

    // avatar only takes size instead of width and height. because it is squared, set width as size
    const imagesWithSize = imagesWithDimensions.map(image => ({data: image.data, size: image.width}))
    user.avatar = imagesWithSize;

    await user.save();
};

exports.clearAvatar = async function(userId) {
    const User = mongoose.model('User');
    const user = await User.findOne({ _id: userId, deletedAt: { $exists: false }}).exec();
    if (!user)
        throw "User not found!";

    user.avatar = undefined;
    await user.save();
};

exports.getAvatar = async function(userId, size, clientId, omitUserInfo) {

    let filter = {
        _id: userId,
        deletedAt: { $exists: false },
        waitingForApproval: { $exists: false },
        active: true
    };

    if (clientId) {
        // only return the avatar if the user is member of that client
        filter["memberships.client"] = clientId;
    }

    let select = "name displayName memberships";
    if (!omitUserInfo) {
        select += " avatar";
    }

    const User = mongoose.model('User');
    const user = await User.findOne(filter).select(select).exec();

    if (!user)
        return null;

    let avatar = null;

    if (Array.isArray(user.avatar)) {
        for (const a of user.avatar) {
            if (a.size <= size || avatar === null)
                avatar = a;
        }
    }

    const nameParts = user.name.split(" ").filter(x => x.length > 0);
    const initials = nameParts.map(x => x[0]).join("").toUpperCase();

    let result = {
        avatar: avatar ? avatar.data : null,
        initials: initials
    };

    if (!omitUserInfo) {
        result.name = user.name;
        result.displayName = user.displayName;

        if (clientId) {
            const membership = user.memberships.find(m => m.client.equals(clientId));
            assert(membership);

            result.properties = await clientService.getClientProperties(clientId, membership.properties || {}, "public");
        }
    }

    return result;
};

exports.clean2FACodes = function(user, clientId) {
    if (!Array.isArray(user.twoFactorAuth)) {
        user.twoFactorAuth = [];
        return;
    }

    const now = moment();

    for (let i=0; i<user.twoFactorAuth.length; ) {
        const entry = user.twoFactorAuth[i];

        if (now.isAfter(entry.validUntil) || (!entry.client && !clientId) || (entry.client && entry.client.equals(clientId))) {
            user.twoFactorAuth.splice(i, 1);
        } else {
            i++;
        }
    }
}

exports.login = async function(res, account, password) {
    const User = mongoose.model('User');
    const user = await User.findOne({
        account: account,
        active: true,
        internal: { $exists: false },
        deletedAt: { $exists: false }
    }).exec();

    if (!user) {
        res.status(403).json({
            result: 'failed',
            error: 'credentials mismatch'
        });
        return;
    }

    if (!nsvc.security.comparePasswords(password, user.password)) {
        res.status(403).json({
            result: 'failed',
            error: 'credentials mismatch'
        });
        return;
    }

    const token = nsvc.security.createToken(user._id);

    res.json({
        result: 'success',
        data: token
    });
}

exports.login2FA = async function(res, account, password, clientId) {
    const User = mongoose.model('User');
    const user = await User.findOne({
        account: account,
        active: true,
        internal: { $exists: false },
        deletedAt: { $exists: false }
    }).exec();

    if (!user) {
        // Check if there is an inactive user, which means that the email was
        // not yet verified or that the user is not yet approved.
        const inactiveUser = await User.findOne({
            account: account,
            internal: { $exists: false },
            deletedAt: { $exists: false }
        }).exec();

        if (inactiveUser) {
            res.status(403).json({
                result: 'failed',
                error: 'email unverified'
            });
        } else {
            res.status(403).json({
                result: 'failed',
                error: 'credentials mismatch'
            });
        }
        return;
    }

    if (!security.comparePasswords(password, user.password)) {
        res.status(403).json({
            result: 'failed',
            error: 'credentials mismatch'
        });
        return;
    }

    let client;
    if (clientId) {
        for (const membership of user.memberships) {
            if (membership.client.equals(clientId)) {
                const Client = mongoose.model('Client');
                client = await Client.findOne({ _id: clientId, deletedAt: { $exists: false } }).select("name").exec();
            }
        }

        if (!client) {
            res.status(403).json({
                result: 'failed',
                error: 'user is no member in client'
            });
            return;
        }
    }

    const code = await security.createRandomPassword(6, "12345678900");

    exports.clean2FACodes(user, clientId);
    user.twoFactorAuth.push({
       code: code,
       validUntil: moment().add(limits.MAX_2FA_VALIDITY, limits.MAX_2FA_VALIDITY_UNIT).toDate(),
       client: clientId
    });
    await user.save();

    await mailService.create2FAMail(user.account, client ? client.name : null, code, client);

    res.json({
        result: 'success'
    });
};

exports.confirm2FA = async function(res, account, code) {

    const User = mongoose.model('User');
    const user = await User.findOne({
        account: account,
        active: true,
        internal: { $exists: false },
        deletedAt: { $exists: false },
        "twoFactorAuth.code": code
    }).exec();

    if (!user) {
        res.status(403).json({
            result: 'failed',
            error: 'code mismatch'
        });
        return;
    }

    for (const entry of user.twoFactorAuth) {
        if (entry.code === code) {
            if (moment().isAfter(entry.validUntil)) {
                res.status(403).json({
                    result: 'failed',
                    error: 'code expired'
                });
                return;
            }

            const token = security.createToken(user._id.toString(), entry.client ? entry.client.toString() : null);
            res.json({
                result: 'success',
                data: token
            });

            user.twoFactorAuth.removeObject(entry);
            break;
        }
    }

    await user.save();
}

/**
 * Retrieve a user's payment setup for the membership of a client
 * @param userId
 * @param clientId
 * @returns {Promise<null|*>}
 */
exports.getPaymentSetup = async function(userId, clientId) {
    const result = await exports.getUser(userId, clientId);
    if (!result)
        return null;

    if (!result.membership.paymentSetup)
        return null;

    const PaymentSetup = mongoose.model('PaymentSetup');
    const paymentSetup = await PaymentSetup.findOne({ _id: result.membership.paymentSetup }).exec();
    return paymentSetup;
}

/**
 * Retrieve a user and its membership object for a client
 * @param userId
 * @param clientId
 * @returns {Promise<{membership: any, user: Document<unknown, any, unknown> & Require_id<unknown>}|null>}
 */
exports.getUser = async function(userId, clientId) {
    const User = mongoose.model('User');
    const user = await User.findOne({
        _id: userId,
        active: true,
        internal: { $exists: false },
        deletedAt: { $exists: false },
        "memberships.client": clientId
    }).exec();

    if (!user) {
        return null;
    }

    for (const membership of user.memberships) {
        if (membership.client.equals(clientId)) {
            return {
                user: user,
                membership: membership
            };
        }
    }

    return null;
}

exports.existsUser = async function(userId, clientId) {
    const User = mongoose.model('User');
    const user = await User.findOne({
        _id: userId,
        active: true,
        internal: { $exists: false },
        deletedAt: { $exists: false },
        "memberships.client": clientId
    }).select('_id').exec();

    return !!user;
}

async function getUserFieldHelper(user, field, groupId) {
    let result = user.activeMembership[field] ? [...user.activeMembership[field]] : [];

    if (groupId) {
        const Group = mongoose.model('Group');
        const group = await Group.findOne({
            _id: groupId,
            deletedAt: { $exists: false },
            client: user.client
        }).select(field).exec();

        result = result.concat(group[field]);
    }

    return result;
}

exports.getUserFeatures = async function(user, groupId) {
    return getUserFieldHelper(user, "allowedFeatures", groupId);
}

exports.getUserDatatypes = async function(user, groupId) {
    return getUserFieldHelper(user, "allowedDatatypes", groupId);
}

exports.getUserJobtypes = async function(user, groupId) {
    return getUserFieldHelper(user, "allowedJobtypes", groupId);
}

exports.processAttributes = function(attributes) {
    let result;
    if (attributes) {
        result = new Map();

        for (const key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                result.set(key, attributes[key]);
            }
        }

        const attributesSize = JSON.stringify(result).length;
        if (attributesSize > limits.USER_CUSTOM_ATTRIBUTES_MAX_SIZE) {
            throw new ValidationError("Attributes must not exceed 100 KiB in size.");
        }
    }

    return result;
}

exports.setAttribute = async function(userId, clientId, key, value) {
    const result = await exports.getUser(userId, clientId);
    if (!result) {
        throw new ValidationError("User not found");
    }

    const { user, membership } = result;
    if (!membership.attributes)
        membership.attributes = new Map();

    membership.attributes.set(key, value);

    const attributesSize = JSON.stringify(membership.attributes).length;
    if (attributesSize > limits.USER_CUSTOM_ATTRIBUTES_MAX_SIZE) {
        throw new ValidationError("Attributes must not exceed 100 KiB in size.");
    }

    await user.save();
}

exports.clearAttribute = async function(userId, clientId, key) {
    const result = await exports.getUser(userId, clientId);
    if (!result) {
        throw new ValidationError("User not found");
    }

    const { user, membership } = result;
    if (!membership.attributes)
        return;

    if (membership.attributes.has(key)) {
        membership.attributes.delete(key);
        await user.save();
    }
}

exports.getAttribute = async function(userId, clientId, key) {
    const result = await exports.getUser(userId, clientId);
    if (!result) {
        throw new ValidationError("User not found");
    }

    const { user, membership } = result;
    if (!membership.attributes)
        return undefined;

    return membership.attributes.get(key);
}

/**
 * Checks if the user has enough quota left to add the specified data length
 * @param userId
 * @param clientId
 * @param dataLength
 * @returns {Promise<void>}
 */
exports.verifyQuota = async function(userId, clientId, dataLength) {

    const clientDefaultUserStorageQuotaGb = await clientService.getDefaultUserStorageQuota(clientId);
    if (!clientDefaultUserStorageQuotaGb)
        return;

    const result = await exports.getUser(userId, clientId);
    if (!result) {
        throw new ValidationError('Quota user not found!');
    }

    const { user, membership } = result;
    const storageQuotaGb = membership.storageQuotaGb || clientDefaultUserStorageQuotaGb;
    const GB_TO_BYTES = 1024 * 1024 * 1024;
    const storageQuota = storageQuotaGb * GB_TO_BYTES;
    const storageQuotaUsed = (membership.usedStorageQuotaGb * GB_TO_BYTES) || 0;

    if ((storageQuotaUsed + dataLength) > storageQuota)
        throw new QuotaExceededError();
}

/**
 * 
 * @param {ObjectId} clientID The ID of the client for which to fetch users
 * @param {boolean} allInfo If true, the response will include extended information about every user, even if the user is not active. Otherwise the response will only include the ID and name of active users.
 * @param {number} itemsPerPageStr How many items should be included per page.
 * @param {ObjectId} firstObjectID The first _id of the response.
 */
exports.getUsersByClient = async function(clientID, allInfo, itemsPerPageStr, firstObjectID) {
    const User = mongoose.model("User");
    const itemsPerPage = pagingTools.parseItemsPerPage(itemsPerPageStr);
    const query = User.find();

    query.where("memberships.client", clientID);
    query.where("deletedAt", {$exists: false});

    query.sort({_id: "descending"});
    // we can't use query.limit, because if allInfo is false, then we need to filter out inactive users, but if allInfo is true, we don't.
    // this means that if we set a limit now, but need to remove inactive users, then we won't fill an entire page 
    // query.limit(itemsPerPage + 1);

    if (firstObjectID !== null) {
        query.where("_id").lte(firstObjectID);
    }

    // determining the nextObjectID is complicated because the amound of data is different
    let nextObjectID = null;
    const users = await query.exec();
    const usersRet = [];

    for (const user of users) {
        if (allInfo) {
            let membership;
            for (const m of user.memberships) {
                if (m.client.equals(clientID)) {
                    membership = m;
                    break;
                }
            }
            if (membership) {
                usersRet.push({
                    _id: user._id,
                    account: user.account,
                    superadmin: user.superadmin,
                    name: user.name,
                    displayName: user.displayName,
                    client: membership.client,
                    permissions: membership.permissions,
                    admin: membership.admin,
                    active: user.active,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                });

                if (usersRet.length === itemsPerPage + 1) {
                    break;
                }
            }
        } else {
            if (user.active) {
                usersRet.push({
                    _id: user._id,
                    name: user.name
                });
                if (usersRet.length === itemsPerPage + 1) {
                    break;
                }
            }
        }
    }

    if (usersRet.length === itemsPerPage + 1) {
        nextObjectID = usersRet[itemsPerPage]._id;
        usersRet.pop();
    }

    return {
        users: usersRet,
        nextObjectID: nextObjectID
    }
}

/**
 * Queries all users and filters based on searchQuery and clientID.
 * Pagination is achieved by supplying the cursor of a previous response.
 * @param {*} searchQuery A string that needs to be part of the name of the users that are returned.
 * @param {*} groupID Only the users that belong to this group are returned, may be null.
 * @param {*} clientID Only the users that belong to this client are returned.
 * @param {*} cursor A cursor returned from a previous response to continue on the next page.
 * @param {*} itemsPerPageStr How many items should be included on one page.
 */
exports.queryUsers = async function(searchQuery, groupID, clientID, cursor, itemsPerPageStr) {
    const User = mongoose.model("User");
    const query = User.find();

    if (groupID) {
        query.where("memberships.groups", groupID);
    }

    const data = await pagingTools.paginateQuery(query, clientID, true, searchQuery, cursor, itemsPerPageStr);

    return {
        users: await data.data,
        next: data.next
    };
}

/**
 * Verifies if the requested name is valid and not already taken.
 * @param {string} requestedName The name that the user wants to have
 * @param {string} _id ID of the user that is being updated, undefined if a new users name is being verified.
 * @returns false if no error is found, otherwise a string with the error message.
 */
exports.verifyName = async function(requestedName, _id) {
    if (requestedName.toLowerCase().trim() === "system" || requestedName.toLowerCase().trim().startsWith("system@")) {
        return "User with that name is illegal"
    }

    const User = mongoose.model('User');
    const query = {
        name: requestedName,
        deletedAt: { $exists: false }
    }

    if (_id) {
        query._id = { $ne: _id };
    }

    const existingUser = await User.findOne(query);
    if (existingUser) {
        return "User with that name already exists";
    }

    return false;
}

/**
 * Verifies if the requested display name is valid and.
 * @param {*} requestedDisplayName The display name that the user wants to have
 * @returns false if no error is found, otherwise a string with the error message.
 */
exports.verifyDisplayName = async function(requestedDisplayName) {
    if (requestedDisplayName === undefined) return false;
    const trimmedName = requestedDisplayName.trim();

    if (trimmedName.length === 0) {
        return "Display name must not be empty";
    } else {
        return false;
    }
}
