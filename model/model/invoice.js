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
  const collectionName = "Invoice";

  // -----------------------------------------------------------------------
  //  Schema
  // -----------------------------------------------------------------------
  const schema = new mongoose.Schema({

    number: Number,
    date: Date,     // date on the invoice
    month: Number,  // invoicing period for client invoices
    year: Number,   // invoicing period for client invoices

    invoiceTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceTemplate', required: false },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: false },

    positions: [mongoose.Schema.Types.Mixed],
    subtotalAmount: Number,
    vatAmount: Number,
    vatPercent: Number,
    totalAmount: Number,
    currency: String,

    paidAt: Date,
    failedAt: Date,
    message: String,
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,

    paymentInfo: mongoose.Schema.Types.Mixed
  }, {
    timestamps: true,
    read: 'primary'
  });

  // -----------------------------------------------------------------------
  //  Indices
  // -----------------------------------------------------------------------
  schema.statics.installIndices = function() {
    schema.index({number: 1}, {unique: true});
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

