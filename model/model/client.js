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

exports.ConversationMode = {
    AlwaysOff: 0,
    AlwaysOn: 1,
    SettablePerItem: 2
};

exports.DraftMode = {
  FOREVER: "FOREVER",
  DELETE_AFTER_GRACE: "DELETE_AFTER_GRACE",
  PUBLIC_AFTER_GRACE: "PUBLIC_AFTER_GRACE"
};

exports.init = function(log) {
    const collectionName = "Client";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({
        name: String,
        deletedAt: Date,

        // Plans
        // ----------------------------------------------------------------------
        currentPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
        nextPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: false },

        // Storages
        // ----------------------------------------------------------------------
        storages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Storage' }],

        // What can be public
        // ----------------------------------------------------------------------
        publicDownloadAllowed: { type: Boolean, default: false },
        publicQueryAllowed: { type: Boolean, default: false },
        publicConversations: { type: Boolean, default: false },
        publicLikes: { type: Boolean, default: false },
        publicCategories: { type: Boolean, default: false },
        publicLicenses: { type: Boolean, default: false },
        publicUserInfo: { type: Boolean, default: false },

        // Features enabled
        // ----------------------------------------------------------------------
        workflowsEnabled: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }],
        pluginsEnabled: [String],
        brandingAllowed: { type: Boolean, default: false },
        branding: {
            logo: String
        },
        conversationMode: Number,   // 0=always off, 1=always on, 2=settable per item
        jobtypesEnabled: [String],
        datatypesEnabled: [String],
        featuresEnabled: [String],
        jobtypesEnabledForAll: [String],
        datatypesEnabledForAll: [String],
        featuresEnabledForAll: [String],
        enabledUserAndGroupJobtypes: { type: Boolean, default: false },
        enabledUserAndGroupDatatypes: { type: Boolean, default: false },
        enabledUserAndGroupFeatures: { type: Boolean, default: false },

        // Limits
        // ----------------------------------------------------------------------
        defaultUserStorageQuotaGb: Number,
        defaultUserTrafficQuotaGb: Number,
        defaultGroupStorageQuotaGb: Number,
        defaultGroupTrafficQuotaGb: Number,

        // Access control
        // ----------------------------------------------------------------------
        acl: [{
            group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            can: [String]
        }],

        // Invitations
        // ----------------------------------------------------------------------
        invitationToken: String,
        invitationTokenEnabled: { type: Boolean, default: false },

        // Payment
        // ----------------------------------------------------------------------
        paymentSetup: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentSetup' },
        paymentLastMonthProcessed: Date,

        // Mailing
        // ----------------------------------------------------------------------
        mailerAddress: String,
        mailerName: String,

        // Drafts
        // ----------------------------------------------------------------------
        draftMode: {
            type: String,
            enum: ["FOREVER", "DELETE_AFTER_GRACE", "PUBLIC_AFTER_GRACE"],
            required: true,
            default: "FOREVER"
        },
        draftGracePeriodDays: {
            type: Number,
            required: true,
            default: 30
        },

        userPropertiesTemplate: mongoose.Schema.Types.Mixed,
    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({name: 1, deletedAt: 1}, {unique: true});
        schema.index({deletedAt: 1});
        schema.index({invitationToken: 1});
        schema.index({"invoiceGeneration.lastMonthProcessed": 1});
    };

    // -----------------------------------------------------------------------
    //  Statics
    // -----------------------------------------------------------------------
    schema.statics.existsByName = async function(name) {
        return await this.model(collectionName).find({ name: name, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
    };

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

