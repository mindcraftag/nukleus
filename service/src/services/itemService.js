"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const { mongoose, ItemVisibility } = require('@mindcraftgmbh/nukleus-model');
const path                      = require('path');
const Archiver                  = require('archiver');
const unzipper                  = require('unzipper');
const moment                    = require('moment');
const common                    = require('../common');
const limits                    = require('../limits');
const config                    = require('../config');

const {
    ValidationError,
    QuotaExceededError,
    LimitExceededError
} = require('../exception');

const fileStorage               = require('./fileStorageService');
const clientService             = require("./clientService");
const folderService             = require('./folderService');
const datatypeService           = require('./datatypeService');
const spreadsheetService        = require('./spreadsheetService');
const userService               = require('./userService');
const groupService              = require('./groupService');
const licenseService            = require('./licenseService');
const categoryService           = require('./categoryService');
const attributeTemplateService  = require('./attributeTemplateService');

const verify                    = require('../tools/verify');
const fileanalysis              = require('../tools/fileanalysis');
const security                  = require("../tools/security");
const aclTools                  = require('../tools/aclTools');
const logger                    = require('../tools/logger');
const clientMetrics             = require('../tools/clientMetrics');
const streamTools               = require('../tools/streamTools');
const imageTools                = require('../tools/imageTools');
const pagingTools               = require('../tools/paging')
const hashStream                = require('../filters/hashStream');
const decryptorStream           = require('../filters/decryptorStream');
const encryptorStream           = require('../filters/encryptorStream');
const lengthCounterStream       = require('../filters/lengthCounterStream');
const contentTypeDetectorStream = require('../filters/contentTypeDetectorStream');

const THUMBNAIL_SIZE_OPTIONS = [
    {width: 128, height: 128, outputDataType: "BASE_64", quality: 90},
    {width: 64, height: 64, outputDataType: "BASE_64", quality: 90},
    {width: 32, height: 32, outputDataType: "BASE_64", quality: 90},
];

const PREVIEW_SIZE_OPTIONS = [
    {width: 1280, height: 720, outputDataType: "READABLE", quality: 90},
    {width: 640, height: 360, outputDataType: "READABLE", quality: 90},
]

exports.preChecksForUpload = function(item, client, plan) {

    if (!client) {
        throw "Cannot upload file. No client specified.";
    }

    if (!plan) {
        throw "Cannot upload file. No plan specified.";
    }

    const clientHasStorages = Array.isArray(client.storages) && client.storages.length > 0;
    const planHasStorages = Array.isArray(plan.storages) && plan.storages.length > 0;

    if (!clientHasStorages && !planHasStorages) {
        throw "Client and plan have no storages assigned. Cannot upload file!";
    }

    // Create unified list of storages of plan/client
    // ------------------------------------------------------------------------
    let storages;
    if (clientHasStorages) {
        storages = [...client.storages];
        if (planHasStorages) {
            for (const storage of plan.storages) {
                if (!storages.includes(storage))
                    storages.push(storage);
            }
        }
    } else {
        storages = plan.storages;
    }

    // Check which storage to use
    // ------------------------------------------------------------------------
    const favoredStorageId = fileStorage.getFavoredStorage(storages);

    // Create encryption key
    // ------------------------------------------------------------------------
    if (!item.encryptionKey) {
        item.encryptionKey = security.createAesSecret();
    }

    return favoredStorageId;
}

exports.uploadFile = async function(stream, item, verifyQuota, client, plan, asTemp, preferredFileName, keepExistingType, keepExistingMimeType) {

    const favoredStorageId = exports.preChecksForUpload(item, client, plan);

    // Pipe the stream through some transformers
    // ------------------------------------------------------------------------
    const hashCreator = hashStream.getHash(stream);
    const lengthCounter = lengthCounterStream.getStreamLength(hashCreator.stream);
    const contentTypeDetection = !keepExistingMimeType ? contentTypeDetectorStream.getContentType(lengthCounter.stream, preferredFileName || item.filename) : lengthCounter;
    const encryptor = encryptorStream.encryptStream(contentTypeDetection.stream, item.encryptionKey);
    const outputStream = encryptor.stream;

    // Pipe the stream over to filestorage
    // Add the prefix "temp_" if this file is supposed to be uploaded as a temporary file.
    // ------------------------------------------------------------------------
    const fileStorageKey = (asTemp === true ? "temp_" : "") + item._id.toString();
    await fileStorage.upload(fileStorageKey, outputStream, favoredStorageId);

    // Store values in item
    // ------------------------------------------------------------------------
    const filesize = await lengthCounter.promise;

    if (verifyQuota) {
        if (!(await clientMetrics.verifyStorageQuota(client, plan, filesize))) {
            throw new QuotaExceededError();
        }
    }

    item.filesize = filesize;
    item.hash = await hashCreator.promise;
    if (!keepExistingMimeType) {
        item.mimeType = await contentTypeDetection.promise;
    }
    item.storages = [favoredStorageId];

    if (!keepExistingType)
        item.type = await exports.findItemType(item.mimeType);

    // Increase metrics
    // ------------------------------------------------------------------------
    await clientMetrics.incUploads(item.client, item.filesize);
}

exports.addAttachment = async function(item, stream, name, index, verifyQuota, req, client, plan) {

    const favoredStorageId = exports.preChecksForUpload(item, client, plan);

    // Pipe the stream through some transformers
    // ------------------------------------------------------------------------
    const hashCreator = hashStream.getHash(stream);
    const lengthCounter = lengthCounterStream.getStreamLength(hashCreator.stream);
    const contentTypeDetection = contentTypeDetectorStream.getContentType(lengthCounter.stream, "");
    const encryptor = encryptorStream.encryptStream(contentTypeDetection.stream, item.encryptionKey);
    const outputStream = encryptor.stream;

    // Pipe the stream over to filestorage
    // ------------------------------------------------------------------------
    const fileStorageKey = item._id.toString() + "_" + name + "_" + index;
    await fileStorage.upload(fileStorageKey, outputStream, favoredStorageId);

    // Verify quota
    // ------------------------------------------------------------------------
    const filesize = await lengthCounter.promise;
    const hash = await hashCreator.promise;
    const mimeType = await contentTypeDetection.promise;

    if (verifyQuota) {
        if (!req) {
            throw "req not filled. Cannot verify quota.";
        }
        if (!(await clientMetrics.verifyStorageQuota(req, filesize))) {
            throw new QuotaExceededError();
        }
    }

    // Check if we already have attachment with that name and index and if so, get it
    // ------------------------------------------------------------------------
    let attachment;
    if (Array.isArray(item.attachments)) {
        for (const a of item.attachments) {
            if (a.name === name && a.index === index) {
                attachment = a;
                break;
            }
        }
    } else {
        item.attachments = [];
    }

    // If we don't have it already, create it
    // ------------------------------------------------------------------------
    if (!attachment) {
        attachment = {
            name: name,
            index: index,
            filesize: filesize,
            hash: hash,
            mimeType: mimeType,
            storages: [favoredStorageId]
        };

        item.attachments.push(attachment);
    } else {
        // Now check for the case that we're overwriting an existing attachment, if hash changed
        // and if so, set all important fields for the attachment. If it is still the same, we
        // don't have to do anything
        // ------------------------------------------------------------------------
        if (hash !== attachment.hash) {
            if (attachment.storages.length !== 1 || !attachment.storages[0].equals(favoredStorageId)) {
                attachment.storageHash = undefined;
                attachment.storages = [favoredStorageId];
            }

            attachment.filesize = filesize;
            attachment.mimeType = mimeType;
            attachment.hash = hash;
        }
    }

    // Increase metrics
    // ------------------------------------------------------------------------
    await clientMetrics.incUploads(item.client, filesize);
}

exports.findItemType = async function(contentType) {
    const DataType = mongoose.model("DataType");

    let dataType = await DataType.findOne({ contentTypes: contentType }).exec();
    if (dataType) {
        return dataType.name;
    }

    dataType = await DataType.findOne({ contentTypes: "*" }).exec();
    if (dataType) {
        return dataType.name;
    }

    return null;
};

exports.matchesContentType = async function(type, contentType) {
    const DataType = mongoose.model("DataType");
    const dataType = await DataType.findOne({name: type }).exec();
    if (dataType && (dataType.contentTypes.includes("*") || dataType.contentTypes.includes(contentType))) {
        return true;
    }
    return false;
};

exports.setContentTypeAndHash = async function(item, buffer) {
    const contentType = await fileanalysis.getContentType(buffer);

    const DataType = mongoose.model("DataType");
    const dataType = await DataType.findOne({ name: item.type }).exec();

    if (dataType && (dataType.contentTypes.includes("*") || dataType.contentTypes.includes(contentType))) {
        const hash = security.sha256(buffer);

        item.mimeType = contentType;
        item.hash = hash;
        item.filesize = buffer.length;
    }
    else
        throw "Content type not supported by this datatype";
};

exports.findItems = async function(idArray, user, client, requiredPermission, selectFields, recursive, inSubfolders, itemCache, folderCache, rootFolder) {

    if (recursive) {
        if (!itemCache) {
            // We're doing a recursive search. Create a map of all IDs in the array
            // to make sure we're not visiting them again while recursing through the links
            itemCache = new Map();
            for (const id of idArray) {
                itemCache.set(id.toString(), true);
            }
        } else {
            // We're doing recursion and are already having a cache map. so Check the new IDs against that to make
            // sure they're not in there already and if so, filter them.
            const filteredIds = [];
            for (const id of idArray) {
                if (!itemCache.has(id.toString())) {
                    itemCache.set(id.toString(), true);
                    filteredIds.push(id);
                }
            }
            idArray = filteredIds;
        }

        if (!folderCache) {
            folderCache = new Map();
        }
    }

    // Fetch all remaining Item IDs from mongoDB
    // -------------------------------------------------------------------------
    const Item = mongoose.model('Item');
    const items = await Item.find({
        _id: idArray,
        client: client,
        deletedAt: { $exists: false }
    }).select(selectFields).exec();

    if (items.length === 0) {
        return [];
    }

    if (inSubfolders && rootFolder === undefined) {
        rootFolder = items[0].folder || null;
    }

    // Now filter the items based on whether they are in the jail root folder or not
    // -------------------------------------------------------------------------
    let filteredItems = [];
    if (inSubfolders && rootFolder !== null) {
        for (const item of items) {

            // if the item is in the root folder, it will be filtered since the new rootFolder is by definition somewhere below
            if (!item.folder)
                continue;

            // if we have the item's folder ID in our cache, check the result directly and we're done
            const folderId = item.folder.toString();
            if (folderCache.has(folderId)) {
                if (folderCache.get(folderId) === true)
                    filteredItems.push(item);

                continue;
            }

            const parents = await folderService.getFolderParents(item.folder, client);
            let found = false;
            for (const parent of parents) {
                if (rootFolder.equals(parent._id)) {
                    found = true;
                    break;
                }
            }

            folderCache.set(folderId, found);
            if (found)
                filteredItems.push(item);
        }
    } else {
        filteredItems = items;
    }

    // Filter the selecting Items by ACLs so we do not return anything, the user may not see
    // -------------------------------------------------------------------------
    filteredItems = await aclTools.filterElements(filteredItems, user, requiredPermission, false);

    // If we're doing recursion, go through all links in the items and build a new Item ID Array and call this function again
    // -------------------------------------------------------------------------
    if (recursive) {
        const childItemIdMap = new Map();

        for (const item of filteredItems) {
            for (const linkItem of item.links) {
                const id = linkItem.to.toString();
                if (!childItemIdMap.has(id)) {
                    childItemIdMap.set(linkItem.to, true);
                }
            }
        }

        const childItemIds = Array.from(childItemIdMap.keys());
        if (childItemIds.length) {
            const filteredChildItems = await exports.findItems(childItemIds, user, client, requiredPermission, selectFields, recursive, inSubfolders, itemCache, folderCache, rootFolder)
            return [...filteredItems, ...filteredChildItems];
        }
    }

    return filteredItems;
}

exports.updateItems = async function(idArray, user, client, userObjectId, setFields, requiredPermission, recursive, inSubfolders) {

    if (inSubfolders && idArray.length > 1) {
        throw new ValidationError("If a query in subfolders is requested, there must be only a single Item ID to be processed which folder is used as root.")
    }

    const fields = "_id name acl folder" + (recursive ? " links": "");
    const filteredItems = await exports.findItems(idArray, user, client, requiredPermission, fields, recursive, inSubfolders);

    //console.log(filteredItems);
    //return filteredItems.length;

    const filteredIdArray = filteredItems.map(x => x._id);

    setFields.updatedBy = userObjectId;

    // set requested fields on all items
    const Item = mongoose.model('Item');
    await Item.updateMany({
        _id: filteredIdArray,
        client: client
    }, {
        $set: setFields
    }, {
        __user: userObjectId
    }).exec();

    return filteredIdArray.length;
};

