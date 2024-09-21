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

exports.DraftMode = {
  FOREVER: "FOREVER",
  DELETE_AFTER_GRACE: "DELETE_AFTER_GRACE",
  PUBLIC_AFTER_GRACE: "PUBLIC_AFTER_GRACE"
};

exports.init = function(log) {
  const collectionName = "Plan";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({
    name: String,
    description: String,
    storages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Storage' }],
    features: [String],

    // Features
    // ---------------------------------------------------------------------------
    jobtypesEnabled: [String],
    datatypesEnabled: [String],
    featuresEnabled: [String],
    workflowsEnabled: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }],
    pluginsEnabled: [String],
    publicDownloadAllowed: Boolean,
    brandingAllowed: Boolean,
    conversationsAllowed: Boolean,
    attributeTemplatesAllowed: Boolean,
    paymentEnabled: { type: Boolean, default: false },
    mailingEnabled: { type: Boolean, default: false },
    userPurchasesEnabled: { type: Boolean, default: false },
    userPurchaseProvisionPercent: { type: Number, default: 0 },

    // Quotas
    // ---------------------------------------------------------------------------
    storageQuotaGb: Number,
    trafficQuotaGb: Number,
    maxUserCount: Number,

    // Pricing
    // ---------------------------------------------------------------------------
    pricing: {
      monthlyBasePrice: Number,
      storagePricePerGb: Number,
      trafficPricePerGb: Number,
      jobInvocationPrices: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    },

    // Misc
    // ---------------------------------------------------------------------------
    visible: Boolean,
    defaultPlan: Boolean,

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
    }

  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({name: 1}, {unique: true});
  };

  // -----------------------------------------------------------------------
  //  Statics
  // -----------------------------------------------------------------------
  schema.statics.existsByName = async function(name) {
    return await this.model(collectionName).find({ name: name }).limit(1).count(true) > 0;
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

