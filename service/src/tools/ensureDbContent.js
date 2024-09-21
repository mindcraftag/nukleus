"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose      = require('@mindcraftgmbh/nukleus-model').mongoose;
const security      = require('./security');
const folderService = require('../services/folderService');
const logger        = require('./logger');
const fileStorage   = require('../services/fileStorageService');
const jsonTools     = require('./jsonTools');
const config        = require('../config');

const DEFAULT_CLIENT_NAME = "Nukleus";
const DEFAULT_PLAN_NAME = "Internal Unlimited";

exports.clearCollection = async function(type, systemUser) {
    systemUser = systemUser || new mongoose.Types.ObjectId();
    const Type = mongoose.model(type);
    await Type.deleteMany({}, { __user: systemUser });
}

exports.importDocument = async function(data, type, systemUser) {
    systemUser = systemUser || new mongoose.Types.ObjectId();
    const Type = mongoose.model(type);

    const documents = jsonTools.parseEjson(data);
    if (!Array.isArray(documents))
        throw "data needs to be an array of objects as EJSON string";

    for (const document of documents) {
        const obj = new Type(document);
        obj.__user = systemUser;
        await obj.save({ __user: obj.createdBy ? obj.createdBy : systemUser });
    }
}

exports.exportDocuments = async function(type, indent, sortFields, filterTimestamps, convertNumberStringsToNumbers) {
    const Type = mongoose.model(type);
    const objects = await Type.find({}).lean().exec();
    const rows = [];
    for (const object of objects) {
        delete object.__v;
        rows.push(object);
    }

    return jsonTools.exportEjsonDocument(rows, sortFields, indent, filterTimestamps, convertNumberStringsToNumbers);
}

exports.createDefaultPlanIfNecessary = async function(storage) {
    const Plan = mongoose.model("Plan");
    let plan = await Plan.findOne({ name: DEFAULT_PLAN_NAME }).select('_id').exec();

    if (plan) {
        return plan;
    } else {
        plan = new Plan({
            name: DEFAULT_PLAN_NAME,
            description: "Internal plan",
            features: [],
            storages: [storage._id],
            jobtypesEnabled: [],
            datatypesEnabled: [],
            workflowsEnabled: [],
            pluginsEnabled: [],
            publicDownloadAllowed: true,
            brandingAllowed: true,
            storageQuotaGb: 1000000,
            trafficQuotaGb: 1000000,
            draftMode: "FOREVER",
            draftGracePeriodDays: 14,
            visible: false,
            defaultPlan: true,
            pricing: {
                monthlyBasePrice: 0,
                storagePricePerGb: 0,
                trafficPricePerGb: 0,
                jobInvocationPrices: new Map()
            }
        });

        await plan.save();
        logger.info(`Created default plan`);
    }

    return plan;
}

exports.createDefaultStorageIfNecessary = async function() {
    const Storage = mongoose.model("Storage");
    let storage = await Storage.findOne({}).select('_id').exec();

    if (!storage) {
        storage = new Storage({
            name: "Local FS",
            type: "FS",
            location: {
                country: "de",
                region:"europe"
            },
            config: {
                path: "filestorage"
            }
        });

        await storage.save();
        logger.info(`Created default storage`);
    }

    return storage;
}

// Always make sure there is at least one Nukleus client in the database.
exports.createNukleusClientIfNecessary = async function(defaultPlan) {
    const Client = mongoose.model("Client");
    const ClientMetrics = mongoose.model("ClientMetrics");

    let client = await Client.findOne({ name: DEFAULT_CLIENT_NAME }).select('_id').exec();

    let clientMetrics;

    if (client) {
        clientMetrics = await ClientMetrics.findOne({ client: client._id }).select('_id').exec();
    }

    if (client && clientMetrics) {
        return client;
    } else {
        if (!client) {
            const userId = new mongoose.Types.ObjectId();
            client = new Client({
                name: DEFAULT_CLIENT_NAME,
                publicDownloadAllowed: false,
                currentPlan: defaultPlan._id,
                draftMode: "FOREVER",
                draftGracePeriodDays: 14,
                address: {
                email: "admin@mndcr.com"
                },
                __user: userId
            });

            await client.save({ __user: userId });
            logger.info(`Created default client`);
        }

        if (!clientMetrics) {
            clientMetrics = new ClientMetrics({
                client: client._id,
            });
            await clientMetrics.save();
            logger.info(`Created default client metrics`);
        }
    }

    return client;
};