/**
 * Checks if the item exists by its ID and client ID
 * @param id
 * @param clientId
 * @return {Promise<*>}
 */
exports.existsItem = async function(id, clientId) {
    const Item = mongoose.model('Item');
    return Item.existsByIdAndClient(id, clientId);
}

exports.getItemByIdAndClient = async function(id, client) {
    const Item = mongoose.model('Item');

    const query = Item.findOne();
    query.where("client").equals(client);
    query.where("deletedAt").exists(false);
    query.where("_id").equals(id);

    return query.exec();
}

exports.getItem = async function(id, req) {
    const Item = mongoose.model('Item');
    const query = Item.findOne();

    if (req && !req.isSystemUser)
        query.where("client").equals(req.user.client);

    query.where("deletedAt").exists(false);
    query.where("_id").equals(id);

    return query.exec();
};

exports.getItemsByIdArray = async function(idArray, client) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    aggregate.match({ deletedAt: { $exists: false }});
    aggregate.match({ client: client });
    aggregate.match({ _id: { $in: idArray }});

    aggregate.project({ name: 1, folder: 1, visibility: 1, filesize: 1, client: 1, acl: 1,
        createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1, packageType: 1,
        links: 1, hash: 1, mimeType: 1, type: 1, thumbnailCount: { $size: { $ifNull: ['$thumbnails', []] }}});

    const items = await aggregate.exec();
    return items;
};

exports.getItemFieldsByIdArray = async function(idArray, client, select) {
    const Item = mongoose.model('Item');
    const query = Item.find();

    query.where("deletedAt").exists(false);
    query.where("client").equals(client);
    query.where("_id").in(idArray);

    if (select)
        query.select(select);

    const items = await query.exec();
    return items;
};

exports.isItemInArray = function(items, id) {
    for (const item of items) {
        if (item._id.equals(id))
            return true;
    }
    return false;
};

exports.getItemDependencies = async function(itemId, client, fields, itemMap) {

    if (!itemMap)
        itemMap = new Map();

    const Item = mongoose.model('Item');
    const item = await Item.findOne({ _id: itemId, client: client, deletedAt: { $exists: false }}).select('links ' + fields).exec();

    if (item) {
        itemMap.set(itemId.toString(), item);

        if (Array.isArray(item.links)) {
            for (const link of item.links) {
                if (!itemMap.has(link.to.toString()))
                    await exports.getItemDependencies(link.to, client, fields, itemMap);
            }
        }
    }

    return itemMap;
};

exports.getItemLinks = async function(id, client) {
    const Item = mongoose.model('Item');
    const query = Item.findOne();

    query.where("deletedAt").exists(false);
    query.where("client").equals(client);
    query.where("_id").equals(id);

    const item = await query.select("id links").exec();
    return item;
};

exports.linksEqual = function(links1, links2) {

    if (links1.length !== links2.length)
        return false;

    for (const link1 of links1) {
        let found = false;
        for (const link2 of links2) {
            if (link1.usage === link2.usage && link1.to.toString() === link2.to.toString()) {
                found = true;
                break;
            }
        }
        if (!found)
            return false;
    }

    return true;
};

exports.getAggregated = async function(id, client, isSystemUser, options) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    if (!isSystemUser)
        aggregate.match({"client": client });

    aggregate.match({"deletedAt": { $exists: false }});

    let additionalFields = options.noThumbnails ? "" : " thumbnails"
    if (options.fetchUserAttributeTemplate)
        additionalFields += " userAttributeTemplate";

    if (options.withAttachmentInfo)
        additionalFields += " attachments.name attachments.index attachments.filesize attachments.hash attachments.mimeType"

    if (options.withStats)
        additionalFields += " counts";

    const items = await aggregate.match( {
            _id: id
        }).lookup({
            from: 'users', localField: 'createdBy', foreignField: '_id', as: 'createdByUser'
        }).lookup({
            from: 'users', localField: 'updatedBy', foreignField: '_id', as: 'updatedByUser'
        }).lookup({
            from: 'folders', localField: 'folder', foreignField: '_id', as: 'folder'
        })
        .unwind({
            path :'$createdByUser',
            preserveNullAndEmptyArrays: true
        })
        .unwind({
            path :'$updatedByUser',
            preserveNullAndEmptyArrays: true
        })
        .unwind({
            path :'$folder',
            preserveNullAndEmptyArrays: true
        })
        .project("_id links name description shortDescription version tags flags contributors visibility type packageType folder.name folder._id createdAt " +
            "updatedAt createdBy updatedBy createdByUser.name updatedByUser.name " +
            "filename filesize mimeType properties attributes userAttributes categories quotaUser quotaGroup " +
            "hash acl autoDestructAt client allowConversation conversation license itemSize totalSize __v" + additionalFields
        )
        .exec();

    if (items.length) {
        // Set folders to at least null in case they are undefined or ACL tests will throw an error
        for (const item of items) {
            if (item.folder === undefined)
                item.folder = null;
        }

        let item = items[0];

        if (options.withFieldInstances || !options.noUserAttributes || !options.noFields) {
            const { fields, fieldSets } = await exports.getDataTypeFieldsAndFieldSets(item.type);
            let userFields = [];

            if (item.userAttributeTemplate) {
                userFields = await exports.getAttributeTemplateFields(item.userAttributeTemplate);
            }

            if (!options.noFields) {
                item.fields = fields;
                item.fieldSets = fieldSets;
                item.userFields = userFields;
            }

            if (options.withFieldInstances) {
                item.fieldInstances = exports.createFieldInstances(fields, fieldSets, item.attributes, item.links);
                item.userFieldInstances = exports.createFieldInstances(userFields, fieldSets, item.userAttributes, item.links);
            }
        }

        if (options.noAttributes) {
            item.attributes = undefined;
        }

        if (options.noUserAttributes) {
            item.userAttributes = undefined;
        }

        if (options.noLinks) {
            item.links = undefined;
        }

        return item;
    }

    return null;
};

exports.getPublicAggregated = async function(id, options) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    aggregate.match({"visibility": { $gte: 2 }});
    aggregate.match({"deletedAt": { $exists: false }});

    let additionalFields = options.noThumbnails ? "" : " thumbnails"

    if (options.withAttachmentInfo)
        additionalFields += " attachments.name attachments.index attachments.filesize attachments.hash attachments.mimeType"

    if (options.withStats)
        additionalFields += " counts";

    const items = await aggregate.match( {
            _id: id
        })
        .lookup({
            from: 'users', localField: 'createdBy', foreignField: '_id', as: 'createdByUser'
        })
        .lookup({
            from: 'users', localField: 'updatedBy', foreignField: '_id', as: 'updatedByUser'
        })
        .lookup({
            from: 'clients', localField: 'client', foreignField: '_id', as: 'client'
        })
        .lookup({
            from: 'folders', localField: 'folder', foreignField: '_id', as: 'folder'
        })
        .unwind({
            path :'$createdByUser',
            preserveNullAndEmptyArrays: true
        })
        .unwind({
            path :'$updatedByUser',
            preserveNullAndEmptyArrays: true
        })
        .unwind({
            path :'$client'
        })
        .unwind({
            path :'$folder',
            preserveNullAndEmptyArrays: true
        })
        .lookup({
            from: 'plans', localField: 'client.currentPlan', foreignField: '_id', as: 'plan'
        })
        .unwind({
            path :'$plan'
        })
        .project("_id links name description tags contributors type packageType folder.name folder._id createdAt " +
            "updatedAt createdBy updatedBy createdByUser.name updatedByUser.name " +
            "filename filesize mimeType properties attributes userAttributes userAttributeTemplate categories quotaUser quotaGroup " +
            "hash client plan allowConversation conversation license itemSize totalSize __v" + additionalFields
        )
        .exec();

    if (items.length) {
        let item = items[0];

        if (options.withFieldInstances || options.withUserAttributes || !options.noFields) {
            const { fields, fieldSets } = await exports.getDataTypeFieldsAndFieldSets(item.type);
            let userFields = [];

            if (item.userAttributeTemplate) {
                userFields = await exports.getAttributeTemplateFields(item.userAttributeTemplate);
            }

            if (!options.noFields) {
                item.fields = fields;
                item.fieldSets = fieldSets;
                item.userFields = userFields;
            }

            if (options.withFieldInstances) {
                item.fieldInstances = exports.createFieldInstances(fields, fieldSets, item.attributes, item.links);
                item.userFieldInstances = exports.createFieldInstances(userFields, fieldSets, item.userAttributes, item.links);
            }
        }

        if (options.noAttributes) {
            item.attributes = undefined;
        }

        if (options.noUserAttributes) {
            item.userAttributes = undefined;
        }

        if (options.noLinks) {
            item.links = undefined;
        }

        return item;
    }

    return null;
};

exports.getLinkId = function(usage, links) {
    if (Array.isArray(links)) {
        for (const link of links) {
            if (link.usage === usage) {
                return link.to;
            }
        }
    }
    return null;
}

exports.createUserAttributes = function(fields, attributes) {
    const result = [];

    // TODO

    return result;
}

exports.existsBlockNamespace = function(attributes, namespace) {
    if (attributes) {
        for (const attributeName in attributes) {
            if (attributes.hasOwnProperty(attributeName)) {
                if (attributeName.startsWith(namespace))
                    return true;
            }
        }
    }
    return false;
}

exports.createFields = function(attributes, links, template, blockPath) {
    let fields = JSON.parse(JSON.stringify(template));

    for (const field of fields) {
        if (field.name) {
            const fieldPath = `${blockPath}->${field.name}`;
            let isLink = false;

            switch (field.type) {
                case "Link":
                    if (blockPath) {
                        field.value = this.getLinkId(fieldPath, links);
                    } else {
                        field.value = null;
                    }
                    isLink = true;
                    break;

                case "Attribute": {
                    if (blockPath) {
                        field.value = attributes[fieldPath];
                        if (field.value === undefined) {
                            field.value = field.defaultValue;
                        }
                    } else {
                        field.value = field.defaultValue;
                    }
                    break;
                }
            }
        }
    }

    return fields;
}

exports.readBlockForTree = function(attributes, links, templates, treePath) {
    const blocks = [];

    let listIndex = 0;
    while(true) {
        const blockPath = `${treePath}[${listIndex}]`;

        if (exports.existsBlockNamespace(attributes, blockPath)) {
            const typePath = `${blockPath}#type`;
            const typeName = attributes[typePath];

            for (const templateEntry of templates) {
                if (templateEntry.typeName === typeName) {
                    blocks.push({
                        name: templateEntry.typeName,
                        fields: exports.createFields(attributes, links, templateEntry.template, blockPath),
                        blocks: exports.readBlockForTree(attributes, links, templates, blockPath)
                    });
                    break;
                }
            }
        } else {
            break;
        }
        listIndex++;
    }

    return blocks;
}

exports.readBlocksForList = function(attributes, links, template, listPath) {
    const blocks = [];

    let listIndex = 0;
    while(true) {
        const blockPath = `${listPath}[${listIndex}]`;

        if (exports.existsBlockNamespace(attributes, blockPath)) {
            blocks.push(exports.createFields(attributes, links, template, blockPath));
        } else {
            break;
        }
        listIndex++;
    }

    return blocks;
}

exports.getFieldSet = function(fieldSets, name) {
    if (Array.isArray(fieldSets)) {
        for (const fieldSet of fieldSets) {
            if (fieldSet.name === name)
                return fieldSet;
        }
    }

    return null;
}

