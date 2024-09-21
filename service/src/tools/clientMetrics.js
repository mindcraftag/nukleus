"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;

const BYTES_IN_GIB = 1024 * 1024 * 1024;

exports.incPublicDownloads = async function(client, amount) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: { "metrics.publicDownloadCount": 1, "metrics.publicDownloadBytes": amount } });
};

exports.incPublicDownloadBytes = async function(client, amount) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: { "metrics.publicDownloadBytes": amount } });
};

exports.incSecureDownloads = async function(client, amount) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: { "metrics.secureDownloadCount": 1, "metrics.secureDownloadBytes": amount } });
};

exports.incSecureDownloadBytes = async function(client, amount) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: { "metrics.secureDownloadBytes": amount } });
};

exports.incUploads = async function(client, bytes) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: {
        "metrics.uploadCount": 1,
        "metrics.uploadBytes": bytes,
        "metrics.storedCount": 1,
        "metrics.storedBytes": bytes
    }});
};

exports.incStorage = async function(client, count, bytes) {
    const ClientMetrics = mongoose.model('ClientMetrics');
    await ClientMetrics.updateOne({ client: client._id }, { $inc: {
        "metrics.storedCount": count,
        "metrics.storedBytes": bytes
    }});
};

exports.verifyStorageQuota = async function(client, plan, fileSizeToAdd) {
    if (!plan)
        throw "Plan information missing.";

    const ClientMetrics = mongoose.model('ClientMetrics');
    const metricsData = await ClientMetrics.findOne({ client: client._id }).exec();

    if (!metricsData)
        throw "Metrics information missing.";

    const quotaBytes = plan.storageQuotaGb * BYTES_IN_GIB;
    const currentBytes = metricsData.metrics.storedBytes;

    return (currentBytes + fileSizeToAdd) < quotaBytes;
};

exports.verifyTrafficQuota = async function(client, plan, fileSizeToAdd) {
    if (!plan)
        throw "Plan information missing.";

    const ClientMetrics = mongoose.model('ClientMetrics');
    const metricsData = await ClientMetrics.findOne({ client: client._id }).exec();

    if (!metricsData)
        throw "Metrics information missing in client.";

    const quotaBytes = plan.trafficQuotaGb * BYTES_IN_GIB;
    const refBytes = (metricsData.refMetrics && metricsData.refMetrics.trafficBytes) ? metricsData.refMetrics.trafficBytes : 0;
    const currentBytes = metricsData.metrics.publicDownloadBytes + metricsData.metrics.secureDownloadBytes + metricsData.metrics.uploadBytes;
    const diffBytes = currentBytes - refBytes;

    return (diffBytes + fileSizeToAdd) < quotaBytes;
};