// Always make sure at least one admin exists in the database. If there is none, create one with a
// random password and log it
exports.createAdminIfNecessary = async function(defaultClient) {
    const User = mongoose.model('User');
    const users = await User.find({ superadmin: true }).select('_id').exec();

    if (users.length === 0) {

        const password = await security.createRandomPassword();
        const hashedPassword = security.passwordHash(password);
        const userId = new mongoose.Types.ObjectId();

        const User = mongoose.model('User');
        const user = await User.create({
            account : "admin",
            name: "Admin user",
            location: config.systemLocation,
            active: true,
            password : hashedPassword,
            superadmin: true,
            memberships: [{
                client: defaultClient._id,
                permissions: [],
                admin: true,
                primary: true
            }]
        });

        await user.save({ __user: userId });

        logger.info(`Created default admin user with password: ${password}`);
        return password;

    } else {
        logger.info("Found admin user. OK!");
        return null;
    }
};

exports.createClientSystemIfNecessary = async function(clientId) {

    const account = `system@${clientId}`;
    const User = mongoose.model('User');
    const users = await User.find({ account: account }).select('_id').exec();

    if (users.length === 0) {
        const user = new User({
            account : account,
            name: "System",
            location: config.systemLocation,
            active: true,
            internal: true,
            superadmin: false,
            memberships: [{
                client: clientId,
                permissions: [],
                admin: true,
                primary: true
            }]
        });

        await user.save({ __user: new mongoose.Types.ObjectId() });

        logger.info(`Created client system user`);
        return user._id;

    } else {
        logger.info("Found system user. OK!");
        return users[0]._id;
    }
}

// Make sure there is a system user present that is used for jobs
exports.createSystemIfNecessary = async function(defaultClient) {
    const User = mongoose.model('User');
    const users = await User.find({ account: "system" }).select('_id').exec();

    if (users.length === 0) {
        const user = new User({
            account : "system",
            name: "System",
            location: config.systemLocation,
            active: true,
            internal: true,
            superadmin: true,
            memberships: [{
                client: defaultClient._id,
                permissions: [],
                admin: true,
                primary: true
            }]
        });

        await user.save({ __user: new mongoose.Types.ObjectId() });

        logger.info(`Created system user`);
        return user._id;

    } else {
        logger.info("Found client system user. OK!");
        return users[0]._id;
    }
};

async function updateClientWhereEmpty(collectionName, userId, clientId) {
    const Collection = mongoose.model(collectionName);
    await Collection.updateMany(
        { client: null },
        { $set: { client: clientId, __user: userId } }
    ).exec();
}

// Make sure, all objects are assigned a client. If not, do it now!
exports.ensureClientIsSet = async function(defaultClient) {
    const userId = new mongoose.Types.ObjectId();
    await updateClientWhereEmpty("User", userId, defaultClient._id);
    await updateClientWhereEmpty("Item", userId, defaultClient._id);
    await updateClientWhereEmpty("Folder", userId, defaultClient._id);
    await updateClientWhereEmpty("Job", userId, defaultClient._id);
};

exports.moveFolderBetweenClients = async function(folderId, newClientId, systemUserId) {

    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');

    const folder = await Folder.findOne({ _id: new mongoose.Types.ObjectId(folderId) }).select("_id client parent").exec();

    if (folder) {
        const folderIds = [];
        const itemIds = [];

        const hierarchy = await folderService.createSubFoldersHierarchy(folderId, folder.client);
        await folderService.recursiveEnumerateFolder(hierarchy, folderIds, itemIds, folder.client);

        logger.info("Moving main folder to root level.");
        await Folder.updateMany({ _id: folderId }, { $set: { parent: null, __user: systemUserId }}).exec();

        logger.info("Moving folders to new client: " + folderIds.length);
        await Folder.updateMany({ _id: folderIds }, { $set: { client: new mongoose.Types.ObjectId(newClientId), __user: systemUserId }}).exec();

        logger.info("Moving items to new client: " + itemIds.length);
        await Item.updateMany({ _id: itemIds }, { $set: { client: new mongoose.Types.ObjectId(newClientId), __user: systemUserId }}).exec();
    }
};

exports.clearBrokenThumbnails = async function(systemUserId) {

    const Item = mongoose.model('Item');
    const items = await Item.find({ thumbnails: { $exists: true } }).exec();

    const promises = [];

    for (let item of items) {
        if (Array.isArray(item.thumbnails) && item.thumbnails.length !== 3 && item.thumbnails.length !== 0) {
            console.log(item.name, item.thumbnails);
            item.thumbnails = [];
            item.__user = systemUserId;
            promises.push(item.save({__user: systemUserId}));
        }
    }

    console.log(`Total broken thumbnails: ${promises.length}`);
    await Promise.all(promises);
}

exports.getDataConsistencyReport = async function() {
    const KeyValuePair = mongoose.model('KeyValuePair');
    return KeyValuePair.findOne({ _key: 'dataconsistencyreport' }).exec();
}