exports.createFieldInstances = function(fields, fieldSets, attributes, links, path) {
    const result = [];

    path = path || "";
    const pathWithArrow = path.length ? `${path}->` : path;

    // Replace field set entries with their fields first
    // ---------------------------------------------------------------
    for (let i=0; i<fields.length; i++) {
        const field = fields[i];
        if (field.type === "FieldSet") {
            const fieldSet = exports.getFieldSet(fieldSets, field.name);
            if (fieldSet) {
                fields.splice(i, 1, ...structuredClone(fieldSet.fields));
                i+=fieldSet.fields.length-1;
            } else {
                console.error("Fieldset not found: " + field.name);
            }
        }
    }

    for (const field of fields) {
        switch (field.type) {
            case "Separator": {
                result.push({
                    type: "Separator",
                    name: "Separator",
                    displayName: field.label,
                });
                break;
            }

            case "Link": {
                result.push({
                    type: "Link",
                    name: field.usageAs,
                    displayName: field.displayName || field.usageAs,
                    value: exports.getLinkId(field.usageAs, links),
                    linkableTypes: field.linkableTypes
                })
                break;
            }

            case "Tree": {
                const treePath = `${pathWithArrow}${field.name}`;

                const templates = [];
                for (const childType of field.childTypes) {
                    templates.push({
                        typeName: childType.typeName,
                        template: exports.createFieldInstances(childType.fields, fieldSets, attributes, links, treePath)
                    });
                }

                const rootBlock = {
                    name: "/",
                    blocks: exports.readBlockForTree(attributes, links, templates, treePath)
                };

                result.push({
                    type: "Tree",
                    name: field.name,
                    displayName: field.displayName || field.name,
                    blocks: [rootBlock],
                    templates: templates
                });

                break;
            }

            case "List": {
                const listPath = `${pathWithArrow}${field.name}`;
                const template = exports.createFieldInstances(field.fields, fieldSets, attributes, links, listPath);
                const blocks = exports.readBlocksForList(attributes, links, template, listPath);

                result.push({
                    type: "List",
                    name: field.name,
                    displayName: field.displayName || field.name,
                    blocks: blocks,
                    templates: [template]
                });

                break;
            }

            case "Attribute": {
                let value = attributes ? attributes[field.name] : undefined;
                if (value === undefined) {
                    value = field.defaultValue;
                }

                result.push({
                    type: "Attribute",
                    name: field.name,
                    displayName: field.displayName || field.name,
                    defaultValue: field.defaultValue,
                    value: value,
                    datatype: field.datatype,
                    minValue: field.minValue,
                    maxValue: field.maxValue,
                    options: field.options,
                    language: field.language,
                    widget: field.widget,
                    length: field.length
                });

                break;
            }
        }
    }

    return result;
}

exports.getAggregatedRecursive = async function(id, client, isSystemUser, options, idList) {
    idList = idList || [];
    idList.push(id.toString());

    let item = await exports.getAggregated(id, client, isSystemUser, options);
    if (item) {
        const promises = [];

        for (let link of item.links) {
            if (!idList.includes(link.to.toString())) {
                if (!link.stopRecursion) {
                    promises.push(exports.getAggregatedRecursive(link.to, client, isSystemUser, options, [...idList]).then(function (item) {
                        link.item = item;
                    }));
                }
            }
            else {
                logger.warn("Found cycle in item. Not continuing to recurse down!");
            }
        }

        await Promise.all(promises);
    }
    return item;
};

exports.getPublic = async function(id, publicDownloadAllowed) {
    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    aggregate.match({_id: id});
    aggregate.match({"visibility": { $gte: 2 }});
    aggregate.match({"deletedAt": { $exists: false }});
    aggregate.project({ encryptionKey: 0, storages: 0, storageHash: 0, acl: 0,
        "attachments._id": 0, "attachments.storages": 0, "attachments.storageHash": 0});

    let item = await aggregate.exec();

    if (!item.length) {
        return null;
    }
    else {
        item = item[0];
        if (publicDownloadAllowed || await clientService.publicDownloadAllowed(item.client)) {
            return item;
        } else {
            return null;
        }
    }
};

exports.getDataTypeFieldsAndFieldSets = async function(name) {
    const DataType = mongoose.model("DataType");
    const dataType = await DataType.findOne({ name: name }).exec();

    if (dataType) {
        // We call .toObject() on the fields to get a normal JSON object,
        // otherwise this might cause issues when serializing.
        const fields = dataType.fields.toObject();
        const fieldSets = dataType.fieldSets ? dataType.fieldSets.toObject() : [];
        return { fields, fieldSets };
    }

    return { fields: [], fieldSets: [] };
};

exports.getAttributeTemplateFields = async function(id) {
    const AttributeTemplate = mongoose.model("AttributeTemplate");
    const attributeTemplate = await AttributeTemplate.findOne({ _id: id }).exec();

    if (attributeTemplate) {
        return attributeTemplate.fields;
    }

    return [];
};

exports.getPublicRecursive = async function(id, publicDownloadAllowed, idList) {
    idList = idList || [];
    idList.push(id.toString());

    let item = await exports.getPublic(id, publicDownloadAllowed);

    if (item) {
        const { fields, fieldSets } = await exports.getDataTypeFieldsAndFieldSets(item.type);
        item.fields = fields;
        item.fieldSets = fieldSets;

        if (publicDownloadAllowed === undefined) {
            publicDownloadAllowed = await clientService.publicDownloadAllowed(item.client);
        }

        for (let link of item.links) {
            if (!idList.includes(link.to.toString())) {
                if (!link.stopRecursion)
                    link.item = await exports.getPublicRecursive(link.to, publicDownloadAllowed, [...idList]);
            }
            else {
                logger.warn("Found cycle in item. Not continuing to recurse down!");
            }
        }
    }

    return item;
};

exports.findAttachment = function(item, name, index) {
    for (const attachment of item.attachments) {
        if (attachment.name === name && attachment.index === index) {
            return attachment;
        }
    }

    return null;
}

exports.download = async function(req, res, item, isPublic, attachment) {

    if (isPublic && !await clientService.publicDownloadAllowed(item.client)) {
        res.status(404).json({
            result: "failed",
            error: "Item not found"
        });
    } else {
        let range = req.headers.range;
        if (range) {
            range = exports.parseRange(attachment || item, range);
        }

        const size = await exports.handleDownload(req, res, item, range, attachment);
        if (size > 0) {
            if (isPublic)
                await clientMetrics.incPublicDownloads(item.client, size);
            else
                await clientMetrics.incSecureDownloads(item.client, size);
        }
    }
}

exports.parseRange = function(item, range) {
    const parts = range.replace(/bytes=/, "").split("-");
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : item.filesize-1;
    if (start < 0) start = 0;
    if (end < 0) end = 0;
    if (start > end) start = end;
    if (end > item.filesize-1) end = item.filesize-1;
    if (start > item.filesize-1) start = item.filesize-1;
    const chunksize = (end-start)+1;

    return {
        chunksize: chunksize,
        start: start,
        end: end
    };
}

exports.getClientAndPlan = async function(req, item) {

    let client;
    let plan;

    if (req && req.client && req.plan) {
        client = req.client;
        plan = req.plan;
    } else {
        const Client = mongoose.model('Client');
        const ClientMetrics = mongoose.model('ClientMetrics');
        client = await Client.findOne({ _id: item.client, deletedAt: { $exists: false } }).select("currentPlan").exec();
        const clientMetrics = await ClientMetrics.findOne({ client: item.client }).exec();
        client.metrics = clientMetrics.metrics;

        const Plan = mongoose.model('Plan');
        plan = await Plan.findOne({ _id: client.currentPlan }).exec();
    }

    return {
        client: client,
        plan: plan
    };
}

exports.verifyQuota = async function(req, res, client, plan, size) {
    if (!req || !req.isSystemUser) {
        if (!(await clientMetrics.verifyTrafficQuota(client, plan, size))) {
            res.status(403);
            res.json({
                result: "failed",
                error: "Quota exceeded"
            });
            return false;
        }
    }

    return true;
}

exports.buildDownloadHeaders = function(object, range) {
    let exposeHeaders = [];
    let headers = {
        'Access-Control-Expose-Headers': ''
    };

    if (object.mimeType)
        headers['Content-Type'] = object.mimeType;
    else
        headers['Content-Type'] = "application/octet-stream";

    if (object.hash) {
        headers['SHA256-Hash'] = object.hash;
        exposeHeaders.push('SHA256-Hash');
    }

    if (range) {
        headers['Content-Length'] = range.chunksize;
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${object.filesize}`;
        headers['Accept-Ranges'] = 'bytes';
    } else {
        headers['Content-Length'] = object.filesize;

        if (object.filename) {
            headers["Content-Disposition"] = `attachment; filename=\"${encodeURIComponent(object.filename)}\"`;
        }
    }

    if (object.name) {
        headers['Nukleus-Itemname'] = encodeURIComponent(object.name);
        exposeHeaders.push('Nukleus-Itemname');
    }

    if (object.type) {
        headers['Nukleus-Itemtype'] = object.type;
        exposeHeaders.push('Nukleus-Itemtype');
    }

    if (exposeHeaders.length)
        headers['Access-Control-Expose-Headers'] = exposeHeaders.join(', ');

    return headers;
}

exports.handleDownload = async function(req, res, item, range, attachment) {

    const { client, plan } = await exports.getClientAndPlan(req, item);

    // Get storage key and info
    // -----------------------------------------------------------------------------------------------------
    let key = item._id.toString();
    let downloadableObject = attachment || item;
    let downloadSize = range ? range.chunksize : downloadableObject.filesize;

    if (attachment)
        key += `_${attachment.name}_${attachment.index}`;

    // Verify quota
    // -----------------------------------------------------------------------------------------------------
    if (!(await exports.verifyQuota(req, res, client, plan, downloadSize)))
        return 0;

    const head = exports.buildDownloadHeaders(downloadableObject, range);

    let retrieveStart = undefined;
    let retrieveEnd = undefined;
    let offset = undefined;
    let length = undefined;

    const AES_BLOCKSIZE = 16;

    if (range) {

        // In case we use encryption, data can only be decrypted in blocks of 32 bytes. So we might need to
        // download more than what was requested and then crop the resulting data.
        // -----------------------------------------------------------------------------------------------------
        retrieveStart = range.start;
        retrieveEnd = range.end;
        offset = 0;
        length = (range.end - range.start) + 1;

        if (item.encryptionKey) {
            if ((retrieveStart % AES_BLOCKSIZE) !== 0) {
                retrieveStart = Math.floor(retrieveStart / AES_BLOCKSIZE) * AES_BLOCKSIZE;
                offset = range.start - retrieveStart;
            }
            if ((retrieveEnd % AES_BLOCKSIZE) !== 0) {
                retrieveEnd = Math.ceil(retrieveEnd / AES_BLOCKSIZE) * AES_BLOCKSIZE;
            }
        }
    }

    // Retrieve the data from storage
    // -----------------------------------------------------------------------------------------------------
    const download = await fileStorage.download(key, downloadableObject.storages, retrieveStart, retrieveEnd);
    const stream = download.stream;
    stream.on("error", function(err) {
        res.end();
    });

    // Decrypt the stream if needed
    // -----------------------------------------------------------------------------------------------------
    if (range)
        res.writeHead(206, head);
    else
        res.writeHead(200, head);

    if (item.encryptionKey) {
        let counter = undefined;
        if (range)
            counter = retrieveStart / AES_BLOCKSIZE;

        const decryptor = decryptorStream.decryptStream(stream, item.encryptionKey, counter, offset, length);
        decryptor.stream.on("error", function(err) {
            logger.error(err);
            res.end();
        });
        decryptor.stream.pipe(res);
    } else {
        stream.pipe(res);
    }

    res.on('close', function() {
        download.abortFunc();
    });

    return downloadSize;
};

exports.createThumbnails = async function(stream) {
    const thumbnails = await imageTools.generateResizedImagesFromStream(stream, THUMBNAIL_SIZE_OPTIONS);
    const thumbnailsWithSize = thumbnails.map((thumbnail) => ({size: thumbnail.width, data: thumbnail.data}));

    return thumbnailsWithSize;
}

exports.createThumbnailsAndPreviews = async function(stream) {
    const images = await imageTools.generateResizedImagesFromStream(stream, [...THUMBNAIL_SIZE_OPTIONS, ...PREVIEW_SIZE_OPTIONS]);

    const thumbnails = images.slice(0, THUMBNAIL_SIZE_OPTIONS.length);
    const previews = images.slice(THUMBNAIL_SIZE_OPTIONS.length);

    // the thumbnails are squared, so lets just pick the width for the size
    const thumbnailsWithSize = thumbnails.map((thumbnail) => ({size: thumbnail.width, data: thumbnail.data}));
    const previewData = previews.map(preview => preview.data);

    return {
        thumbnails: thumbnailsWithSize,
        previews: previewData
    }

}

exports.createLodLevels = async function(stream) {
    const buffer = await streamTools.streamToBuffer(stream);
    const sizes = [];
    const AMOUNT_LOD_LEVELS = 2; // max amount of generated lod levels (og image not included)

    let lodCount = 0;
    let {width, height} = await imageTools.getDimensionsFromBuffer(buffer);

    while (true) {
        if (lodCount >= AMOUNT_LOD_LEVELS) {
            break;
        }

        width = Math.round(width/4);
        height = Math.round(height/4);

        if (width <= 16 || height <= 16) {
            break;
        }

        sizes.push({
            width,
            height,
        })

        lodCount++;
    }

    const lodLevelsWithSize = await imageTools.generateResizedImagesFromBuffer(buffer, sizes);
    const lodLevels = lodLevelsWithSize.map(lodLevelWithSize => lodLevelWithSize.data)

    return lodLevels;
};

