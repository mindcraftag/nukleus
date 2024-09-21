"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose  = require('mongoose');

exports.init = function(log) {
    const collectionName = "User";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({

        account: String, // <- email
        password: String,

        // The name is a unique and required name of this user.
        name: { type: String, required: true },
        // The display name can optionally be set to a non-unique name.
        displayName: { type: String, required: false },

        // Location
        // --------------------------------------
        location: { type: String, required: true, default: "CHE" },
        nextLocation: { type: String, required: false },
        lastLocationSwitchAt: Date,

        // Amount of items and folders that have been moved between locations
        // --------------------------------------
        lastMovedElementsAt: Date,
        movedElementsCount: Number,

        // Flags
        // --------------------------------------
        internal: Boolean,
        waitingForApproval: Boolean,
        active: Boolean,
        superadmin: { type: Boolean, default: false },

        // Invitation
        // --------------------------------------
        invitationToken: String,        // For adding a new user by an admin
        clientInvitationToken: String,  // For users who join themselves to a client

        // Email confirmation
        // --------------------------------------
        emailToConfirm: String,
        confirmEmailToken: String,
        confirmEmailDate: Date,

        // Forgot password
        // --------------------------------------
        forgotPasswordToken: String,
        forgotPasswordAt: Date,

        // Two factor authentication
        // --------------------------------------
        twoFactorAuth: [{
            client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
            code: { type: String, required: true },
            validUntil: { type: Date, required: true },
        }],

        // Initial attributes with registration
        // --------------------------------------
        initialAttributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },

        // Memberships
        // --------------------------------------
        memberships: [{
            permissions: [String],
            admin: Boolean,
            primary: Boolean,
            groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
            contacts: [{
                addedAt: Date,
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
            }],
            client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
            paymentSetup: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentSetup', required: false },

            // Storage quota
            storageQuotaGb: Number,
            usedStorageQuotaGb: Number,

            // Traffic quota
            trafficQuotaGb: Number,
            usedTrafficQuotaBytes: Number,

            // Allowed stuff
            allowedJobtypes: [String],
            allowedDatatypes: [String],
            allowedFeatures: [String],

            // Attributes
            attributes: {
                type: Map,
                of: mongoose.Schema.Types.Mixed
            },

            // Properties defined by the client
            properties: mongoose.Schema.Types.Mixed,
        }],
        removedMemberships: [{ type: mongoose.Schema.Types.Mixed }],

        // Avatar
        // --------------------------------------
        avatar: {
            type: [{
                size: Number,
                data: String
            }],
            default: undefined
        },

        deletedAt: Date

    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({account: 1, deletedAt: 1}, {unique: true});
        schema.index({client: 1});
    };

    // -----------------------------------------------------------------------
    //  Statics
    // -----------------------------------------------------------------------
    schema.statics.existsById = async function(id) {
        return await this.model(collectionName).find({ _id: id }).limit(1).count(true) > 0;
    };

    schema.statics.existsByAccount = async function(account) {
        return await this.model(collectionName).find({ account: account }).limit(1).count(true) > 0;
    };

    // -----------------------------------------------------------------------
    //  Methods
    // -----------------------------------------------------------------------
    schema.methods.hasMembership = function(clientId) {
        if (this.superadmin) {
            return true;
        }

        for (const membership of this.memberships) {
            if (membership.client.equals(clientId)) {
                return true;
            }
        }
        return false;
    }

    schema.methods.setActiveMembership = function(requestedClientId) {
        if (requestedClientId) {
            for (const membership of this.memberships) {
                if (membership.client.equals(requestedClientId)) {
                    this.activeMembership = membership;
                    this.activeGroups = this.activeMembership.groups.map(x => x.toString());
                    this.client = membership.client;
                    return true;
                }
            }

            if (this.superadmin || this.isSystemUser()) {
                // if the user is superadmin or the system user, it does not matter if he is member.
                // if he isn't, we'll just create a temporary membership object.
                this.activeMembership = {
                    client: requestedClientId,
                    admin: true,
                    permissions: [],
                    groups: []
                };
                this.activeGroups = [];
                this.client = requestedClientId;
                return true;
            }

            return false;
        }
        else {
            for (const membership of this.memberships) {
                if (membership.primary === true) {
                    this.activeMembership = membership;
                    this.activeGroups = this.activeMembership.groups.map(x => x.toString());
                    this.client = membership.client;
                    return true;
                }
            }

            return false;
        }
    };

    schema.methods.hasPermissions = function(permissions, needsSuperadmin) {
        // For any superadmin, all permissions are always given
        if (this.superadmin)
            return true;

        // If this needs superadmin and we are obviously none, permission is denied
        if (needsSuperadmin)
            return false;

        // If no permissions are asked for, permission is granted
        if (!Array.isArray(permissions) || permissions.length === 0)
            return true;

        // Client admins also have always permission to everything that does not need superadmin rights
        if (this.activeMembership.admin)
            return true;

        // At this point, we need to check for every single asked permission
        for (const permission of this.activeMembership.permissions) {
            for (const hasPermission of permissions) {
                if (permission === hasPermission)
                    return true;
            }
        }

        return false;
    };

    schema.methods.isAdmin = function() {
        return this.activeMembership.admin || this.superadmin;
    }

    schema.methods.isSystemUser = function() {
        return this.internal && this.account.startsWith("system");
    }

    // -----------------------------------------------------------------------
    //  Eventhandler
    // -----------------------------------------------------------------------
    mongoose.model(collectionName, schema).on('index', function(err) {
        if (err) {
            log.error(`Indexing error: ${collectionName}: ${err}`);
        } else {
            log.info(`Indexing complete: ${collectionName}`);
        }
    });
}