exports.cleanAdditionalFilesFromBuckets = async function() {

    const report = await exports.getDataConsistencyReport();

    function getStorage(name) {
        const storages = fileStorage.getStorages();
        for (const storage of storages) {
         if (storage.name === name)
             return storage._id;
        }

        return null;
    }

    let log = [];
    for (const storage of report.value) {
        try {
            let storageId = getStorage(storage.name);
            if (storageId) {
                log.push("Processing storage " + storage.name);
                for (const key of storage.additionalKeys) {
                    log.push("Deleting " + key);
                    await fileStorage.delete(key, storageId);
                }
            }
            else {
                log.push("Storage not found: " + storage.name);
            }
        }
        catch(err) {
            log.push("Exception: " + err.toString());
        }
    }

    log.push("Done");

    return log;

}


exports.fixUsersAsArray = async function() {

    async function fixElements(type) {
        const Element = mongoose.model(type);
        const elements = await Element.aggregate().match({ createdBy: { $type: 'array' } }).exec();

        for (const element of elements) {

            let set = {};

            if (Array.isArray(element.updatedBy))
                set['updatedBy'] = element.updatedBy[0];

            if (Array.isArray(element.createdBy))
                set['createdBy'] = element.createdBy[0];

            await Element.updateOne({ _id: element._id }, { $set: set });
            console.log(`Fixed ${type}: ${element.name}`);
        }
    }

    await fixElements("Folder");
    await fixElements("Item");
}

exports.ensureClientPaymentSetups = async function() {
    const Client = mongoose.model('Client');
    const PaymentSetup = mongoose.model('PaymentSetup');

    const clients = await Client.find({ paymentSetup: { $exists: false }}).exec();
    for (const client of clients) {
        console.log("Creating payment setup for client: " + client.name);

        const paymentSetup = new PaymentSetup({
            vatNo: client.vatNo,
            vatAmount: client.payment ? client.payment.vatAmount : 7.7,
            currency: client.payment ? client.payment.currency : "chf",
            customerId: client.payment ? client.payment.customerId : null,
            paymentMethodId: client.payment ? client.payment.paymentMethodId : null,
            cardInfo: client.payment ? client.payment.cardInfo : null,

            address: {
                name: client.address ? client.address.name : null,
                email: client.address ? client.address.email : '',
                emailToConfirm: client.address ? client.address.emailToConfirm : null,
                confirmEmailToken: client.address ? client.address.confirmEmailToken : null,
                confirmEmailDate: client.address ? client.address.confirmEmailDate : null,
                street: client.address ? client.address.street : null,
                zipcode: client.address ? client.address.zipcode : null,
                city: client.address ? client.address.city : null,
                country: client.address ? client.address.country : null
            }
        });

        await paymentSetup.save();
        client.paymentSetup = paymentSetup;
        await client.save();
    }

}

exports.ensureLinearTextureEncoding = async function() {
    const Item = mongoose.model('Item');
    const materials = await Item.find({
        type: 'Material',
        deletedAt: { $exists: false }
    }).select('name links').exec();

    console.log(`Found ${materials.length} materials.`);

    const LINK_USAGES = ["Normal", "Metalness", "Roughness"];

    const textureIdMap = new Map();
    for (const material of materials) {
        console.log(`Processing ${material.name}: ${material._id}`);
        for (const link of material.links) {
            if (LINK_USAGES.includes(link.usage)) {
                const linkToId = link.to.toString();
                if (!textureIdMap.has(linkToId)) {
                    console.log(`  Adding ${link.to} with usage ${link.usage}`);
                    textureIdMap.set(linkToId, link.to);
                } else {
                    console.log(`  Skipping ${link.to} with usage ${link.usage}`);
                }
            }
        }
    }

    const textureIds = Array.from(textureIdMap.values());
    const results = await Item.updateMany({
        _id: textureIds,
        "attributes.Encoding": "sRGB"
    }, {
        $set: { "attributes.Encoding": "Linear" }
    });

    console.log("Done");
}

exports.fixCreationDates = async function() {

    function getRandomDate(startDate, endDate) {
        const minValue = startDate.getTime();
        const maxValue = endDate.getTime();
        const timestamp = Math.floor(Math.random() * (maxValue - minValue + 1) + minValue);
        return new Date(timestamp);
    }

    const minDate = new Date(2021, 7, 22);
    const maxDate = new Date(2021, 7, 23);

    const Item = mongoose.model('Item');
    const items = await Item.find({
        createdAt: { $exists: false },
        deletedAt: { $exists: false }
    }).select("name createdAt").exec();

    for (const item of items) {
        console.log(item._id);
        const randomDate = getRandomDate(minDate, maxDate).toUTCString();
        const result = await Item.updateOne({ _id: item._id }, { createdAt: randomDate });
        console.log(result);
    }

}