exports.addIndexedAttachments = async function(item, attachments, attachmentName, req) {
    const promises = [];

    for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const promise = exports.addAttachment(item, attachment, attachmentName, i, false, req, req.client, req.plan);

        promises.push(promise);
    }

    await Promise.all(promises);
}

exports.getFolderItemsListRecursive = async function(folderId, userId, clientId, results, additionalFields, filesOnly, foldersPathMap) {
    const Item = mongoose.model('Item');
    const Folder = mongoose.model('Folder');

    const folders = await Folder.find({ client: clientId, parent: folderId, deletedAt: { $exists: false } }).select("name").exec();
    for (const folder of folders) {
        await exports.getFolderItemsListRecursive(folder._id, userId, clientId, results, additionalFields, filesOnly, foldersPathMap);
    }

    let fields = 'name folder filename filesize acl';
    let additionalFieldsArr = [];
    if (additionalFields) {
        fields = `${fields} ${additionalFields}`;
        additionalFieldsArr = additionalFields.split(" ");
    }

    const query = Item.find();
    query.where("client").equals(clientId);
    query.where("deletedAt").exists(false);
    query.where("folder").equals(new mongoose.Types.ObjectId(folderId));
    if (filesOnly)
        query.where("filename").exists(true);
    const items = await query.select(fields).exec();

    for (const item of items) {
        let folderPath = null;

        if (foldersPathMap)
            folderPath = foldersPathMap.get(item.folder ? item.folder.toString() : "0");

        let obj = {
            _id: item._id,
            name: item.name,
            filename: item.filename,
            filesize: item.filesize,
            folderPath: folderPath
        };

        for (const field of additionalFieldsArr) {
            obj[field] = item[field];
        }

        results.push(obj);
    }
}

exports.getItems = async function(itemIds, clientId, fields) {
    const Item = mongoose.model('Item');
    const query = Item.find({ _id: itemIds, client: clientId, deletedAt: { $exists: false }});

    if (fields)
        query.select(fields);

    const items = await query.exec();
    return items;
}

exports.getItemsInFoldersRecursive = async function(folderIds, itemIds, user, clientId, additionalFields, filesOnly, foldersPathMap, requireReadAccessOnAll) {
    const Item = mongoose.model('Item');

    if (!foldersPathMap)
        foldersPathMap = await folderService.createFolderPathMap(clientId, user);

    const results = [];
    let additionalFieldsArr = [];

    let fields = 'name filename filesize acl folder';
    if (additionalFields) {
        fields = `${fields} ${additionalFields}`;
        additionalFieldsArr = additionalFields.split(" ");
    }

    itemIds = verify.toObjectIdArray(itemIds);

    const query = Item.find();
    query.where("_id").in(itemIds);
    query.where("client").equals(clientId);
    query.where("deletedAt").exists(false);
    if (filesOnly)
        query.where("filename").exists(true);
    const items = await query.select(fields).exec();

    const filteredItems = await aclTools.filterElements(items, user, "read", false);

    if (requireReadAccessOnAll) {
        if (filteredItems.length < items.length)
            throw "User does not have access to all items in the folder structure";
    }

    for (const item of filteredItems) {
        let obj = {
            _id: item._id,
            name: item.name,
            filename: item.filename,
            filesize: item.filesize,
            folderPath: foldersPathMap.get(item.folder ? item.folder.toString() : "0")
        };

        for (const field of additionalFieldsArr) {
            obj[field] = item[field];
        }

        results.push(obj);
    }

    for (const folderId of folderIds) {
        await exports.getFolderItemsListRecursive(folderId, user, clientId, results, additionalFields, filesOnly, foldersPathMap);
    }

    return results;
};

function findShortestCommonPath(shortestPath, items) {
    let sharedPathCount = 0;
    for (const [index, path] of shortestPath.entries()) {
        for (const item of items) {
            if (item.folderParts[index] !== path) {
                return sharedPathCount;
            }
        }

        sharedPathCount++;
    }
    return sharedPathCount;
}

/***
 * Recreates links of an item from metadata json and a lookup map containing new and old item IDs to map.
 * @param itemId
 * @param metadataId
 * @param metadataLinks
 * @param linkLookupMap
 * @return {Promise<void>}
 */
exports.recreateLinksFromMetadata = async function(itemId, metadataId, metadataLinks, linkLookupMap) {

    if (!Array.isArray(metadataLinks))
        return;

    if (!metadataLinks.length)
        return;

    const links = [];
    for (const link of metadataLinks) {
        if (link.to && link.usage) {
            if (linkLookupMap.has(link.to)) {
                link.to = linkLookupMap.get(link.to).newId;
            } else {
                try {
                    link.to = new mongoose.Types.ObjectId(link.to);
                }
                catch(err) {
                    console.error(err);
                }
            }

            links.push({
                to: link.to,
                usage: link.usage
            });
        }
    }

    const Item = mongoose.model('Item');
    await Item.updateOne({ _id: itemId }, { $set: { links: links }, $unset: { thumbnails: 1 } });
}

/**
 * Creates a new item from the metadata of a previously exported item. If the item already exists, it will be
 * overwritten if the allowOverwrite flag is set.
 * This method will not write links because links from metadata are most probably invalid due to export from a
 * different system. Links will be returned together with original ID of the item and the newly created one.
 * Links can then be recreated at a later time using recreateLinksFromMetadata function
 * @param folderId
 * @param client
 * @param plan
 * @param user
 * @param itemname
 * @param metadata
 * @param allowOverwrite
 * @return {Promise<{newId: Types.ObjectId, links, originalId}>}
 */
exports.createItemFromMetaData = async function(folderId, client, plan, user, itemname, metadata, allowOverwrite) {

    const Item = mongoose.model('Item');
    let item = await Item.findOne({
        name: itemname,
        client: client,
        folder: folderId,
        deletedAt: { $exists: false }
    }).exec();

    if (item && !allowOverwrite)
        throw "Item already exists.";

    const quotaGroup = await folderService.getFolderQuotaGroup(folderId, client);
    if (!item) {
        // Determine the location of this item by looking at the group and user.
        // If this item belongs to a groups folder, use the groups location.
        // Otherwise use the location of the user.

        let location;
        if (quotaGroup) {
            const Group = mongoose.model('Group');
            const group = await Group.findOne({ _id: quotaGroup }).exec();
            location = group.location;
        } else {
            location = user.location;
        }

        item = new Item({
            name: itemname,
            location: location,
            client: client,
            folder: folderId,
            type: metadata.type
        });
        await item.save();
    }

    const update = {};
    update.description = metadata.description;
    update.tags = metadata.tags;
    update.contributors = metadata.contributors;

    if (metadata.categories)
        update.categories = await categoryService.filterCategories(metadata.categories, client._id);

    if (metadata.license && await licenseService.existsLicense(metadata.license, client._id))
        update.license = metadata.license;

    update.attributes = metadata.attributes || item.attributes;
    update.userAttributes = metadata.userAttributes || item.userAttributes;
    update.internalAttributes = metadata.internalAttributes;

    if (metadata.userAttributeTemplate && await attributeTemplateService.existsAttributeTemplate(metadata.userAttributeTemplate, client._id))
        update.userAttributeTemplate = metadata.userAttributeTemplate;

    if (metadata.internalAttributeTemplate && await attributeTemplateService.existsAttributeTemplate(metadata.internalAttributeTemplate, client._id))
        update.internalAttributeTemplate = metadata.internalAttributeTemplate;

    const privateAllowed = await clientService.isFeatureAllowed(client._id, "private_items", user, quotaGroup ? quotaGroup : null);
    if (privateAllowed) {
        update.visibility = metadata.visibility !== undefined ? metadata.visibility : update.visibility;
    } else {
        update.visibility = ItemVisibility.Public;
    }

    if (metadata.acl)
        update.acl = await aclTools.checkAclEntriesValidity(metadata.acl, client._id);

    // We use the location as part of the query to speed up the update.
    // MongoDB will be able to use the location to find the correct shard,
    // without making slow and unneccessary queries to other shards.
    const newItem = await Item.findOneAndUpdate({ _id: item._id, location: item.location }, { $set: update });

    await aclTools.updateAclCache(newItem, await aclTools.getClientAcl(client._id), "item");

    return {
        newId: item._id,
        originalId: metadata._id,
        links: metadata.links
    };
}

/**
 * Create an item from a stream. If item is already existing, it will be overwritten if allowOverwrite flag is set.
 * @param folderId
 * @param client
 * @param plan
 * @param user
 * @param itemname
 * @param filename
 * @param autoDestructIn
 * @param stream
 * @param allowOverwrite
 * @return {Promise<{type}|(Document<unknown, any, unknown> & Require_id<unknown>)>}
 */
exports.createItemFromStream = async function(folderId, client, plan, user, itemname, filename, autoDestructIn, stream, allowOverwrite) {

    const fixNameCollisions = !allowOverwrite;
    let { conflict, finalName } = await folderService.isNameConflict(itemname, folderId, client._id, fixNameCollisions);
    if (conflict && !allowOverwrite) {
        throw "Name already exists!";
    }

    // Auto destruction
    // -----------------------------------------------------
    let autoDestructAt = undefined;
    if (autoDestructIn) {
        autoDestructAt = moment().add(autoDestructIn, 'hour').toDate();
    }

    // Create new item
    // -----------------------------------------------------
    const quotaGroup = await folderService.getFolderQuotaGroup(folderId, client._id);
    const privateAllowed = await clientService.isFeatureAllowed(client._id, "private_items", user, quotaGroup ? quotaGroup : null);
    const visibility = privateAllowed ? ItemVisibility.Private : ItemVisibility.Public;

    const Item = mongoose.model('Item');
    let item;

    if (!conflict) {

        // Get quota user or group
        // -----------------------------------------------------
        let quotaUser = null;
        let quotaGroup = null;
        if (folderId) {
            quotaUser = await folderService.getFolderQuotaUser(folderId, client._id);
            if (!quotaUser)
                quotaGroup = await folderService.getFolderQuotaGroup(folderId, client._id);
        }

        // Determine the location of this item by looking at the group and user.
        // If this item belongs to a groups folder, use the groups location.
        // Otherwise use the location of the user.

        let location;
        if (quotaGroup) {
            const Group = mongoose.model('Group');
            const group = await Group.findOne({ _id: quotaGroup }).exec();
            location = group.location;
        } else {
            location = user.location;
        }

        item = new Item({
            name: finalName,
            location: location,
            folder: folderId,
            version: { major: 0, minor: 0, revision: 1 },
            visibility: visibility,
            allowConversation: true,
            filename: filename,
            autoDestructAt: autoDestructAt,
            client: client._id,
            createdBy: user._id,
            updatedBy: user._id,
            quotaUser: quotaUser,
            quotaGroup: quotaGroup
        });
        await item.save({ __user: user._id });
    } else {
        item = await Item.findOne({
            name: finalName,
            client: client._id,
            folder: folderId,
            deletedAt: { $exists: false }
        }).exec();

        item.filename = filename;
    }

    // Save the stream
    // ------------------------------------------------------------------------
    try {
        await exports.uploadFile(stream, item, true, client, plan);

        // Verify that the item type is allowed for this client and group. If no quotaGroup is set, then pass null to indicate the lack of a group.
        if (!item.type || !await clientService.isItemTypeAllowed(client._id, item.type, user, item.quotaGroup ? item.quotaGroup : null)) {
            // Item type could not be determined or is not allowed for this client.
            // This means the file content is unsupported.
            // Remove item and file data
            throw new ValidationError("Content type is not supported");
        }

        // Verify quota is not exceeded
        // -----------------------------------------------------
        if (item.quotaUser)
            await userService.verifyQuota(item.quotaUser, client._id, item.filesize);
        else if (item.quotaGroup)
            await groupService.verifyQuota(item.quotaGroup, client._id, item.filesize);

        const update = {};
        update.filesize = item.filesize;
        update.hash = item.hash;
        update.mimeType = item.mimeType;
        update.type = item.type;
        update.storages = item.storages;
        update.filename = item.filename;
        update.encryptionKey = item.encryptionKey;
        update.__user = user._id;
        update.recalculateItemSize = true;

        const newItem = await Item.findOneAndUpdate({ _id: item._id, location: item.location }, { $set: update });

        await aclTools.updateAclCache(newItem, await aclTools.getClientAcl(client._id), "item");

        return item;
    }
    catch(err) {

        if (!(err instanceof ValidationError))
            logger.error(err);

        try {
            for (const storage of item.storages) {
                await fileStorage.delete(item._id.toString(), storage);
            }
        }
        catch(err) {
            logger.error(err);
        }

        await Item.deleteOne({ _id: item._id, location: item.location }).exec();
        if (item.filesize) {
            await clientMetrics.incStorage(client, -1, -item.filesize);
        }

        throw err;
    }
}

/***
 * Import items from a ZIP stream.
 * @param user
 * @param client
 * @param plan
 * @param destinationFolderId
 * @param zipItemId
 * @return {Promise<void>}
 */
exports.importZipStream = async function(user, client, plan, destinationFolderId, zipItemId) {

    // Verify write access to destination Folder
    //------------------------------------------------------------------------
    if (!await aclTools.verifyAndGetAclForFolderId(destinationFolderId, user, "write"))
        throw "Write access to destination folder denied";

    // Get the ZIP Item and verify access
    //------------------------------------------------------------------------
    const Item = mongoose.model('Item');
    const zipItem = await Item.findOne({
        _id: zipItemId,
        client: client,
        deletedAt: { $exists: false }
    }).select("client folder acl storages encryptionKey").exec();

    if (!await aclTools.verifyAndGetAclFor(zipItem, user, "read"))
        throw "Access to ZIP denied";

    // Download and decrypt ZIP file
    //------------------------------------------------------------------------
    const download = await fileStorage.download(zipItem._id.toString(), zipItem.storages);
    let zipStream = download.stream;

    if (zipItem.encryptionKey) {
        const decryptor = decryptorStream.decryptStream(zipStream, zipItem.encryptionKey);
        zipStream = decryptor.stream;
    }

    // Unpack the ZIP
    //------------------------------------------------------------------------
    const dirnameToFolderIdMap = new Map();
    const linkMap = new Map();

    const zipBuffer = await streamTools.streamToBuffer(zipStream);
    const directory = await unzipper.Open.buffer(zipBuffer);

    for (const file of directory.files) {

        const filename = path.basename(file.path);

        const dirname = path.dirname(file.path);
        let folder = dirnameToFolderIdMap.get(dirname);

        if (folder === undefined) {
            const promise = folderService.ensurePath(client._id, destinationFolderId, dirname, user._id);
            dirnameToFolderIdMap.set(dirname, promise);
            folder = await promise;
        } else if (folder.then) {
            folder = await folder;
        }

        // If there is no folder for this item, then we're creating the item in the root folder.
        let folderID = folder ? folder._id : null;

        if (file.path.endsWith('.meta.json')) {
            const itemname = path.basename(filename, ".meta.json");
            const buf = await file.buffer();
            const str = buf.toString();
            const metadata = JSON.parse(str);
            const result = await exports.createItemFromMetaData(folderID, client, plan, user, itemname, metadata, true);
            linkMap.set(result.originalId, result);
        } else {
            const itemname = path.basename(filename, path.extname(filename));
            await exports.createItemFromStream(folderID, client, plan, user, itemname, filename, null, file.stream(), true);
        }
    }

    for (const entry of linkMap.values()) {
        await exports.recreateLinksFromMetadata(entry.newId, entry.originalId, entry.links, linkMap);
    }
}

exports.createZipStream = async function(user, client, plan, itemIds, folderIds, exportMetaData, retainFullPaths) {

    const Item = mongoose.model('Item');

    // Get a list of all requested items and filter them by access control list
    // -----------------------------------------------------------------------------------
    logger.info("Create ZIP Stream: Fetching and filtered items");
    const items = await exports.getItemsInFoldersRecursive(folderIds, itemIds, user, client._id, "encryptionKey storages", !exportMetaData);

    if (items.length > limits.ZIP_STREAM_MAXIMUM_ITEM_COUNT) {
        throw new LimitExceededError(`ZIP exports are limited to ${limits.ZIP_STREAM_MAXIMUM_ITEM_COUNT} items.`);
    }

    // Measure total filesize
    // -----------------------------------------------------------------------------------
    logger.info("Create ZIP Stream: Measuring file size");
    let filesize = 0;
    for (const item of items) {
        if (item.filesize)
            filesize += item.filesize;
    }

    const filesizeMiB = filesize / 1024 / 1024;
    if (filesizeMiB > limits.ZIP_STREAM_MAXIMUM_FILE_SIZE_MB) {
        throw new LimitExceededError(`ZIP exports are limited to ${limits.ZIP_STREAM_MAXIMUM_FILE_SIZE_MB} MiB`);
    }

    // Make sure quota limits are not exceeded
    // -----------------------------------------------------------------------------------
    if (!(await clientMetrics.verifyTrafficQuota(client, plan, filesize))) {
        throw new QuotaExceededError();
    }

    // Shorten paths if no full paths should be retained
    // -----------------------------------------------------------------------------------
    logger.info("Create ZIP Stream: Processing paths");
    if (!retainFullPaths) {
        let shortestPath;
        for (const item of items) {
            item.folderParts = item.folderPath.split('/').filter(p => p.length > 0);
            if (!shortestPath || item.folderParts.length < shortestPath.length)
                shortestPath = item.folderParts;
        }

        const sharedPathCount = findShortestCommonPath(shortestPath, items);
        if (sharedPathCount) {
            for (const item of items) {
                item.folderPath = "/" + item.folderParts.slice(sharedPathCount).join('/');
                if (!item.folderPath.endsWith("/"))
                    item.folderPath += "/";
            }
        }
    }

    // Create ZIP Archive
    // -----------------------------------------------------------------------------------
    logger.info("Create ZIP Stream: Creating archive...");
    const archive = Archiver('zip', {
        zlib: { level: 9 }
    });

    // This worker "thread" takes one item from the queue and downloads it. After it is done it will try to process another item.
    // If the queue is empty, the promise resolves.
    const WorkerThread = async () => {
        while(true) {
            const item = items.pop();

            // If .pop() returned undefined, then the queue is empty and we resolve this Promise.
            if (item === undefined) {
                return;
            }

            if (exportMetaData) {
                const filename = item.folderPath + item.name + ".meta.json";
                const itemComplete = await Item.findOne({_id: item._id}).select('name folder client type mimeType visibility hash description tags contributors ' +
                    'categories license autoDestructAt createdBy updatedBy publishedAt filename filesize thumbnails properties attributes userAttributeTemplate ' +
                    'userAttributes links attachments.name attachments.index attachments.filesize attachments.mimeType attachments.hash acl').exec();
                const json = JSON.stringify(itemComplete, null, 2);

                logger.info("Create ZIP Stream: Adding " + filename);
                archive.append(json, {name: filename});
            }

            if (item.filesize) {
                const extension = path.extname(item.filename);
                const filename = item.folderPath + item.name + extension;
                logger.info("Create ZIP Stream: Downloading " + filename);
                const download = await fileStorage.download(item._id.toString(), item.storages);
                let stream = download.stream;

                if (item.encryptionKey) {
                    const decryptor = decryptorStream.decryptStream(stream, item.encryptionKey);
                    stream = decryptor.stream;
                }

                logger.info("Create ZIP Stream: Adding " + filename);
                archive.append(stream, {name: filename});
            }
        }
    }

    // Now add items to archive
    // -----------------------------------------------------------------------------------
    const p = new Promise(async ( resolve, reject ) => {
        try {
            const workers = [];

            // Create 8 workers, i.e. up to 8 items will be downloaded in parallel.
            const numWorkers = 8;
            for (let i = 0; i < numWorkers; i++) {
                workers.push(WorkerThread());
            }

            // Wait until all workers are done.
            await Promise.all(workers);

            archive.finalize();
            resolve();
        }
        catch(err) {
            archive.finalize();
            reject(err);
        }
    });

    p.catch(function(err) {
        logger.error(err);
    });

    logger.info("Create ZIP Stream: Done.");
    return archive;
}

exports.createPackageStream = async function(user, client, plan, entryItemId, packageFolder, includeExternals, quotaUser, quotaGroup) {

    const Item = mongoose.model('Item');

    // Get a list of all items, starting with the entry item ID (if external items should be packaged)
    // -----------------------------------------------------------------------------------
    let linkedItemsFiltered = [];
    if (includeExternals) {
        logger.info("Create Package Stream: Traversing items starting with entry item ID");

        const linkedItemsMap = await exports.getItemDependencies(entryItemId, client._id, 'name filename filesize folder acl encryptionKey storages');
        const linkedItems = Array.from(linkedItemsMap.values());
        linkedItemsFiltered = await aclTools.filterElements(linkedItems, user, "read", false);

        if (linkedItemsFiltered.length < linkedItems.length)
            throw "User does not have access to all linked items!";
    }

    // Create a folder to path map of all involved folders
    // ---------------------------------------------
    logger.info("Create Package Stream: Creating folder path map");
    const foldersPathMap = await folderService.createFolderPathMapExact([packageFolder], linkedItemsFiltered, client._id);
    const basePath = foldersPathMap.get(packageFolder.toString());
    if (!basePath)
        throw "Base path for package not found!";

    // Get a list of all requested items in the package folder and filter them by access control list
    // -----------------------------------------------------------------------------------
    logger.info("Create Package Stream: Fetching and filtered items");
    const items = await exports.getItemsInFoldersRecursive([packageFolder], [], user, client._id, "encryptionKey storages",
        false, foldersPathMap, true);

    // Now merge the two arrays
    // ---------------------------------------------
    const itemsMap = new Map();
    for (const item of items) {
        itemsMap.set(item._id.toString(), true);
    }

    const externalItems = [];
    for (const item of linkedItemsFiltered) {
        if (!itemsMap.has(item._id.toString()))
            externalItems.push(item);
    }

    const totalItemCount = items.length + externalItems.length;
    if (totalItemCount > limits.PACKAGE_STREAM_MAXIMUM_ITEM_COUNT) {
        throw new LimitExceededError(`Package exports are limited to ${limits.PACKAGE_STREAM_MAXIMUM_ITEM_COUNT} items. This package would have ${totalItemCount} items.`);
    }

    // Measure total filesize
    // -----------------------------------------------------------------------------------
    logger.info("Create Package Stream: Measuring file size");
    let filesize = 0;
    for (const item of items) {
        if (item.filesize)
            filesize += item.filesize;
    }

    for (const item of externalItems) {
        if (item.filesize)
            filesize += item.filesize;
    }

    const filesizeMiB = filesize / 1024 / 1024;
    if (filesizeMiB > limits.PACKAGE_STREAM_MAXIMUM_FILE_SIZE_MB) {
        throw new LimitExceededError(`Package exports are limited to ${limits.PACKAGE_STREAM_MAXIMUM_FILE_SIZE_MB} MiB. This package would have ${filesizeMiB} MiB.`);
    }

    // Make sure quota limits are not exceeded
    // -----------------------------------------------------------------------------------
    if (!(await clientMetrics.verifyTrafficQuota(client, plan, filesize))) {
        throw new QuotaExceededError();
    }

    // If requested, also check the user's quota since we appear to save to the user's home folder
    // -----------------------------------------------------------------------------------
    if (quotaUser) {
        await userService.verifyQuota(quotaUser, client._id, filesize);
    }
    if (quotaGroup) {
        await groupService.verifyQuota(quotaGroup, client._id, filesize);
    }

    // Process paths
    // -----------------------------------------------------------------------------------
    logger.info("Create Package Stream: Processing paths");
    for (const item of items) {
        item.folderPath = "/main/ " + item.folderPath.slice(basePath.length);
    }

    for (const item of externalItems) {
        item.folderPath = "/external " + foldersPathMap.get(item.folder.toString());
        items.push(item);
    }

    // Create Package Archive
    // -----------------------------------------------------------------------------------
    logger.info("Create Package Stream: Creating archive...");
    const archive = Archiver('zip', {
        zlib: { level: 9 }
    });

    // Create index item
    // -----------------------------------------------------------------------------------
    const entryItemJson = JSON.stringify({
        entryItemId: entryItemId
    }, null, 2);
    archive.append(entryItemJson, {name: '/index.json' });

    // Now add items to archive
    // -----------------------------------------------------------------------------------
    const p = new Promise(async ( resolve, reject ) => {
        try {
            for (const item of items) {

                const filename = item.folderPath + item.name + ".meta.json";
                const itemComplete = await Item.findOne({_id: item._id}).select('name folder type mimeType hash description tags contributors ' +
                    'categories filesize properties attributes userAttributeTemplate userAttributes links').exec();
                const json = JSON.stringify(itemComplete, null, 2);

                logger.info("Create Package Stream: Adding " + filename);
                archive.append(json, {name: filename});

                if (item.filesize) {
                    const extension = path.extname(item.filename);
                    const filename = item.folderPath + item.name + extension;
                    logger.info("Create Package Stream: Downloading " + filename);
                    const download = await fileStorage.download(item._id.toString(), item.storages);
                    let stream = download.stream;

                    if (item.encryptionKey) {
                        const decryptor = decryptorStream.decryptStream(stream, item.encryptionKey);
                        stream = decryptor.stream;
                    }

                    logger.info("Create Package Stream: Adding " + filename);
                    archive.append(stream, {name: filename});

                    // Wait for stream to finish before getting the next one
                    await new Promise(fulfill => stream.on("finish", fulfill));
                }
            }

            archive.finalize();
            resolve();
        }
        catch(err) {
            archive.finalize();
            reject(err);
        }
    });

    p.catch(function(err) {
        logger.error(err);
    })

    logger.info("Create Package Stream: Done.");
    return archive;
}

exports.setConversation = function(plan, client, item) {
    if (!plan.conversationsAllowed) {
        item.allowConversation = false;
        item.conversation = null;
    }

    switch (client.conversationMode) {
        case 0: // always off
            item.allowConversation = false;
            item.conversation = null;
            break;
        case 1: // always on
            item.allowConversation = true;
            break;
        case 3: // item settable
            break;
        default:
            break;
    }
}

exports.getDependencies = async function(itemId, clientId, additionalFields) {
    const Item = mongoose.model('Item');
    const query = Item.find();

    query.where("client").equals(clientId);
    query.where("links.to").equals(itemId);
    query.where("deletedAt").exists(false);

    let fields = "name type links";
    if (additionalFields)
        fields += " " + additionalFields;

    return query.select(fields).exec();
}

exports.buildChangeDependencyList = async function(itemId, clientId, datatypeMap, resultList, refMap) {
    refMap = refMap || new Map();
    if (refMap.has(itemId.toString()))
        return;

    refMap.set(itemId.toString(), true);

    const linkedBy = await exports.getDependencies(itemId, clientId);
    for (const item of linkedBy) {
        let ignore = false;

        if (datatypeMap.has(item.type)) {
            const datatype = datatypeMap.get(item.type);

            for (const link of item.links) {
                if (itemId.equals(link.to)) {
                    const field = datatypeService.findField(datatype, link.usage);
                    if (field && field.doesNotAffectThumbnail) {
                        ignore = true;
                    }
                    break;
                }
            }
        } else {
            logger.error("Datatype map does not have type: " + item.type);
        }

        if (!ignore) {
            resultList.push(item);
            await exports.buildChangeDependencyList(item._id, clientId, datatypeMap, resultList, refMap);
        }
    }
}

exports.handleDependencyChange = async function(item, userId, attributesChanged, linksChanged, dataChanged) {

    if (!attributesChanged && !linksChanged && !dataChanged)
        return false;

    // Build a map of datatypes to do quick lookups
    // -----------------------------------------------------------------------------
    const datatypeMap = await datatypeService.getDatatypesMap();
    const items = [];

    // Get the thumb refresh flag on the item's datatype
    // -----------------------------------------------------------------------------
    let updateRequiresThumbRefresh = false;
    if (item.type) {
        if (datatypeMap.has(item.type)) {
            const datatype = datatypeMap.get(item.type);
            updateRequiresThumbRefresh = datatype.updateRequiresThumbRefresh;
        }
    }

    // If data was not changed, it is required that the flag is set on the datatype, otherwise we will not
    // cause any thumbnail refresh
    // -----------------------------------------------------------------------------
    if (!dataChanged && !updateRequiresThumbRefresh)
        return false;

    // Now build a list of dependencies that also need refresh
    // -----------------------------------------------------------------------------
    await exports.buildChangeDependencyList(item._id, item.client, datatypeMap, items);

    // Now mark all dependencies to recreate thumbnails if we found any
    // -----------------------------------------------------------------------------
    if (items.length) {
        const Item = mongoose.model('Item');
        await Item.updateMany({
            _id: items,
            deletedAt: { $exists: false },
            client: item.client
        }, {
            $set: { recreateThumbnailsAndPreviews: true }
        }, {
            __user: userId
        });
    }

    item.recreateThumbnailsAndPreviews = true;
    return item.recreateThumbnailsAndPreviews;
}

exports.query = async function(options, user) {

    // If a user attribute template is queried, resolve the name to an object Id first
    // ---------------------------------------------------------------------------------
    let userAttributeTemplate;
    if (options.userAttributeTemplate) {
        if (!options.client)
            throw new ValidationError("Searching for user attribute templates requires searching within a specific client.")

        try {
            userAttributeTemplate = new mongoose.Types.ObjectId(options.userAttributeTemplate);
        }
        catch(err) {
            const AttributeTemplate = mongoose.model('AttributeTemplate');
            const query = AttributeTemplate.findOne();
            query.where("name").equals(options.userAttributeTemplate);
            query.where("client").equals(options.client);
            userAttributeTemplate = await query.select("_id").exec();
            if (!userAttributeTemplate) {
                throw new ValidationError("Attribute template not found");
            }
            userAttributeTemplate = userAttributeTemplate._id;
        }
    }

    // Build the item aggregate
    // ---------------------------------------------------------------------------------
    let select = {
        _id: 1,
        name: 1,
        type: 1,
        mimeType: 1,
        packageType: 1,
        hash: 1,
        acl: 1,
        visibility: 1,
        folder: 1,
        createdBy: 1,
        updatedBy: 1,
        createdAt: 1,
        updatedAt: 1,
        quotaUser: 1,
        quotaGroup: 1,
        tags: 1,
        contributors: 1,
        categories: 1,
        links: 1,
        license: 1,
        filesize: 1,
        filename: 1,
        itemSize: 1,
        totalSize: 1
    };

    const Item = mongoose.model('Item');
    const aggregate = Item.aggregate();

    if (options.fulltext) {
        aggregate.match({ $text: { $search: options.fulltext }});
    }

    if (options.client)
        aggregate.match({ client: options.client });

    aggregate.match({ deletedAt: { $exists: false }});

    if (Array.isArray(options.types)) {
        const includeTypes = [];
        const excludeTypes = [];

        for (const type of options.types) {
            if (typeof type !== 'string')
                throw new ValidationError("Types need to be strings!", "types");

            if (type.startsWith("-"))
                excludeTypes.push(type.slice(1));
            else
                includeTypes.push(type);
        }

        if (options.onlyPackagedTypes) {
            if (includeTypes.length)
                aggregate.match({packageType: {$in: includeTypes}});

            // TODO: do the excluded types
        }
        else if (options.includePackagedTypes) {
            if (includeTypes.length) {
                aggregate.match({
                    $or: [
                        {type: {$in: includeTypes}},
                        {packageType: {$in: includeTypes}}
                    ]
                });
            }

            if (excludeTypes) {
                // TODO: do the excluded types
            }
        }
        else {
            if (includeTypes.length)
                aggregate.match({type: {$in: includeTypes}});

            // TODO: do the excluded types
        }
    }

    if (options.name) {
        // While technically any 12 character string or 24 character hex string is a valid ObjectID,
        // we only consider the input an ObjectID if it's a 24 character hex string.
        const hexChars = "0123456789abcdefABCDEF";

        // Check if the name contains any non-hex characters.
        const containsNonHexChar = options.name.split("").some(c => !hexChars.includes(c));

        // Use the input as an ObjectID if it's a 24 character hex string.
        if (!containsNonHexChar && options.name.length === 24) {
            const itemId = verify.toObjectId(options.name);
            aggregate.match({_id: itemId });
        } else {
            const r = new RegExp(`${options.name}`, 'i');
            aggregate.match({ name: r }).collation({ locale: "en", strength: 2 });
        }
    }
    if (options.user) {
        try {
            const userId = verify.toObjectId(options.user);
            aggregate.match({ createdBy: userId });
        } catch(err) {
            if (options.client) {
                const User = mongoose.model('User');
                const user = await User.findOne({
                    name: { $regex: options.user },
                    "memberships.client": options.client,
                    deletedAt: {$exists: false}
                }).select('_id').exec();
                if (user) {
                    aggregate.match({ createdBy: user._id });
                } else {
                    throw new ValidationError("User does not exist.");
                }
            } else {
                throw new ValidationError("User must be an ID if no client is specified");
            }
        }
    }
    if (options.quotaUser) {
        try {
            const userId = verify.toObjectId(options.quotaUser);
            aggregate.match({ quotaUser: userId });
        } catch(err) {
            if (options.client) {
                const User = mongoose.model('User');
                const user = await User.findOne({
                    name: { $regex: options.quotaUser },
                    "memberships.client": options.client,
                    deletedAt: {$exists: false}
                }).select('_id').exec();
                if (user) {
                    aggregate.match({ quotaUser: user._id });
                } else {
                    throw new ValidationError("User does not exist.");
                }
            } else {
                throw new ValidationError("QuotaUser must be an ID if no client is specified");
            }
        }
    }
    if (options.quotaGroup) {
        try {
            const groupId = verify.toObjectId(options.quotaGroup);
            aggregate.match({ quotaGroup: groupId });
        } catch(err) {
            if (options.client) {
                const Group = mongoose.model('Group');
                const group = await Group.findOne({
                    name: { $regex: options.quotaGroup },
                    client: options.client,
                    deletedAt: {$exists: false}
                }).select('_id').exec();
                if (group) {
                    aggregate.match({ quotaGroup: group._id });
                } else {
                    throw new ValidationError("Group does not exist.");
                }
            } else {
                throw new ValidationError("QuotaGroup must be an ID if no client is specified");
            }
        }
    }
    if (options.liked) {
        const ItemLike = mongoose.model('ItemLike');
        const likes = await ItemLike.find({ user: user._id, client: options.client }).select('item').exec();
        const likesIds = likes.map(x => x.item);
        aggregate.match({ _id: { $in: likesIds } });
    }
    if (Array.isArray(options.tags)) {
        if (options.tags.length) {
            if (options.anyTags)
                aggregate.match({ tags: { $in: options.tags }});
            else
                aggregate.match({ tags: { $all: options.tags }});
        } else {
            aggregate.match({
                $or: [
                    { tags: {$exists: false } },
                    { tags: null },
                    { tags: [] }
                ]
            });
        }
    }
    if (Array.isArray(options.contributors)) {
        if (options.contributors.length) {
            if (options.anyContributors)
                aggregate.match({ contributors: { $in: options.contributors }});
            else
                aggregate.match({ contributors: { $all: options.contributors }});
        } else {
            aggregate.match({
                $or: [
                    { contributors: {$exists: false } },
                    { contributors: null },
                    { contributors: [] }
                ]
            });
        }
    }
    if (options.categories) {
        let categoryNames = [];
        if (typeof options.categories  === "string")
            categoryNames = options.categories.split(",").map(x => x.trim());
        else if (Array.isArray(options.categories))
            categoryNames = options.categories;

        if (categoryNames.length) {
            const Category = mongoose.model('Category');
            let categories = await Category.find({
                name: { $in: categoryNames },
                client: options.client,
                deletedAt: {$exists: false}
            }).select('_id').exec();

            categories = categories.map(x => x._id);

            if (options.anyCategories)
                aggregate.match({ categories: { $in: categories }});
            else
                aggregate.match({ categories: { $all: categories }});
        } else {
            aggregate.match({
                $or: [
                    { categories: { $exists: false } },
                    { categories: null },
                    { categories: [] }
                ]
            });
        }
    }
    if (typeof options.licenses === "string") {
        let licenseNames = [];
        if (typeof options.licenses  === "string")
            licenseNames = options.licenses.split(",").map(x => x.trim());
        else if (Array.isArray(options.licenses))
            licenseNames = options.licenses;

        if (licenseNames.length) {
            const License = mongoose.model('License');
            let licenses = await License.find({
                name: { $in: licenseNames },
                client: options.client,
                deletedAt: {$exists: false}
            }).select('_id').exec();

            licenses = licenses.map(x => x._id);

            aggregate.match({ license: { $in: licenses }});
        } else {
            aggregate.match({
                $or: [
                    { license: {$exists: false } },
                    { license: null }
                ]
            });
        }
    }
    if (options.mimeType) {
        const r = new RegExp(options.mimeType);
        aggregate.match({ mimeType: r });
    }
    if (options.folder) {
        aggregate.match({ folder: options.folder });
    }
    if (options.attribute && options.attributeValue) {
        let match = {};
        match['attributes.' + options.attribute] = new RegExp(options.attributeValue);
        aggregate.match(match);
    }
    if (options.userAttribute && options.userAttributeValue) {
        let match = {};
        match['userAttributes.' + options.userAttribute] = new RegExp(options.userAttributeValue);
        aggregate.match(match);
    }
    if (userAttributeTemplate) {
        aggregate.match({ userAttributeTemplate: userAttributeTemplate });
    }
    else if (options.userAttributeTemplate === null) {
        aggregate.match({
            $or: [
                { userAttributeTemplate: { $exists: false } },
                { userAttributeTemplate: null }
            ]
        });
    }
    if (options.visibility !== undefined) {
        aggregate.match({ visibility: options.visibility });
    }
    if (options.hasFileSize) {
        aggregate.match({ filesize: { $gt: 0 }});
    }
    if (options.findMissingThumbnails && !options.findMissingPerceptiveHashes) {
        aggregate.match({
            $or: [
                { thumbnails: { $exists: false }},
                { recreateThumbnailsAndPreviews: true }
            ]
        });
    }
    if (options.findMissingPerceptiveHashes && !options.findMissingThumbnails) {
        aggregate.match({ perceptiveHash: { $exists: false }});
    }
    if (options.findMissingThumbnails && options.findMissingPerceptiveHashes) {
        aggregate.match({
            $or: [
                { perceptiveHash: { $exists: false } },
                { thumbnails: { $exists: false } },
                { recreateThumbnailsAndPreviews: true }
            ]
        });
    }
    if (options.findMissingPreviews) {
        aggregate.match({ "attachments.name": { $ne: "preview" } } );
    }
    if (options.findMissingLodLevels) {
        aggregate.match( { "attachments.name": { $ne: 'lod' } } );
        aggregate.match({ 'omitLodGeneration': { $ne: true } } );
    }
    if (options.dateFrom) {
        aggregate.match({ createdAt: { $gte: options.dateFrom }});
    }
    if (options.dateTo) {
        aggregate.match({ createdAt: { $lte: options.dateTo }});
    }
    if (options.withStats) {
        const ItemStat = mongoose.model('ItemStat');
        aggregate.lookup({
            from: ItemStat.collection.name,
            localField: "_id",
            foreignField: "item",
            as: "itemstats"
        });
        select["counts"] = {'$arrayElemAt':['$itemstats', 0]};
    }

    // Check which fields we need to filter out from our aggregate so we don't transmit the whole items
    // ----------------------------------------------------------------------------------------
    let injectAllowWriteAndPublish = true;

    if (!user) {
        const client = await clientService.getClient(options.client, "publicUserInfo");

        if (client && !client.publicUserInfo) {
            delete select["createdBy"];
            delete select["quotaUser"];
            delete select["quotaGroup"];
        }

        delete select["acl"];
        delete select["visibility"];
        delete select["folder"];
        delete select["updatedAt"];
        delete select["updatedBy"];
    }
    if (options.withAttributes) {
        select["attributes"] = 1;
    }
    if (options.withUserAttributes) {
        select["userAttributes"] = 1;
    }
    if (options.withProperties) {
        select["properties"] = 1;
    }
    if (options.withAttachmentInfo) {
        select["attachments.name"] = 1;
        select["attachments.index"] = 1;
        select["attachments.filesize"] = 1;
        select["attachments.mimeType"] = 1;
        select["attachments.hash"] = 1;
    }
    if (options.returnIdOnly || options.returnCountOnly) {
        if (user)
            select = { _id: 1, acl: 1, folder: 1 };
        else
            select = { _id: 1 };

        injectAllowWriteAndPublish = false;
    }
    if (options.returnHashesAndDatesOnly) {
        if (user)
            select = { hash: 1, updatedAt: 1, acl: 1, folder: 1 };
        else
            select = { hash: 1, updatedAt: 1 };

        injectAllowWriteAndPublish = false;
    }

    // Select fields on the aggregate
    // ----------------------------------------------------------------------------------------
    if (options.fulltext) {
        select["score"] = { $meta: "textScore" };
        aggregate.project(select);

        if (!options.sort)
            aggregate.sort({ score: -1 });
    } else {
        aggregate.project(select);

        if (!options.sort)
            aggregate.sort({ updatedAt: -1 });
    }

    // Handle sorting if requested
    // ----------------------------------------------------------------------------------------
    if (options.sort) {
        const sortableFieldsMap = new Map()
            .set('name', 'name')
            .set('views', 'counts.counts.views')
            .set('downloads', 'counts.counts.downloads')
            .set('likes', 'counts[0].counts.likes')
            .set('conversationcount', 'counts.conversationCount')
            .set('date', 'createdAt');
        const sortableFields = Array.from(sortableFieldsMap.keys());

        let sort = options.sort.toLowerCase();
        if (!sortableFields.includes(sort))
            throw new ValidationError(`Unknown sort field '${sort}'. Allowed are ${sortableFields.join(', ')}`);

        sort = sortableFieldsMap.get(sort);

        let sortOrder = 1;
        if (options.sortOrder) {
            const sortOrderLC = options.sortOrder.toLowerCase();
            switch(sortOrderLC) {
                case 'asc':
                    sortOrder = 1;
                    break;
                case 'desc':
                    sortOrder = -1;
                    break;
                default:
                    throw new ValidationError(`Unknown sort order '${sortOrderLC}'. Allowed are 'asc' and 'desc'`);
            }
        }

        let sortObj = {};
        sortObj[sort] = sortOrder;
        aggregate.sort(sortObj);
    }

    // Execute the aggregate
    // ----------------------------------------------------------------------------------------
    const items = await aggregate.skip(options.pageSize * options.pageIndex).limit(options.pageSize).exec();

    // Filter items by permission if needed
    // ----------------------------------------------------------------------------------------
    let filteredItems;
    if (user)
        filteredItems = await aclTools.filterElements(items, user, "read", injectAllowWriteAndPublish);
    else
        filteredItems = items;

    // If we want the stats, convert the ItemStat array to the actual counts field within it
    // ----------------------------------------------------------------------------------------
    if (options.withStats) {
        for (const item of filteredItems) {
            item.counts = item.counts ? item.counts.counts : null;
        }
    }

    if (options.exportAsExcel) {

        //  Return a spreadsheet
        // ----------------------------------------------------------------------------------------
        let spreadSheetData = [];
        for (const item of filteredItems) {
            for (const att in item.userAttributes) {
                if (item.userAttributes.hasOwnProperty(att)) {
                    let value = item.userAttributes[att];

                    if (Array.isArray(value)) {
                        item.userAttributes[att] = value.join(',');
                    } else if (typeof value === "object") {
                        item.userAttributes[att] = JSON.stringify(value);
                    }
                }
            }
            spreadSheetData.push(item.userAttributes);
        }
        return spreadsheetService.createXlsx("Export", spreadSheetData);
    }
    else {

        if (options.returnCountOnly) {

            // Return item count only
            // ----------------------------------------------------------------------------------------
            return filteredItems.length;
        } else if (options.returnIdOnly) {

            // Return IDs only
            // ----------------------------------------------------------------------------------------
            return common.ensureExactFieldsInArray(filteredItems, ["_id"])
        } else if (options.returnHashesAndDatesOnly) {

            // Return hashes and update dates only
            // ----------------------------------------------------------------------------------------
            return common.ensureExactFieldsInArray(filteredItems, ["_id", "hash", "updatedAt"]);
        } else {

            // Return item results
            // ----------------------------------------------------------------------------------------
            const fields = [];

            if (user && injectAllowWriteAndPublish) {
                fields.push("allowWrite");
                fields.push("allowPublish");
            }

            for (const field in select) {
                if (field !== "acl") {
                    if (!field.includes("."))
                        fields.push(field);
                    else {
                        const f = field.split(".")[0];
                        if (!fields.includes(f))
                            fields.push(f);
                    }
                }
            }

            return common.ensureExactFieldsInArray(filteredItems, fields);
        }
    }
}

exports.processTags = function(tags) {
    const processedTags = [];

    for (const tag of tags) {
        const processedTag = tag.toLowerCase().replace( /\W/g , '');
        processedTags.push(processedTag);
    }

    return processedTags.unique().alphabeticSort();
}

exports.processContributors = async function(contributors, clientId) {
    const uniqueContributors = contributors.unique();
    const contributorsExist = await Promise.all(uniqueContributors.map(contributor => userService.existsUser(contributor, clientId)));
    const uniquePreExistingContributors = [];

    for (let i = 0; i < uniqueContributors.length; i++) {
        if(contributorsExist[i]) {
            uniquePreExistingContributors.push(uniqueContributors[i]);
        }
    }

    return uniquePreExistingContributors;
}

exports.processCategories = async function(categoryIds, clientId) {
    const Category = mongoose.model('Category');
    const categories = await Category.find({ client: clientId, deletedAt: { $exists: false }}).select("_id").exec();

    for (const id of categoryIds) {
        let found = false;
        for (const category of categories) {
            if (category._id.equals(id)) {
                found = true;
                break;
            }
        }
        if (!found)
            throw new ValidationError("Category Id is not valid: " + id.toString());
    }

    return categoryIds;
}

exports.getCount = async function(itemId, field, mustBePublic, clientId, user) {
    const counts = await exports.getCounts(itemId, mustBePublic, clientId, user);

    if (!counts || !counts.has(field))
        return undefined;
    else
        return counts.get(field);
}

exports.getCounts = async function(itemId, mustBePublic, clientId, user) {

    const Item = mongoose.model('Item');
    let query = Item.findOne({
        _id: itemId,
        deletedAt: { $exists: false }
    });

    if (clientId)
        query.where({ client: clientId });

    if (mustBePublic)
        query.where({ visibility: { $gte: 2 }});

    const item = await query.select("_id acl").exec();

    if (!item) {
        throw new ValidationError("Item not found");
    }

    if (!mustBePublic) {
        const filteredItems = await aclTools.filterElements([item], user, "read");
        if (filteredItems.length === 0) {
            throw new ValidationError("Item not found");
        }
    }

    const ItemStat = mongoose.model("ItemStat");
    const itemStat = await ItemStat.findOne({
        item: itemId
    }).select(`counts`).exec();

    if (!itemStat || !itemStat.counts)
        return new Map();
    else
        return itemStat.counts;
}

exports.like = async function(itemId, clientId, userId) {
    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        _id: itemId,
        client: clientId,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    if (!item) {
        throw new ValidationError("Item not found");
    }

    const ItemLike = mongoose.model('ItemLike');
    const itemLike = await ItemLike.findOne({
        item: item._id,
        user: userId
    });

    if (itemLike) {
        throw new ValidationError("You already liked this item");
    }

    await ItemLike.create({
        item: item._id,
        user: userId,
        client: clientId
    });

    await exports.setCount(itemId, "likes", clientId, false, 1, true);
}

exports.unlike = async function(itemId, clientId, userId) {
    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        _id: itemId,
        client: clientId,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    if (!item) {
        throw new ValidationError("Item not found");
    }

    const ItemLike = mongoose.model('ItemLike');
    const itemLike = await ItemLike.findOne({
        item: item._id,
        user: userId
    });

    if (!itemLike) {
        throw new ValidationError("You did not like this item");
    }

    await ItemLike.deleteOne({
        item: item._id,
        user: userId
    });

    await exports.setCount(itemId, "likes", clientId, false, -1, true);
}

exports.doILike = async function(itemId, clientId, userId) {
    const ItemLike = mongoose.model('ItemLike');
    return ItemLike.exists({
        item: itemId,
        user: userId
    });
}

exports.didILike = async function(itemId, userId) {
    const ItemLike = mongoose.model('ItemLike');
    const itemLike = await ItemLike.findOne({
        item: itemId,
        user: userId
    });

    return !!itemLike;
}

exports.setCount = async function(itemId, field, clientId, mustBePublic, count, relative) {

    const Item = mongoose.model('Item');
    const query = Item.findOne({
        _id: itemId,
        deletedAt: { $exists: false }
    });

    if (clientId)
        query.where({ client: clientId });

    if (mustBePublic) {
        query.where({ visibility: { $gte: 2 } });
    }

    const item = await query.select("_id").exec();

    if (!item) {
        throw new ValidationError("Item not found");
    }

    let data = { };
    data[`counts.${field}`] = count;

    let update;
    if (relative)
        update = { $inc: data };
    else
        update = data;

    const ItemStat = mongoose.model('ItemStat');
    await ItemStat.findOneAndUpdate({ item: item._id }, update, { upsert: true } );
}

/***
 * Return quota user for an item
 * @param itemId
 * @returns {Promise<*>}
 */
exports.getQuotaUser = async function(itemId) {
    const Item = mongoose.model('Item');
    const item = await Item.findOne({ _id: new mongoose.Types.ObjectId(itemId), deletedAt: { $exists: false } }).select("quotaUser").exec();
    if (!item)
        throw new ValidationError("Item not found!");

    return item.quotaUser;
}

/***
 * Search for a single item of a type within a folder and return it
 * @param folderId
 * @param itemType
 * @param user
 * @returns {Promise<(Document<unknown, any, unknown> & Require_id<unknown>)|null>}
 */
exports.getSingleItemOfTypeOrNameInFolder = async function(folderId, itemType, itemName, user) {
    const fields = [
        "name", "folder", "visibility", "createdAt", "createdBy", "updatedAt", "updatedBy", "filesize", "filename",
        "acl", "hash", "mimeType", "type", "packageType", "allowConversation"
    ];

    const filter = {
        folder: folderId,
        deletedAt: { $exists: false }
    };

    if (itemType)
        filter.type = itemType;

    if (itemName)
        filter.name = itemName;

    const Item = mongoose.model('Item');
    const items = await Item.find(filter).select(fields.join(' ')).exec();

    const filteredItems = await aclTools.filterElements(items, user, "read", false);
    if (filteredItems.length)
        return filteredItems[0];

    return null;
}


/**
 * Resolves item ID by a path relative to a parent folder Id
 * @param path
 * @param clientId
 * @param user
 * @param parentId
 * @return {Promise<Types.ObjectId|null>}
 */
exports.resolveRelativeItem = async function(path, clientId, user, parentId, mustBePublicAccessible) {

    const slashPos = path.lastIndexOf('/');
    if (slashPos >= 0) {
        let folderPath = path.slice(0, slashPos);
        path = path.slice(slashPos+1);

        if (!folderPath.startsWith('/'))
            folderPath = "/" + folderPath;

        parentId = await folderService.resolveFolder(folderPath, clientId, user, parentId);
        if (parentId === undefined)
            return null;
    }

    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        folder: parentId,
        name: path,
        client: clientId,
        deletedAt: { $exists: false }
    }).select('_id folder client visibility acl').exec();

    if (!item)
        return null;

    if (mustBePublicAccessible && item.visibility < ItemVisibility.NotListed)
        return null;

    if (user) {
        if (!await aclTools.verifyAndGetAclFor(item, user, "read")) {
            return null;
        }
    }

    return item._id;
}

exports.getItemsInFolderPaginated = async function(folderID, clientID, user, itemsPerPageStr, firstObjectID) {
    const Item = mongoose.model("Item");
    const itemsPerPage = pagingTools.parseItemsPerPage(itemsPerPageStr);
    const aggregate = Item.aggregate();

    aggregate.match({ deletedAt: { $exists: false } });
    aggregate.sort({_id: "descending"});

    if (firstObjectID) {
        aggregate.match({ _id: { $lte: firstObjectID } });
    }

    if (clientID) {
        aggregate.match({ client: clientID });
    }

    aggregate.match({ folder: folderID });

    aggregate.project({ name: 1, folder: 1, visibility: 1, filesize: 1, filename: 1,
                createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1, acl: 1, itemSize: 1, totalSize: 1,
                hash: 1, mimeType: 1, type: 1, packageType: 1, autoDestructAt: 1, thumbnailCount: { $size: { $ifNull: ['$thumbnails', []] }}});

    const items = await aggregate.exec();
    const filteredItems = await aclTools.filterElements(items, user, "read", true)

    let nextObjectID = null;
    if (filteredItems.length >= itemsPerPage + 1) {
        nextObjectID = filteredItems[itemsPerPage]._id;
        filteredItems.length = itemsPerPage;
    }

    const fields = [
        "_id", "name", "folder", "visibility", "createdAt", "createdBy", "updatedAt", "updatedBy", "filesize", "filename",
        "acl", "allowWrite", "allowPublish", "hash", "mimeType", "type", "packageType", "autoDestructAt", "thumbnailCount", "itemSize", "totalSize"
    ];

    const mappedItems = filteredItems.map(function(obj) {
        return common.ensureExactFieldsInObject(obj, fields);
    });

    return {
        items: mappedItems,
        nextObjectID: nextObjectID
    }
}

exports.getSynclistPaginated = async function(date, clientID, user, itemsPerPageStr, firstObjectID) {
    const Item = mongoose.model("Item");
    const query = Item.find();
    const itemsPerPage = pagingTools.parseItemsPerPage(itemsPerPageStr);

    query.where("deletedAt").exists(false);
    query.where("client").equals(clientID);
    query.sort({_id: "descending"});

    if (date !== null) {
        query.where("updatedAt").gt(date);
    }

    if (firstObjectID) {
        query.where("_id").lte(firstObjectID);
    }

    const items = await query.select('_id name acl type filename filesize mimeType packageType hash folder createdAt updatedAt client').exec();
    const filteredItems = await aclTools.filterElements(items, user, "read");

    let nextObjectID = null;
    if (filteredItems.length >= itemsPerPage + 1) {
        nextObjectID = filteredItems[itemsPerPage]._id;
        filteredItems.length = itemsPerPage;
    }

    const fields = [
        "_id", "name", "folder", "type", "createdAt", "updatedAt", "filename", "filesize", "hash", "mimeType", "packageType"
    ];

    const realItems = filteredItems.map((obj) => common.ensureExactFieldsInObject(obj, fields));

    return {
        items: realItems,
        nextObjectID: nextObjectID
    }
}

/**
 * Get the parent folder IDs for the submitted item IDs
 * @param itemIds
 * @param client
 * @return {Promise<any[]>}
 */
exports.getFoldersForItems = async function(itemIds, client) {
    const Item = mongoose.model('Item');
    const items = await Item.find({ _id: itemIds, client: client, deletedAt: { $exists: false }}).select("folder").exec();
    const folderIds = new Map();
    for (const item of items) {
        folderIds.set(item.folder ? item.folder.toString() : "0", item.folder);
    }
    return Array.from(folderIds.values());
}

/**
 * Copy an item to a new location
 * @param itemId
 * @param deepClone
 * @param destinationFolderId
 * @param excludeTypes
 * @param user
 * @param clientId
 * @param clonedIds
 * @return {Promise<Types.ObjectId|*|null>}
 */
exports.cloneItem = async function(itemId, deepClone, destinationFolderId, excludeTypes, user, clientId, clonedIds) {

    const itemIdStr = itemId.toString();
    if (clonedIds && clonedIds.has(itemIdStr))
        return clonedIds.get(itemIdStr);

    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        _id: itemId,
        client: clientId,
        deletedAt: { $exists: false }
    }).exec();

    if (!item) {
        throw new ValidationError("Item not found: " + itemId);
    }

    if (excludeTypes && excludeTypes.includes(item.type))
        return null;

    if (!await aclTools.verifyAndGetAclFor(item, user, "read")) {
        throw new ValidationError("No permission to read item: " + itemId);
    }

    let { conflict, finalName } = await folderService.isNameConflict(item.name, destinationFolderId, clientId, true);
    if (conflict) {
        throw new ValidationError("There is already a file with that name in the destination. Fixing collision was unsuccessful: " + item.name);
    }

    let clonedData = item.toObject();
    clonedData.name = finalName;
    delete clonedData._id;
    const clonedItem = new Item(clonedData);

    // Deep clone the object if needed
    // --------------------------------------------------------------
    if (deepClone) {
        for (const link of clonedItem.links) {
            const clonedItem = await exports.cloneItem(link.to, deepClone, destinationFolderId, excludeTypes, user, clientId, clonedIds);
            link.to = clonedItem._id;
        }

        // remove empty links if they were excluded
        // --------------------------------------------------------------
        clonedItem.links = clonedItem.links.filter(link => link.to !== null);
    }

    // Determine the location of the destinationFolder.
    // Use the system location if no destinationFolderId was given.
    const Folder = mongoose.model('Folder');
    let newLocation = config.systemLocation;

    if (destinationFolderId) {
        const destFolder = await Folder.findOne({
            _id: destinationFolderId,
            client: clientId,
            deletedAt: { $exists: false }
        }).exec();

        newLocation = destFolder.location || newLocation;
    }

    // Save the new clone
    // --------------------------------------------------------------
    clonedItem.folder = destinationFolderId;
    clonedItem.location = newLocation;
    clonedItem.filesize = undefined;
    clonedItem.filename = undefined;
    clonedItem.hash = undefined;
    clonedItem.perceptiveHash = undefined;
    clonedItem.mimeType = undefined;
    clonedItem.thumbnails = [];
    clonedItem.encryptionKey = undefined;
    clonedItem.storages = undefined;
    clonedItem.storageHash = undefined;
    clonedItem.attachments = undefined;
    clonedItem.createdAt = undefined;
    clonedItem.updatedAt = undefined;
    clonedItem.createdBy = user._id;
    clonedItem.updatedBy = user._id;
    await clonedItem.save();

    // Copy over data if any exists
    // --------------------------------------------------------------
    if (item.filesize) {
        for (const storage of item.storages) {
            await fileStorage.copy(itemId.toString(), clonedItem._id.toString(), storage);
        }

        clonedItem.filesize = item.filesize;
        clonedItem.filename = item.filename;
        clonedItem.hash = item.hash;
        clonedItem.perceptiveHash = item.perceptiveHash;
        clonedItem.mimeType = item.mimeType;
        clonedItem.thumbnails = item.thumbnails;
        clonedItem.encryptionKey = item.encryptionKey;
        clonedItem.storages = item.storages;
        clonedItem.storageHash = item.storageHash;
        clonedItem.__user = user._id;
        await clonedItem.save({ __user: user._id });
    }

    if (clonedIds)
        clonedIds.set(itemIdStr, clonedItem._id);

    return clonedItem;
}

/**
 * Replaces all links in an item that match the replacements
 * @param itemId The item ID to process
 * @param clientId the client ID of the item
 * @param user The user making the changes
 * @param replacementsMap An map of replacements, key being the old ID and value the new
 * @return {Promise<void>}
 */
exports.replaceLinks = async function(itemId, clientId, user, replacementsMap) {
    const Item = mongoose.model('Item');
    const item = await Item.findOne({
        _id: itemId,
        client: clientId,
        deletedAt: { $exists: false }
    }).select('links').exec();

    if (!item) {
        throw new ValidationError("Item not found: " + itemId);
    }

    if (!await aclTools.verifyAndGetAclFor(item, user, "write", false)) {
        throw new ValidationError("No permission to read item: " + itemId);
    }

    if (Array.isArray(item.links)) {
        let changed = false;

        for (let link of item.links) {
            if (replacementsMap.has(link.to)) {
                link.to = replacementsMap.get(link.to);
                changed = true;
            }
        }

        if (changed)
            await Item.findOneAndUpdate({ _id: item._id }, { links: item.links }).exec();
    }
}

/**
 * Copy an item's data to a destination item
 * @param sourceItemId
 * @param destItemId
 * @param req
 * @param res
 * @param user optional user to be used for item ownership
 * @return {Promise<boolean>}
 */
exports.copyItemData = async function(sourceItemId, destItemId, req, res, user) {

    // Get source and destination items and make sure they exist and the user has access to them
    // -----------------------------------------------------------------------------------------
    const sourceItem = await exports.getItem(sourceItemId, req);
    if (!sourceItem || (req && !await aclTools.verifyAndGetAclFor(sourceItem, req.user, "read"))) {
        if (res) {
            res.status(404).json({
                result: "failed",
                error: "Source item not found"
            });
        }
        return false;
    }

    const destItem = await exports.getItem(destItemId, req);
    if (!destItem || (req && !await aclTools.verifyAndGetAclFor(destItem, req.user, "write"))) {
        if (res) {
            res.status(404).json({
                result: "failed",
                error: "Destination item not found"
            });
        }
        return false;
    }

    // Check for available data in the two items and delete destination data if any
    // -------------------------------------------------------------------------------
    if (!sourceItem.filesize) {
        if (res) {
            res.json({
                result: "failed",
                error: "Source item has no data"
            });
        }
        return false;
    }

    if (destItem.filesize) {
        // Remove data and also metadata until the data is completely copied over
        // ---------------------------------------------------------------------------
        destItem.filesize = 0;
        destItem.filename = undefined;
        destItem.hash = undefined;
        destItem.perceptiveHash = undefined;
        destItem.mimeType = undefined;
        destItem.thumbnails = [];
        destItem.encryptionKey = undefined;
        destItem.updatedBy = req.userObjectId;

        await destItem.save();
        for (const storage of destItem.storages) {
            await fileStorage.delete(destItem._id.toString(), storage);
        }

        destItem.storages = [];
        destItem.storageHash = undefined;
    }

    // Copy the data over and save the destination item
    // -------------------------------------------------------------------------------
    for (const storage of sourceItem.storages) {
        await fileStorage.copy(sourceItem._id.toString(), destItem._id.toString(), storage);
    }

    destItem.storages = sourceItem.storages;
    destItem.storageHash = sourceItem.storageHash;
    destItem.filesize = sourceItem.filesize;
    destItem.filename = sourceItem.filename;
    destItem.hash = sourceItem.hash;
    destItem.perceptiveHash = sourceItem.perceptiveHash;
    destItem.mimeType = sourceItem.mimeType;
    destItem.thumbnails = sourceItem.thumbnails;
    destItem.encryptionKey = sourceItem.encryptionKey;
    destItem.updatedBy = req.userObjectId;
    destItem.recalculateItemSize = true;

    await destItem.save();

    return true;
}
