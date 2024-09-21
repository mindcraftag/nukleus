"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express           = require('express');
const Busboy            = require('busboy');
const moment            = require('moment');
const nsvc              = require('@mindcraftgmbh/nukleus-service');
const path              = require('path');

const mongoose          = nsvc.model.mongoose;
const logger            = nsvc.logger;
const ValidationError   = nsvc.exception.ValidationError;

const router            = express.Router();

module.exports = {
    path: "/api/item",
    router: router,
    permissions: []
};

const MAX_ITEM_DESCRIPTION_LENGTH = 10000;
const MAX_ITEM_SHORT_DESCRIPTION_LENGTH = 200;
const MAX_TAG_LENGTH = 50;
const MAX_TAG_COUNT = 100;

// ############################################################################################################
// Create item
// ############################################################################################################
router.route('/')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const name = nsvc.verify.itemOrFolderName(req, "name");
            const type = nsvc.verify.string(req, "type");
            const itemTemplateId = nsvc.verify.optionalObjectId(req, "itemTemplate");
            const version = nsvc.verify.optionalVersion(req, "version", { major: 0, minor: 0, revision: 1});
            const folder = nsvc.verify.optionalObjectId(req, "folder") || null;
            const visibility = nsvc.verify.optionalIntegerNumberRange(req, "visibility", 0, 3);
            const allowConversation = nsvc.verify.optionalBoolean(req, "allowConversation", true);
            const fixNameCollisions = nsvc.verify.optionalBoolean(req, "fixNameCollisions", false);
            const desiredClient = nsvc.verify.optionalObjectId(req, "client");
            const userAttributeTemplate = nsvc.verify.optionalObjectId(req, "userAttributeTemplate");

            let privateAllowed = true;
            // We only set the privateAllowed variable when the desiredClient is set. If it's not, then we don't care about the privateAllowed flag
            // because only superadmins are allowed to create items without a desiredClient.
            if (desiredClient) {
                const quotaGroup = folder && await nsvc.folderService.getFolderQuotaGroup(folder, desiredClient);
                privateAllowed = await nsvc.clientService.isFeatureAllowed(req.user.client, "private_items", req.user, quotaGroup ? quotaGroup : null);
            }

            if (userAttributeTemplate && !req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            let client = null;
            if (req.isSystemUser) {
                if (!desiredClient) {
                    res.status(400).json({
                        result: "failed",
                        error: "Client is not set"
                    });
                    return;
                }
                client = desiredClient;
            } else {
                client = req.user.client;

                // Check for write permission on the folder
                // -----------------------------------------------------
                if (!await nsvc.aclTools.verifyAndGetAclForFolderId(folder, req.user, "write")) {
                    res.status(403).json({
                        result: "failed",
                        error: "Permission denied to write to folder"
                    });
                    return;
                }
            }

            // Check if limits are not exceeded
            // -----------------------------------------------------
            const Item = mongoose.model('Item');
            const count = await Item.find({ client: req.user.client }).count();
            if (count >= nsvc.limits.MAX_ITEMS_PER_CLIENT) {
                throw new ValidationError(`Maximum amount of items exceeded. Allowed are ${nsvc.limits.MAX_ITEMS_PER_CLIENT}`);
            }

            // Check if we're allowed to create this type of item for this client
            // -----------------------------------------------------
            if (client) {
                const quotaGroup = folder && nsvc.folderService.getFolderQuotaGroup(folder, client);
                if (!await nsvc.clientService.isItemTypeAllowed(client, type, req.user, quotaGroup ? quotaGroup : null)) {
                    res.json({
                        result: "failed",
                        error: "Datatype to be created is invalid!"
                    });
                    return;
                }
            }

            // Make sure the user has the feature activated to make items private or unlisted
            // -----------------------------------------------------
            if (visibility === 1 || visibility === 2) {
                if (!privateAllowed) {
                    res.json({
                        result: "failed",
                        error: "You are not allowed to make items private or unlisted!"
                    });
                    return;
                }
            }

            // Check for existance of parent folder with that client
            // -----------------------------------------------------
            let folderLocation = null;
            if (folder) {
                const Folder = mongoose.model('Folder');
                const parentFolder = await Folder.findOne({
                    _id: folder,
                    client: client,
                    deletedAt: {$exists: false}
                }).select("_id location").exec();

                if (!parentFolder) {
                    res.status(404).json({
                        result: "failed",
                        error: "Parent folder not found"
                    });
                    return;
                }

                folderLocation = parentFolder.location;
            }

            // Check for existance of other item with that name
            // -----------------------------------------------------
            let { conflict, finalName } = await nsvc.folderService.isNameConflict(name, folder, client, fixNameCollisions);
            if (conflict) {
                res.json({
                    result: "failed",
                    error: "Item or folder with that name already exists"
                });
                return;
            }

            // Check for existance of the user attribute template
            // -----------------------------------------------------
            if (userAttributeTemplate) {
                const AttributeTemplate = mongoose.model("AttributeTemplate");
                const attributeTemplate = await AttributeTemplate.findOne({
                    _id: userAttributeTemplate,
                    client: client
                }).exec();

                if (!attributeTemplate) {
                    res.status(404).json({
                        result: "failed",
                        error: "User attribute template not found!"
                    });
                    return;
                }
            }

            // Get item template if any is requested
            // -----------------------------------------------------
            let itemTemplate;
            if (itemTemplateId) {
                itemTemplate = await nsvc.itemTemplateService.getItemTemplate(itemTemplateId, client, true);
                itemTemplate = await nsvc.itemTemplateService.prepareItemTemplate(itemTemplate);
            }

            // set attributes if any
            // -----------------------------------------------------------------
            const attributes = new Map();
            if (req.body.attributes) {
                for (const key in req.body.attributes) {
                    if (req.body.attributes.hasOwnProperty(key)) {
                        attributes.set(key, req.body.attributes[key]);
                    }
                }
            }

            // set user attributes if any
            // -----------------------------------------------------------------
            const userAttributes = new Map();
            if (req.body.userAttributes) {
                for (const key in req.body.userAttributes) {
                    if (req.body.userAttributes.hasOwnProperty(key)) {
                        userAttributes.set(key, req.body.userAttributes[key]);
                    }
                }
            }

            // set links if any
            // -----------------------------------------------------------------
            const links = [];
            if (req.body.links) {
                for (const link of req.body.links) {
                    links.push({
                        to: nsvc.verify.toObjectId(link.to._id ? link.to._id : link.to),
                        usage: link.usage
                    });
                }
            }

            // Get quota user or group
            // -----------------------------------------------------
            let quotaUser = null;
            let quotaGroup = null;
            if (folder) {
                quotaUser = await nsvc.folderService.getFolderQuotaUser(folder, client);
                if (!quotaUser)
                    quotaGroup = await nsvc.folderService.getFolderQuotaGroup(folder, client);
            }

            // Create new item
            // -----------------------------------------------------
            const location = folderLocation || req.user.location;
            const itemData = {
                name: finalName,
                folder: folder,
                version: version,
                // Use the location of the parent folder, but if no folder was specified, then use the location of the user.
                location: location,
                visibility: visibility,
                allowConversation: allowConversation,
                type: type,
                attributes: attributes,
                userAttributes: userAttributes,
                userAttributeTemplate: userAttributeTemplate,
                links: links,
                client: client,
                createdBy: req.userObjectId,
                updatedBy: req.userObjectId,
                quotaUser: quotaUser,
                quotaGroup: quotaGroup,
                recalculateItemSize: true,
                __user: req.userObjectId
            };
            const item = new Item(itemData);

            // Verify quota is not exceeded
            // -----------------------------------------------------
            if (quotaUser || quotaGroup) {
                let length = JSON.stringify(itemData).length;

                if (itemTemplate)
                    length += itemTemplate.additionalItemsLength;

                if (quotaUser)
                    await nsvc.userService.verifyQuota(quotaUser, req.user.client, length);
                else
                    await nsvc.groupService.verifyQuota(quotaGroup, req.user.client, length);
            }

            // Apply item template
            // -----------------------------------------------------
            if (itemTemplate) {
                await nsvc.itemTemplateService.applyItemTemplate(itemTemplate, item, location, req.user);
            }

            // Save new item
            // -----------------------------------------------------
            await item.save({ __user: req.userObjectId });

            if (folder) {
                // update timestamp for all folder parents so they are in sync
                await nsvc.folderService.markFolderAndAllParentsUpdated(folder, req.user.client);
            }

            await nsvc.aclTools.updateAclCache(item, req.user.clientAcl, "item");

            res.status(201).json({
                result: "success",
                data: item._id
            });
        });
    })

// ############################################################################################################
// Modify an item
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([],{ fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.body._id);
            const name = nsvc.verify.itemOrFolderName(req, "name");
            const version = nsvc.verify.optionalVersion(req, "version");
            const description = nsvc.verify.optionalStringOrNull(req, "description", MAX_ITEM_DESCRIPTION_LENGTH);
            const shortDescription = nsvc.verify.optionalStringOrNull(req, "shortDescription", MAX_ITEM_SHORT_DESCRIPTION_LENGTH);
            const tags = nsvc.verify.optionalStringArray(req, "tags", MAX_TAG_LENGTH, MAX_TAG_COUNT);
            const contributors = nsvc.verify.optionalStringArray(req, "contributors");
            const flags = nsvc.verify.optionalStringArray(req, "flags");
            const visibility = nsvc.verify.optionalIntegerNumberRange(req, "visibility", 0, 3);
            const allowConversation = nsvc.verify.optionalBoolean(req, "allowConversation");
            const userAttributeTemplate = nsvc.verify.optionalObjectId(req, "userAttributeTemplate");
            const categories = nsvc.verify.optionalObjectIdArray(req, "categories");
            const license = nsvc.verify.optionalObjectId(req, "license");

            if (userAttributeTemplate !== undefined && !req.plan.attributeTemplatesAllowed) {
                res.json({
                    result: "failed",
                    error: "Attribute templates not enabled."
                });
                return;
            }

            // Fetch the item
            // -----------------------------------------------------
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);
            const select = '-thumbnails -attachments -storages -encryptionKey';
            const item = await query.select(select).exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found or not writable"
                });
            }
            else {

                // Make sure the user has write permissions on the item
                // -----------------------------------------------------
                if (!await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                    res.status(403).json({
                        result: "failed",
                        error: "Permission denied"
                    });
                    return;
                }

                // Make sure the user has publish permissions in case this flag is changed
                // -----------------------------------------------------
                const isPublicChanged = (item.visibility >= 2 && visibility < 2) ||
                                        (item.visibility < 2 && visibility >= 2);
                if (isPublicChanged && !nsvc.aclTools.verifyAcl(item.resultingAcl, req.user, "publish")) {
                    res.status(403).json({
                        result: "failed",
                        error: "permission to publish or unpublish denied"
                    });
                    return;
                }

                // Make sure the user has the feature activated to make items private or unlisted
                // -----------------------------------------------------
                const isMadePrivate = item.visibility >= 2 && visibility < 2;
                if (isMadePrivate) {
                    const privateAllowed = await nsvc.clientService.isFeatureAllowed(req.user.client, "private_items", req.user, item.quotaGroup);
                    if (!privateAllowed) {
                        res.json({
                            result: "failed",
                            error: "You are not allowed to make items private or unlisted!"
                        });
                        return;
                    }
                }

                // Check for existance of other item with that name
                // -----------------------------------------------------
                if (name !== item.name) {
                    let { conflict } = await nsvc.folderService.isNameConflict(name, item.folder, req.user.client, false);
                    if (conflict) {
                        res.json({
                            result: "failed",
                            error: "Item or folder with that name already exists"
                        });
                        return;
                    }
                }

                // Check for existance of the user attribute template
                // -----------------------------------------------------
                if (userAttributeTemplate) {
                    const AttributeTemplate = mongoose.model("AttributeTemplate");
                    const attributeTemplate = await AttributeTemplate.findOne({
                        _id: userAttributeTemplate,
                        client: item.client
                    }).exec();

                    if (!attributeTemplate) {
                        res.status(404).json({
                            result: "failed",
                            error: "User attribute template not found!"
                        });
                        return;
                    }
                }

                // Modify item
                // -----------------------------------------------------
                const update = {};
                update.name = name;
                update.updatedBy = req.userObjectId;

                if (visibility !== undefined)
                    update.visibility = visibility;

                if (description !== null)
                    update.description = description;

                if (shortDescription !== null)
                    update.shortDescription = shortDescription;

                if (version !== undefined)
                    update.version = nsvc.verify.verifyVersionIncrement(item.version, version);
                else if (item.version) {
                    update.version = {
                        major: item.version.major ? item.version.major : 0,
                        minor: item.version.minor ? item.version.minor : 0,
                        revision: item.version.revision ? (item.version.revision+1) : 1,
                    };
                } else {
                    update.version = {
                        major: 0,
                        minor: 0,
                        revision: 1,
                    };
                }

                if (tags)
                    update.tags = nsvc.itemService.processTags(tags);

                if (contributors)
                    update.contributors = await nsvc.itemService.processContributors(contributors, item.client);

                if (categories)
                    update.categories = await nsvc.itemService.processCategories(categories, item.client);

                if (license !== undefined) {
                    if (license !== null) {
                        if (!await nsvc.licenseService.existsLicense(license, item.client)) {
                            throw new ValidationError("License does not exist!");
                        }
                    }
                    update.license = license;
                }

                if (allowConversation !== undefined) {
                    update.allowConversation = allowConversation;
                }

                if (userAttributeTemplate !== undefined) {
                    update.userAttributeTemplate = userAttributeTemplate;
                }

                // update properties
                // -----------------------------------------------------------------
                if (req.body.properties && (req.isSystemUser || req.isClientSystemUser) ) {
                    update.properties = new Map();
                    for (const key in req.body.properties) {
                        if (req.body.properties.hasOwnProperty(key)) {
                            update.properties.set(key, req.body.properties[key]);
                        }
                    }
                }

                // update attributes
                // -----------------------------------------------------------------
                if (req.body.attributes) {
                    update.attributes = new Map();
                    for (const key in req.body.attributes) {
                        if (req.body.attributes.hasOwnProperty(key)) {
                            update.attributes.set(key, req.body.attributes[key]);
                        }
                    }
                }

                // update user attributes
                // -----------------------------------------------------------------
                if (req.body.userAttributes) {
                    update.userAttributes = new Map();
                    for (const key in req.body.userAttributes) {
                        if (req.body.userAttributes.hasOwnProperty(key)) {
                            update.userAttributes.set(key, req.body.userAttributes[key]);
                        }
                    }
                }

                // update links
                // -----------------------------------------------------------------
                if (Array.isArray(req.body.links)) {
                    update.links = [];

                    if (req.body.links.length) {
                        const datatype = await nsvc.datatypeService.getDatatype(item.type);
                        if (!datatype) {
                            throw new ValidationError("Datatype does not exist!");
                        }

                        const stop = !!datatype.recursiveLoadStopsHere;

                        for (const link of req.body.links) {
                            const entry = {
                                to: nsvc.verify.toObjectId(link.to._id ? link.to._id : link.to),
                                usage: link.usage,
                            };

                            if (stop)
                                entry.stopRecursion = true;

                            update.links.push(entry);
                        }
                    }
                }

                // update ACLs
                // -----------------------------------------------------------------
                if (req.body.acl) {
                    await nsvc.aclTools.changeAcl(item, req.body.acl, req.user);
                    update.acl = item.acl;
                }

                if (flags) {
                    // A mapping between flags and a verification function to check if the flag can be applied to the item.
                    // The function returns either true when the flag is valid or an error message when the flag is invalid.
                    const flagsMap = {
                        cloneable: () => {
                            return item.type === "Package" || "Item needs to be a package";
                        }
                    }

                    const allowedFlags = Object.keys(flagsMap);
                    const invalidFlags = flags.filter(x => !allowedFlags.includes(x));

                    if (invalidFlags.length > 0) {
                        res.status(400).json({
                            result: "failed",
                            error: "invalid flags: " + invalidFlags.join(", ")
                        });
                        return;
                    }

                    for (const flag of flags) {
                        const status = await flagsMap[flag]();
                        if (status !== true) {
                            res.status(400).json({
                                result: "failed",
                                error: `can't apply flag ${flag}: ${status}`
                            });
                            return;
                        }
                    }

                    update.flags = flags;
                }

                // save
                // -----------------------------------------------------------------
                if (await nsvc.itemService.handleDependencyChange(item, req.userObjectId, !!req.body.attributes, !!req.body.links, false))
                    update.recreateThumbnailsAndPreviews = true;

                Object.assign(item, update);
                await nsvc.auditService.createAuditLog(item, select);

                update.recalculateItemSize = true;
                // We need to load the new state of the element to get the up-to-date ACL.
                const updatedItem = await Item.findOneAndUpdate({ _id: item._id }, { $set: update }, { new: true });

                if (item.folder) {
                    // update timestamp for all folder parents so they are in sync
                    await nsvc.folderService.markFolderAndAllParentsUpdated(item.folder, item.client);
                }

                await nsvc.aclTools.updateAclCache(updatedItem, req.user.clientAcl, "item");

                res.json({
                    result: "success",
                    data: {
                        version: update.version
                    }
                });
            }
        });
    })

// ############################################################################################################
// Delete an item
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

            // read all files and check if user has access to them (same client)
            const Item = mongoose.model('Item');
            const items = await Item.find({
                _id: idArray,
                client: req.user.client,
                deletedAt: { $exists: false }
            }).select("_id acl folder").exec();

            if (items.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
                return;
            }

            const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "write");

            if (filteredItems.length === 0) {
                res.status(403).json({
                    result: "failed",
                    error: "No files could be deleted"
                });
            } else {
                const filteredIdArray = filteredItems.map(x => x._id);

                // Get a list of all affected folder IDs
                // -----------------------------------------------------
                const affectedFolders = new Map();
                for (const item of filteredItems) {
                    if (item.folder) {
                        affectedFolders.set(item.folder.toString(), item.folder);
                    }
                }

                const affectedFolderIds = Array.from(affectedFolders.values());

                // mark all items as deleted
                // -----------------------------------------------------
                const updatedAt = Date.now();

                await Item.updateMany({
                    _id: filteredIdArray,
                    client: req.user.client
                }, {
                    $set: {
                        deletedAt: updatedAt,
                        updatedBy: req.userObjectId
                    }
                }, {
                    __user: req.userObjectId
                }).exec();

                // Now trigger folder size recalculation
                // -----------------------------------------------------
                if (affectedFolderIds.length) {
                    const Folder = mongoose.model('Folder');
                    await Folder.updateMany({
                        _id: affectedFolderIds
                    }, {
                        $set: {
                            recalculateContentSize: true,
                            updatedAt: updatedAt
                        }
                    }, {
                        timestamps: false
                    });
                }

                for (const affectedFolderId of affectedFolderIds) {
                    // update timestamp for all folder parents so they are in sync
                    await nsvc.folderService.markFolderAndAllParentsUpdated(affectedFolderId, req.user.client);
                }

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Public query for items
// ############################################################################################################
router.route('/publicquery')
    .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.body)
                throw new ValidationError("Body is undefined.");

            const fulltext = nsvc.verify.optionalString(req, "fulltext");
            const clientId = nsvc.verify.objectId(req, "client");
            const types = nsvc.verify.optionalStringArray(req, "types");
            const includePackagedTypes = nsvc.verify.optionalBoolean(req, "includePackagedTypes");
            const onlyPackagedTypes = nsvc.verify.optionalBoolean(req, "onlyPackagedTypes");
            const name = nsvc.verify.optionalString(req, "name");
            const user = nsvc.verify.optionalString(req, "user");
            const categories = nsvc.verify.optionalStringOrNull(req, "categories");
            const licenses = nsvc.verify.optionalStringOrNull(req, "licenses");
            const tags = nsvc.verify.optionalStringArray(req, "tags");
            const contributors = nsvc.verify.optionalStringArray(req, "contributors");
            const anyCategories = nsvc.verify.optionalBoolean(req, "anyCategories");
            const anyTags = nsvc.verify.optionalBoolean(req, "anyTags");
            const anyContributors = nsvc.verify.optionalBoolean(req, "anyContributors");
            const mimeType = nsvc.verify.optionalString(req, "mimeType");
            const quotaUser = nsvc.verify.optionalString(req, "quotaUser");
            const quotaGroup = nsvc.verify.optionalString(req, "quotaGroup");
            const attribute = nsvc.verify.optionalString(req, "attribute");
            const attributeValue = nsvc.verify.optionalString(req, "attributeValue");
            const userAttribute = nsvc.verify.optionalString(req, "userAttribute");
            const userAttributeValue = nsvc.verify.optionalString(req, "userAttributeValue");
            const returnIdOnly = nsvc.verify.optionalBoolean(req, "returnIdOnly");
            const returnCountOnly = nsvc.verify.optionalBoolean(req, "returnCountOnly");
            const withAttributes = nsvc.verify.optionalBoolean(req, "withAttributes");
            const withUserAttributes = nsvc.verify.optionalBoolean(req, "withUserAttributes");
            const withProperties = nsvc.verify.optionalBoolean(req, "withProperties");
            const withAttachmentInfo = nsvc.verify.optionalBoolean(req, "withAttachmentInfo");
            const withStats = nsvc.verify.optionalBoolean(req, "withStats");
            const userAttributeTemplate = nsvc.verify.optionalStringOrNull(req, "userAttributeTemplate");
            const dateFrom = nsvc.verify.optionalDate(req, "dateFrom");
            const dateTo = nsvc.verify.optionalDate(req, "dateTo");
            const sort = nsvc.verify.optionalString(req, "sort");
            const sortOrder = nsvc.verify.optionalString(req, "sortOrder");
            const pageSize = nsvc.verify.optionalIntegerNumberRange(req, "pageSize", 0, 1000, 1000);
            const pageIndex = nsvc.verify.optionalIntegerNumber(req, "pageIndex", 0);

            const Client = mongoose.model('Client');
            const client = await Client.findOne({ _id: clientId, deletedAt: { $exists: false }}).select("publicQueryAllowed").exec();

            if (!client || !client.publicQueryAllowed) {
                res.status(403).json({
                    result: "failed",
                    error: "Public query not allowed"
                });
                return;
            }

            const options = {
                fulltext: fulltext,
                types: types,
                includePackagedTypes: includePackagedTypes,
                onlyPackagedTypes: onlyPackagedTypes,
                name: name,
                user: user,
                quotaUser: quotaUser,
                quotaGroup: quotaGroup,
                categories: categories,
                licenses: licenses,
                anyCategories: anyCategories,
                tags: tags,
                anyTags: anyTags,
                contributors: contributors,
                anyContributors: anyContributors,
                mimeType: mimeType,
                visibility: 3, // public
                attribute: attribute,
                attributeValue: attributeValue,
                userAttribute: userAttribute,
                userAttributeValue: userAttributeValue,
                returnIdOnly: returnIdOnly,
                returnCountOnly: returnCountOnly,
                withAttributes: withAttributes,
                withUserAttributes: withUserAttributes,
                withProperties: withProperties,
                withAttachmentInfo: withAttachmentInfo,
                withStats: withStats,
                withThumbnailCount: false,
                userAttributeTemplate: userAttributeTemplate,
                client: clientId,
                dateFrom: dateFrom,
                dateTo: dateTo,
                sort: sort,
                sortOrder: sortOrder,
                pageSize: pageSize,
                pageIndex: pageIndex
            };

            const data = await nsvc.itemService.query(options);
            res.json({
                result: "success",
                data: data
            });
        });
    });

// ############################################################################################################
// Query for items
// ############################################################################################################
router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            if (!req.body)
                throw new ValidationError("Body is undefined.");

            const fulltext = nsvc.verify.optionalString(req, "fulltext");
            const types = nsvc.verify.optionalStringArray(req, "types");
            const includePackagedTypes = nsvc.verify.optionalBoolean(req, "includePackagedTypes");
            const onlyPackagedTypes = nsvc.verify.optionalBoolean(req, "onlyPackagedTypes");
            const name = nsvc.verify.optionalString(req, "name");
            const categories = nsvc.verify.optionalStringOrNull(req, "categories");
            const licenses = nsvc.verify.optionalStringOrNull(req, "licenses");
            const tags = nsvc.verify.optionalStringArray(req, "tags");
            const contributors = nsvc.verify.optionalStringArray(req, "contributors");
            const anyCategories = nsvc.verify.optionalBoolean(req, "anyCategories");
            const anyTags = nsvc.verify.optionalBoolean(req, "anyTags");
            const anyContributors = nsvc.verify.optionalBoolean(req, "anyContributors");
            const mimeType = nsvc.verify.optionalString(req, "mimeType");
            const folder = nsvc.verify.optionalObjectId(req, "folder");
            const user = nsvc.verify.optionalString(req, "user");
            const quotaUser = nsvc.verify.optionalString(req, "quotaUser");
            const quotaGroup = nsvc.verify.optionalString(req, "quotaGroup");
            const attribute = nsvc.verify.optionalString(req, "attribute");
            const attributeValue = nsvc.verify.optionalString(req, "attributeValue");
            const userAttribute = nsvc.verify.optionalString(req, "userAttribute");
            const userAttributeValue = nsvc.verify.optionalString(req, "userAttributeValue");
            const visibility = nsvc.verify.optionalIntegerNumberRange(req, "visibility", 0, 3);
            const liked = nsvc.verify.optionalBoolean(req, "liked");
            const findMissingThumbnails = nsvc.verify.optionalBoolean(req, "findMissingThumbnails");
            const findMissingPerceptiveHashes = nsvc.verify.optionalBoolean(req, "findMissingPerceptiveHashes");
            const findMissingPreviews = nsvc.verify.optionalBoolean(req, "findMissingPreviews");
            const findMissingLodLevels = nsvc.verify.optionalBoolean(req, "findMissingLodLevels");
            const hasFileSize = nsvc.verify.optionalBoolean(req, "hasFilesize");
            const returnIdOnly = nsvc.verify.optionalBoolean(req, "returnIdOnly");
            const returnCountOnly = nsvc.verify.optionalBoolean(req, "returnCountOnly");
            const returnHashesAndDatesOnly = nsvc.verify.optionalBoolean(req, "returnHashesAndDatesOnly");
            const withAttributes = nsvc.verify.optionalBoolean(req, "withAttributes");
            const withUserAttributes = nsvc.verify.optionalBoolean(req, "withUserAttributes");
            const withProperties = nsvc.verify.optionalBoolean(req, "withProperties");
            const withAttachmentInfo = nsvc.verify.optionalBoolean(req, "withAttachmentInfo");
            const withStats = nsvc.verify.optionalBoolean(req, "withStats");
            const withThumbnailCount = nsvc.verify.optionalBoolean(req, "withThumbnailCount");
            const userAttributeTemplate = nsvc.verify.optionalStringOrNull(req, "userAttributeTemplate");
            const exportAsExcel = nsvc.verify.optionalBoolean(req, "exportAsExcel");
            const dateFrom = nsvc.verify.optionalDate(req, "dateFrom");
            const dateTo = nsvc.verify.optionalDate(req, "dateTo");
            const sort = nsvc.verify.optionalString(req, "sort");
            const sortOrder = nsvc.verify.optionalString(req, "sortOrder");
            const pageSize = nsvc.verify.optionalIntegerNumberRange(req, "pageSize", 0, 1000, 1000);
            const pageIndex = nsvc.verify.optionalIntegerNumber(req, "pageIndex", 0);

            const options = {
                fulltext: fulltext,
                types: types,
                includePackagedTypes: includePackagedTypes,
                onlyPackagedTypes: onlyPackagedTypes,
                name: name,
                user: user,
                quotaUser: quotaUser,
                quotaGroup: quotaGroup,
                categories: categories,
                licenses: licenses,
                anyCategories: anyCategories,
                tags: tags,
                contributors: contributors,
                liked: liked,
                anyTags: anyTags,
                anyContributors: anyContributors,
                mimeType: mimeType,
                folder: folder,
                attribute: attribute,
                attributeValue: attributeValue,
                userAttribute: userAttribute,
                userAttributeValue: userAttributeValue,
                visibility: visibility,
                findMissingThumbnails: findMissingThumbnails,
                findMissingPerceptiveHashes: findMissingPerceptiveHashes,
                findMissingPreviews: findMissingPreviews,
                findMissingLodLevels: findMissingLodLevels,
                hasFileSize: hasFileSize,
                returnIdOnly: returnIdOnly,
                returnCountOnly: returnCountOnly,
                returnHashesAndDatesOnly: returnHashesAndDatesOnly,
                withAttributes: withAttributes,
                withUserAttributes: withUserAttributes,
                withProperties: withProperties,
                withAttachmentInfo: withAttachmentInfo,
                withStats: withStats,
                withThumbnailCount: withThumbnailCount,
                userAttributeTemplate: userAttributeTemplate,
                exportAsExcel: exportAsExcel,
                client: req.isSystemUser ? null : req.user.client,
                dateFrom: dateFrom,
                dateTo: dateTo,
                sort: sort,
                sortOrder: sortOrder,
                pageSize: pageSize,
                pageIndex: pageIndex
            };

            const data = await nsvc.itemService.query(options, req.user)
            if (exportAsExcel) {
                nsvc.spreadsheetService.sendXlsx(res, data.xlsx);
            } else {
                res.json({
                    result: "success",
                    data: data
                });
            }
        });
    });

// ############################################################################################################
// Get list of all items in a folder
// ############################################################################################################
router.route('/infolder/:folderId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let nextItem = null;

            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            let folderId = req.params.folderId;
            let clientId = null;

            if (folderId === "0")
                folderId = null;
            else
                folderId = nsvc.verify.toObjectId(folderId);

            if (!req.isSystemUser)
                clientId = req.user.client;

            const data = await nsvc.itemService.getItemsInFolderPaginated(folderId, clientId, req.user, req.query.pageSize, nextItem);

            res.json({
                result: "success",
                data: data.items,
                next: data.nextObjectID
            });
        });
    });

// ############################################################################################################
// Get item's ACL
// ############################################################################################################
router.route('/acl/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const itemId = nsvc.verify.toObjectId(req.params.id);
            const acl = await nsvc.aclTools.getAclForItemId(itemId, req.user.client);

            if (nsvc.aclTools.verifyAcl(acl, req.user, "read")) {
                res.json({
                    result: "success",
                    data: acl
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
        });
    });

// ############################################################################################################
// Clear auto destruction
// ############################################################################################################
router.route('/clearAutoDestruct/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const itemId = nsvc.verify.toObjectId(req.params.id);

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(itemId);
            const item = await query.select('hash acl client folder').exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                await Item.updateOne({ _id: itemId }, { $unset: { autoDestructAt: 1 }});
                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Set auto destruction
// ############################################################################################################
router.route('/setAutoDestruct/:id/:date')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const itemId = nsvc.verify.toObjectId(req.params.id);
            const date = nsvc.verify.toDate(req.params.date);

            if (moment(date).isBefore(moment())) {
                throw new ValidationError("Date must be in the future");
            }

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(itemId);
            const item = await query.select('hash acl client').exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                await Item.updateOne({ _id: itemId }, { $set: { autoDestructAt: date }});
                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Get item's hash
// ############################################################################################################
router.route('/hash/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));
            const item = await query.select('hash acl folder client').exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                res.json({
                    result: "success",
                    data: item.hash
                });
            }
        });
    });

// ############################################################################################################
// Get item's data by id
// ############################################################################################################
router.route('/download/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("filesize").exists(true);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));

            const item = await query.select('name type folder mimeType packageType filesize filename client hash acl encryptionKey storages quotaUser quotaGroup').exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                await nsvc.itemService.download(req, res, item, false);
            }
        });
    });

// ############################################################################################################
// Get public item's data by id
// ############################################################################################################
router.route('/publicdownload/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));
            query.where("visibility").gte(2); // public or not listed
            query.where("deletedAt").exists(false);
            query.where("filesize").exists(true);

            const item = await query.select('name type mimeType packageType filesize filename client hash encryptionKey storages quotaUser quotaGroup').exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.requestedItemClient = item.client;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                await nsvc.itemService.download(req, res, item, true);
            }
        });
    });

// ############################################################################################################
// Request a secure download link that works without Json Web Token
// ############################################################################################################
router.route('/requestsecuredownload/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("filesize").exists(true);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));

            const item = await query.select('_id folder acl client').exec();
            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found or has no file data"
                });
            } else {
                res.json({
                    result: "success",
                    data: nsvc.security.createLinkWithBewit('/api/item/securedownload/' + req.params.id)
                });
            }
        });
    });

// ############################################################################################################
// Get item's data by id using a bewit instead of JWT
// ############################################################################################################
router.route('/securedownload/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.validateMac, function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));
            query.where("filesize").exists(true);
            const item = await query.select('name type mimeType packageType filesize filename client hash acl encryptionKey storages quotaUser quotaGroup').exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                await nsvc.itemService.download(req, res, item, false);
            }
        });
    });

// ############################################################################################################
// Get item's thumbnail
// ############################################################################################################
router.route('/thumbnail/:size/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const Item = mongoose.model('Item');
            const query = Item.findOne();
            const size = parseInt(req.params.size);

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));

            const item = await query.select('thumbnails acl folder client quotaUser quotaGroup').exec();
            if (!item ||
                !item.thumbnails ||
                item.thumbnails.length === 0 ||
                !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found or has no thumbnail"
                });
            } else {
                for (const thumbnail of item.thumbnails) {
                    if (thumbnail.size === size) {

                        // Set values on request object to track traffic in middleware
                        req.requestedItem = item._id;
                        req.quotaUser = item.quotaUser;
                        req.quotaGroup = item.quotaGroup;

                        res.json({
                            result: "success",
                            data: thumbnail.data
                        });
                        return;
                    }
                }

                res.status(404).json({
                    result: "failed",
                    error: "Size not found"
                });
            }
        });
    });

// ############################################################################################################
// Get public item's thumbnail
// ############################################################################################################
router.route('/publicthumbnail/:size/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const Item = mongoose.model('Item');
            const query = Item.findOne();
            const size = parseInt(req.params.size);

            query.where("deletedAt").exists(false);
            query.where("visibility").gte(2); // public or not listed
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));

            const item = await query.select('client thumbnails quotaUser quotaGroup').exec();
            if (!item ||
                !item.thumbnails ||
                item.thumbnails.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found or has no thumbnail"
                });
            } else {
                for (const thumbnail of item.thumbnails) {
                    if (thumbnail.size === size) {

                        // Set values on request object to track traffic in middleware
                        req.requestedItem = item._id;
                        req.requestedItemClient = item.client;
                        req.quotaUser = item.quotaUser;
                        req.quotaGroup = item.quotaGroup;

                        res.json({
                            result: "success",
                            data: thumbnail.data
                        });
                        return;
                    }
                }

                res.status(404).json({
                    result: "failed",
                    error: "Size not found"
                });
            }
        });
    });

// ############################################################################################################
// Upload data without creating an item first. Item will be created automatically
// ############################################################################################################
router.route('/uploadAndCreate/:folderId')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const busboy = new Busboy({ headers: req.headers });

            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {

                return nsvc.common.handleError(req, res, async function() {

                    // Get the name of the item and check that it is filled and does not exist
                    // ------------------------------------------------------------------------
                    let name = path.basename(filename, path.extname(filename));
                    if (req.headers['x-override-name']) {
                        name = req.headers['x-override-name'];
                    }

                    nsvc.verify.verifyItemOrFolderName(name);
                    const folder = parseInt(req.params.folderId) === 0 ? null : nsvc.verify.toObjectId(req.params.folderId);
                    const autoDestructIn = req.query.autoDestructIn ? parseInt(req.query.autoDestructIn) : undefined;

                    // Check for existance of parent folder with that client
                    // -----------------------------------------------------
                    if (folder) {
                        const Folder = mongoose.model('Folder');
                        const parentFolder = await Folder.findOne({
                            _id: folder,
                            client: req.user.client,
                            deletedAt: {$exists: false}
                        }).select("_id").exec();

                        if (!parentFolder) {
                            res.status(404).json({
                                result: "failed",
                                error: "Parent folder not found"
                            });
                            return;
                        }
                    }

                    // Check for write permission on the folder
                    // -----------------------------------------------------
                    if (!await nsvc.aclTools.verifyAndGetAclForFolderId(folder, req.user, "write")) {
                        res.status(403).json({
                            result: "failed",
                            error: "Permission denied to write to folder"
                        });
                        return;
                    }

                    // Create and upload item
                    // -----------------------------------------------------
                    const item = await nsvc.itemService.createItemFromStream(folder, req.client, req.plan, req.user, name, filename, autoDestructIn, file, false);

                    res.status(201).json({
                        result: "success",
                        data: item._id
                    });
                });
            });

            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Upload data to item
// ############################################################################################################
router.route('/upload/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');

            // Use a "findAndUpdate" operation to find the item and at the same time set the uploadHeartbeat.
            // The item must either have the uploadHeartbeat field unset, or set to a value that is over 5 seconds
            // in the past, to prevent having multiple uploads running for the same item.
            const query = {
                _id: id,
                deletedAt: {$exists: false},
                $or: [
                    {uploadHeartbeat: {$lt: new Date(new Date().getTime() - 5000)}},
                    {uploadHeartbeat: null},
                    {uploadHeartbeat: {
                        $exists: false
                    }}
                ]
            };

            if (!req.isSystemUser)
                query["client"] = req.user.client;

            const item = await Item.findOneAndUpdate(query, {
                uploadHeartbeat: new Date()
            }).select("-attributes -properties -thumbnails -attachments").exec()

            // If there is no item (or if the item does not have an appropriate uploadHeartbeat value), then we return an error.
            // This check is done before processing the upload with busyboy, because it's difficult
            // to stop the upload with busyboy once it has started.
            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                // To send a more precise error message, we check if we can find the item without looking at the uploadHeartbeat field.
                // If we can't, then the item really does not exist, otherwise it means that there is another upload running.
                const itemWithoutLock = await Item.findOne({
                    _id: id,
                    deletedAt: {$exists: false},
                }).exec();

                if (itemWithoutLock) {
                    res.json({
                        result: "failed",
                        error: "An upload to this item is already in progress."
                    });
                } else {
                    res.json({
                        result: "failed",
                        error: "Item not found"
                    });
                }
                return;
            }

            const favoredStorageId = nsvc.itemService.preChecksForUpload(item, req.client, req.plan);

            // If no error occured till here, we can start the upload.
            const busboy = new Busboy({ headers: req.headers });
            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {

                return nsvc.common.handleError(req, res,async function() {
                    // Start an interval to periodically update the uploadHeartbeat field.
                    // This way no other upload can start for this item.
                    const heartbeatInterval = setInterval(async () => {
                        await Item.findOneAndUpdate({
                            _id: id,
                        }, {
                            uploadHeartbeat: new Date()
                        }).exec()
                    }, 4000);

                    // Wrap everything in a try-catch block to ensure that the interval is cleared.
                    try {
                        // Reset the fields of the item and store the previous file size and storages array.
                        const previousFileSize = item.filesize || 0;
                        const previousStorages = item.storages || [];

                        item.hash = "";
                        item.mimeType = "";
                        item.encryptionKey = undefined;
                        item.filename = filename;
                        item.updatedBy = req.userObjectId;
                        item.__user = req.userObjectId;
                        item.thumbnails = undefined;
                        item.properties = undefined;
                        item.perceptiveHash = undefined;
                        item.recalculateItemSize = true;

                        // Upload to a temporary file.
                        await nsvc.itemService.uploadFile(file, item, true, req.client, req.plan, true, filename, true);

                        // Execute various checks on the file before continuing.
                        try {
                            // Verify that the quota is not exceeded.
                            const delta = item.filesize - previousFileSize;
                            if (delta > 0) {
                                if (item.quotaUser)
                                    await nsvc.userService.verifyQuota(item.quotaUser, req.user.client, delta);
                                else if (item.quotaGroup)
                                    await nsvc.groupService.verifyQuota(item.quotaGroup, req.user.client, delta);
                            }

                            // Verify that the content type is supported by the item type.
                            const matches = await nsvc.itemService.matchesContentType(item.type, item.mimeType);

                            // If the item is a script and the mimeType is
                            // empty, then we allow the upload, even though the
                            // content type doesn't match.
                            if (!matches && !(item.type === "Script" && item.mimeType === "")) {
                                throw "Content type is not supported by this item type";
                            }
                        } catch (err) {
                            // If an error occurs, we need to clean up the temporary file.
                            await nsvc.fileStorage.delete("temp_" + item._id.toString(), favoredStorageId);

                            // Re-throw the error to trigger a clean up.
                            throw err;
                        }

                        // At this point we know that the file upload is allowed to take place.

                        // If the item had a file before, then we need to delete the old file.
                        // To prevent data loss, we don't delete the file in the favored storage.
                        if (previousFileSize) {
                            // Before deleting the actual files in the buckets, we
                            // specify the only remaining storage as the only
                            // storage for this item. This way users will still be
                            // able to download the item even during this upload process.
                            // Note: We purposefully don't modify the storageHash to
                            // prevent the JS:SyncStorage job from cloning the file.
                            // This would otherwise lead to a race condition between
                            // the webapi and the JsJobAgent.
                            await Item.findOneAndUpdate({
                                _id: id,
                            }, {
                                storages: [favoredStorageId]
                            }).exec();
                            item.storages = [favoredStorageId];

                            // Now delete the actual files from the buckets.
                            const promises = [];
                            try {
                                for (const storage of previousStorages) {
                                    if (storage !== favoredStorageId) {
                                        promises.push(nsvc.fileStorage.delete(item._id.toString(), storage).catch(function(err) {
                                            nsvc.logger.error(err);
                                        }));
                                    }
                                }
                            }
                            catch(err) {
                                nsvc.logger.error(err);
                            }

                            await Promise.all(promises);
                        }

                        // Create a backup of the previous file.
                        if (previousFileSize) {
                            // Sadly, the tests currently have items with a filesize that are not in any storage.
                            try {
                                await nsvc.fileStorage.copy(item._id.toString(), "backup_" + item._id.toString(), favoredStorageId);
                            } catch (_) {}
                        }

                        try {
                            // Copy the temporary file we have uploaded earlier to the real file.
                            await nsvc.fileStorage.copy("temp_" + item._id.toString(), item._id.toString(), favoredStorageId);
                            await nsvc.fileStorage.delete("temp_" + item._id.toString(), favoredStorageId);
                        } catch (err) {
                            // If an error occured during the copy, we need to restore the backup and delete the temporary file.
                            if (previousFileSize) {
                                await nsvc.fileStorage.copy("backup_" + item._id.toString(), item._id.toString(), favoredStorageId);
                                await nsvc.fileStorage.delete("backup_" + item._id.toString(), favoredStorageId);
                            }
                            await nsvc.fileStorage.delete("temp_" + item._id.toString(), favoredStorageId);

                            // Re-throw the error to trigger a clean up.
                            throw err;
                        }

                        // Since the old file has been deleted, we can now decrease the clients storage.
                        await nsvc.clientMetrics.incStorage(req.client, -1, -previousFileSize);

                        // At this point the item has the correct metadata and the file is stored in the correct storage.
                        // We can now clear the storageHash to trigger the JS:SyncStorage job to clone the file to the other storages.
                        item.storageHash = undefined;
                        await item.save({__user: req.userObjectId});

                        // Handle dependencies. All items that are dependent on this one should be reprocessed
                        // -----------------------------------------------------------------------------------
                        await nsvc.itemService.handleDependencyChange(item, req.userObjectId, false, false, true);

                        clearInterval(heartbeatInterval);

                        // Wait a bit before clearing the uploadHeartbeat, since
                        // the heartbeatInterval might already be in the middle
                        // of an update.
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        await Item.findOneAndUpdate({
                            _id: id,
                        }, {
                            uploadHeartbeat: null
                        }).exec();

                        res.json({
                            result: "success"
                        });
                    } catch (e) {
                        clearInterval(heartbeatInterval);

                        // Wait a bit before clearing the uploadHeartbeat, since
                        // the heartbeatInterval might already be in the middle
                        // of an update.
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        await Item.findOneAndUpdate({
                            _id: id,
                        }, {
                            uploadHeartbeat: null
                        }).exec();

                        res.json({
                            result: "failed",
                            error: e.toString()
                        });
                    }
                });
            });

            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Clear thumbnail of item
// ############################################################################################################
router.route('/clearThumbnail/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            const item = await query.select("-attributes -properties").exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                item.thumbnails = [];
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;
                item.recreateThumbnailsAndPreviews = false;
                await item.save({__user: req.userObjectId});

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Reset thumbnail of item
// ############################################################################################################
router.route('/resetThumbnail/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            const item = await query.select("-attributes -properties").exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                item.thumbnails = undefined;
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;
                await item.save({__user: req.userObjectId});

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Generate thumbnails from image
// ############################################################################################################
router.route('/generateThumbnails/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const busboy = new Busboy({ headers: req.headers });

            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {
                nsvc.common.handleError(req, res, async function() {

                    const id = nsvc.verify.toObjectId(req.params.id);
                    const Item = mongoose.model('Item');
                    const query = Item.findOne();

                    query.where("deletedAt").exists(false);
                    query.where("_id").equals(id);

                    if (!req.isSystemUser)
                        query.where("client").equals(req.user.client);

                    const item = await query.select("-attributes -properties -userAttributes").exec();

                    if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                        res.status(404).json({
                            result: "failed",
                            error: "Item not found"
                        });
                    } else {
                        const thumbnails = await nsvc.itemService.createThumbnails(file);

                        await Item.updateOne({_id: id}, {
                            $set: {
                                thumbnails,
                                updatedBy: req.userObjectId,
                                recalculateItemSize: true,
                                recreateThumbnailsAndPreviews: false,
                                __user: req.userObjectId
                            }
                        });

                        res.json({
                            result: "success"
                        });
                    }
                });
            });

            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Upload image to generate LOD levels.
// ############################################################################################################
router.route('/generateLodLevels/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {fetchPlan: true, fetchClient: true}), function (req, res) {
            nsvc.common.handleError(req, res, async function() {
                const busboy = new Busboy({ headers: req.headers });
                busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {
                    try {
                        const id = nsvc.verify.toObjectId(req.params.id);
                        const Item = mongoose.model('Item');
                        const query = Item.findOne();

                        if (!req.isSystemUser)
                            query.where("client").equals(req.user.client);

                        query.where("deletedAt").exists(false);
                        query.where("_id").equals(id);

                        const item = await query.select("-attributes -properties -userAttributes").exec();

                        if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                            res.status(404).json({
                                result: "failed",
                                error: "Item not found"
                            });
                            return;
                        }

                        const lodLevelImages = await nsvc.itemService.createLodLevels(file);
                        await nsvc.itemService.addIndexedAttachments(item, lodLevelImages, "lod", req);

                        await Item.updateOne({ _id: id }, {
                            $set: {
                                attachments: item.attachments,
                                encryptionKey: item.encryptionKey,
                                updatedBy: req.userObjectId,
                                recalculateItemSize: true,
                                omitLodGeneration: true,
                                __user: req.userObjectId
                            }
                        });


                        res.json({
                            result: "success"
                        });

                    }
                    catch(err) {
                        logger.error(err);
                        res.json({
                            result: "failed",
                            error: "internal error"
                        });
                    }
                });
            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Download public attachment
// ############################################################################################################
router.route('/publicattachment/:id/:name/:index')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const name = req.params.name;
            const index = parseInt(req.params.index);

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("_id").equals(id);
            query.where("visibility").gte(2); // public or not listed
            query.where("deletedAt").exists(false);

            const item = await query.select('name attachments client encryptionKey quotaUser quotaGroup').exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                let attachment = nsvc.itemService.findAttachment(item, name, index);
                if (!attachment) {
                    res.status(404).json({
                        result: "failed",
                        error: "Attachment not found"
                    });
                } else {

                    // Set values on request object to track traffic in middleware
                    req.requestedItem = item._id;
                    req.requestedItemClient = item.client;
                    req.quotaUser = item.quotaUser;
                    req.quotaGroup = item.quotaGroup;

                    await nsvc.itemService.download(req, res, item, true, attachment);
                }
            }
        });
    });

// ############################################################################################################
// Download attachment
// ############################################################################################################
router.route('/attachment/:id/:name/:index')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const name = req.params.name;
            const index = parseInt(req.params.index);

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(nsvc.verify.toObjectId(req.params.id));

            const item = await query.select('name attachments folder client acl encryptionKey quotaUser quotaGroup').exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                let attachment = nsvc.itemService.findAttachment(item, name, index);
                if (!attachment) {
                    res.status(404).json({
                        result: "failed",
                        error: "Attachment not found"
                    });
                } else {
                    // Set values on request object to track traffic in middleware
                    req.requestedItem = item._id;
                    req.quotaUser = item.quotaUser;
                    req.quotaGroup = item.quotaGroup;

                    await nsvc.itemService.download(req, res, item, false, attachment);
                }
            }
        });
    })

// ############################################################################################################
// Upload attachment to item
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchPlan: true, fetchClient: true, needsSystemUser: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const busboy = new Busboy({ headers: req.headers });
            const name = req.params.name;
            const index = parseInt(req.params.index);

            busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {
                try {
                    const id = nsvc.verify.toObjectId(req.params.id);
                    const Item = mongoose.model('Item');
                    const query = Item.findOne();

                    query.where("deletedAt").exists(false);
                    query.where("_id").equals(id);

                    const item = await query.select("-attributes -properties -userAttributes -thumbnails").exec();

                    if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                        res.status(404).json({
                            result: "failed",
                            error: "Item not found"
                        });
                    } else {
                        await nsvc.itemService.addAttachment(item, file, name, index, false, req, req.client, req.plan);
                        await Item.updateOne({ _id: id }, {
                            $set: {
                                encryptionKey: item.encryptionKey,
                                attachments: item.attachments,
                                updatedBy: req.userObjectId,
                                recalculateItemSize: true,
                                __user: req.userObjectId
                            }
                        });

                        res.json({
                            result: "success"
                        });
                    }
                }
                catch(err) {
                    logger.error(err);
                    res.json({
                        result: "failed",
                        error: "internal error"
                    });
                }
            });

            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Set items perceptive hash
// ############################################################################################################
router.route('/setPerceptiveHash/:id/:hash')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSystemUser: true }), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

          const id = nsvc.verify.toObjectId(req.params.id);
          const Item = mongoose.model('Item');
          const query = Item.findOne();

          query.where("deletedAt").exists(false);
          query.where("_id").equals(id);

          if (!req.isSystemUser)
              query.where("client").equals(req.user.client);

          const item = await query.select("perceptiveHash").exec();

          if (!item) {
              res.status(404).json({
                  result: "failed",
                  error: "Item not found"
              });
          }
          else {
              item.perceptiveHash = req.params.hash;
              item.updatedBy = req.userObjectId;
              item.__user = req.userObjectId;
              item.recalculateItemSize = true;
              await item.save({__user: req.userObjectId});

              res.json({
                  result: "success"
              });
          }
      });
    });

// ############################################################################################################
// Upload image to generate thumbnails and previews.
// ############################################################################################################
router.route('/generateThumbnailsAndPreviews/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], {fetchPlan: true, fetchClient: true}), function (req, res) {
            nsvc.common.handleError(req, res, async function() {
                const busboy = new Busboy({ headers: req.headers });
                busboy.on('file', async function(fieldname, file, filename, encoding, mimetype) {
                    try {
                        const id = nsvc.verify.toObjectId(req.params.id);
                        const Item = mongoose.model('Item');
                        const query = Item.findOne();

                        if (!req.isSystemUser)
                            query.where("client").equals(req.user.client);

                        query.where("deletedAt").exists(false);
                        query.where("_id").equals(id);

                        const item = await query.select("-attributes -properties -userAttributes -thumbnails").exec();

                        if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "write")) {
                            res.status(404).json({
                                result: "failed",
                                error: "Item not found"
                            });

                            return;
                        }

                        const {thumbnails, previews} = await nsvc.itemService.createThumbnailsAndPreviews(file);
                        await nsvc.itemService.addIndexedAttachments(item, previews, "preview", req);

                        await Item.updateOne({ _id: id }, {
                            $set: {
                                thumbnails,
                                attachments: item.attachments,
                                encryptionKey: item.encryptionKey,
                                updatedBy: req.userObjectId,
                                recalculateItemSize: true,
                                recreateThumbnailsAndPreviews: false,
                                __user: req.userObjectId
                            }
                        });


                        res.json({
                            result: "success"
                        });

                    }
                    catch(err) {
                        logger.error(err);
                        res.json({
                            result: "failed",
                            error: "internal error"
                        });
                    }
                });
            return req.pipe(busboy);
        });
    });

// ############################################################################################################
// Clear perceptive hash of item
// ############################################################################################################
router.route('/clearPerceptiveHash/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSystemUser: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            const item = await query.select("perceptiveHash").exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                item.perceptiveHash = "";
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;
                await item.save({__user: req.userObjectId});

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Reset perceptive hash of item
// ############################################################################################################
router.route('/resetPerceptiveHash/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSystemUser: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            const item = await query.select("perceptiveHash").exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                item.perceptiveHash = undefined;
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;
                await item.save({__user: req.userObjectId});

                res.json({
                    result: "success"
                });
            }
        });
    });

// ############################################################################################################
// Move item
// ############################################################################################################
router.route('/move')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), async function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idList = nsvc.verify.objectIdArray(req, "items");
            const destFolder = nsvc.verify.optionalObjectId(req, "dest");

            const Item = mongoose.model('Item');
            const items = await Item.find( {
                _id: idList,
                client: req.user.client,
                deletedAt: { $exists: false }
            }).select("_id name acl client quotaUser quotaGroup totalSize filesize folder").exec();

            if (items.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Items not found"
                });
            } else {
                // Check for existance of dest folder with that client
                // -----------------------------------------------------
                if (destFolder) {
                    const Folder = mongoose.model('Folder');
                    const parentFolder = await Folder.findOne({
                        _id: destFolder,
                        client: req.user.client,
                        deletedAt: {$exists: false}
                    }).select("_id").exec();

                    if (!parentFolder) {
                        res.status(404).json({
                            result: "failed",
                            error: "Parent folder not found"
                        });
                        return;
                    }
                }

                // Check permissions
                // -----------------------------------------------------
                const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "write");

                // Check for name conflicts
                // -----------------------------------------------------
                for (const item of filteredItems) {
                    let { conflict } = await nsvc.folderService.isNameConflict(item.name, destFolder, req.user.client);
                    if (conflict) {
                        res.json({
                            result: "failed",
                            error: "Destination folder has an item with the same name: " + item.name
                        });
                        return;
                    }
                }

                // Get quota user or group
                // -----------------------------------------------------
                let quotaUser = null;
                let quotaGroup = null;
                if (destFolder) {
                    quotaUser = await nsvc.folderService.getFolderQuotaUser(destFolder, req.user.client);
                    if (!quotaUser)
                        quotaGroup = await nsvc.folderService.getFolderQuotaGroup(destFolder, req.user.client);
                }

                // Verify quota is not exceeded
                // -----------------------------------------------------
                if (quotaUser) {
                    let dataLength = 0;
                    for (const item of filteredItems) {
                        if (!quotaUser.equals(item.quotaUser))
                            dataLength += item.totalSize || item.filesize;
                    }
                    await nsvc.userService.verifyQuota(quotaUser, req.user.client, dataLength);
                }
                else if (quotaGroup) {
                    let dataLength = 0;
                    for (const item of filteredItems) {
                        if (!quotaGroup.equals(item.quotaGroup))
                            dataLength += item.totalSize || item.filesize;
                    }
                    await nsvc.groupService.verifyQuota(quotaGroup, req.user.client, dataLength);
                }

                // Collect all folders that are affected and need their sizes recalculated
                // -----------------------------------------------------
                const affectedFolders = new Map();
                for (const item of filteredItems) {
                    if (item.folder) {
                        affectedFolders.set(item.folder.toString(), item.folder);
                    }
                }

                if (destFolder) {
                    affectedFolders.set(destFolder.toString(), destFolder);
                }

                const affectedFolderIds = Array.from(affectedFolders.values());

                // We want all moved items and their affected folders to have the same updatedAt timestamp.
                // This makes caching easier, because otherwise the more recent updatedAt date of the previous
                // and updated parent folder would invalidate the cache for no reason.
                const updateTime = Date.now();

                // Now move everything
                // -----------------------------------------------------
                const filteredIdArray = filteredItems.map(x => x._id);
                let count;

                if (destFolder) {
                    count = await Item.updateMany({
                        _id: filteredIdArray
                    }, {
                        $set: {
                            folder: destFolder,
                            updatedBy: req.userObjectId,
                            quotaUser: quotaUser,
                            quotaGroup: quotaGroup,
                            updatedAt: updateTime
                        }
                    }, {
                        timestamps: false,
                        __user: req.userObjectId
                    });
                } else {
                    count = await Item.updateMany({
                        _id: filteredIdArray
                    }, {
                        $unset: {
                            folder: true
                        },
                        $set: {
                            updatedBy: req.userObjectId,
                            quotaUser: null,
                            quotaGroup: null,
                            updatedAt: updateTime
                        }
                    }, {
                        timestamps: false,
                        __user: req.userObjectId
                    });
                }

                // Go over all modified items and update their ACL cache entry.
                for (const item of filteredItems) {
                    // We need to set the folder to the destination folder,
                    // because it will be used in the ACL cache update.
                    item.folder = destFolder;
                    await nsvc.aclTools.updateAclCache(item, req.user.clientAcl, "item");
                }

                // Now trigger folder size recalculation
                // -----------------------------------------------------
                if (affectedFolderIds.length) {
                    const Folder = mongoose.model('Folder');
                    await Folder.updateMany({
                        _id: affectedFolderIds
                    }, {
                        $set: {
                            recalculateContentSize: true
                        }
                    }, {
                        timestamps: false
                    });
                }

                for (const affectedFolderId of affectedFolderIds) {
                    // update timestamp for all folder parents so they are in sync
                    await nsvc.folderService.markFolderAndAllParentsUpdated(affectedFolderId, req.user.client, updateTime);
                }

                res.json({
                    result: "success",
                    data: count.modifiedCount
                });
            }
        });
    });

// ############################################################################################################
// Get list of only the necessary fields of all items for syncing
// ############################################################################################################
router.route('/synclist/:date')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let date = null;

            if (req.params.date !== "0") {
                date = nsvc.verify.toDate(req.params.date);
            }

            let nextItem = null;
            if (req.query.nextItem !== undefined) {
                nextItem = nsvc.verify.toObjectId(req.query.nextItem);
            }

            const data = await nsvc.itemService.getSynclistPaginated(date, req.user.client, req.user, req.query.pageSize, nextItem)

            res.json({
                result: "success",
                data: data.items,
                next: data.nextObjectID
            });
        });
    });

// ############################################################################################################
// Get one specific item by id
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true, fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            const item = await query.select("-encryptionKey -storages -storageHash " +
                "-attachments.storages -attachments._id -attachments.storageHash").exec();

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                nsvc.itemService.setConversation(req.plan, req.client, item);
                item.flags = item.flags || [];

                const fields = [
                    "_id", "links", "attributes", "userAttributes", "name", "folder", "filename", "createdAt", "updatedAt", "version",
                    "filesize", "hash", "mimeType", "type", "packageType", "createdBy", "updatedBy", "acl", "visibility", "properties",
                    "allowConversation", "conversation", "tags", "contributors", "description", "shortDescription", "userAttributeTemplate", "categories",
                    "attachments", "license", "quotaUser", "quotaGroup", "itemSize", "totalSize", "flags"
                ];

                if (req.user.superadmin) {
                    fields.push("location");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields)
                });
            }
        });
    });

// ############################################################################################################
// Get one specific public item by id
// ############################################################################################################
router.route('/public/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const item = await nsvc.itemService.getPublic(id);

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                const client = await nsvc.clientService.getClient(item.client,
                    "publicLikes publicConversations publicCategories publicUserInfo publicLicenses");

                const fields = [
                    "_id", "links", "attributes", "userAttributes", "name", "folder", "filename", "createdAt", "updatedAt",
                    "version", "filesize", "hash", "mimeType", "type", "packageType", "properties", "description",
                    "shortDescription", "tags", "contributors", "userAttributeTemplate", "attachments", "itemSize", "totalSize"
                ];

                if (client.publicConversations) {
                    fields.push("conversation");
                }

                if (client.publicCategories) {
                    fields.push("categories");
                }

                if (client.publicUserInfo) {
                    fields.push("createdBy");
                    fields.push("quotaUser");
                    fields.push("quotaGroup");
                }

                if (client.publicLicenses) {
                    fields.push("license");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.requestedItemClient = item.client;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields)
                });
            }
        });
    });

// ############################################################################################################
// Get one specific public item recursively by id
// ############################################################################################################
router.route('/publicrecursive/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const item = await nsvc.itemService.getPublicRecursive(id);

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                const client = await nsvc.clientService.getClient(item.client,
                    "publicLikes publicConversations publicCategories publicUserInfo publicLicenses");

                const fields = [
                    "_id", "version", "links", "attributes", "userAttributes", "name", "folder", "filename", "createdAt", "updatedAt",
                    "filesize", "hash", "mimeType", "type", "packageType", "fields", "fieldSets", "properties", "tags", "contributors",
                    "description", "shortDescription", "userAttributeTemplate", "attachments", "itemSize", "totalSize"
                ];

                if (client.publicConversations) {
                    fields.push("conversation");
                    fields.push("allowConversation");
                }

                if (client.publicCategories) {
                    fields.push("categories");
                }

                if (client.publicUserInfo) {
                    fields.push("createdBy");
                    fields.push("quotaUser");
                    fields.push("quotaGroup");
                }

                if (client.publicLicenses) {
                    fields.push("license");
                }

                if (req.query.withFeatures !== undefined) {
                    const SEARCH_FEATURES = [
                        'remove_viewer_controls',
                        'remove_viewer_logo'
                    ];

                    let features;
                    if (item.quotaGroup) {
                        features = await nsvc.featureService.getGroupFeatureNamesByGroupId(item.quotaGroup);
                    } else if (item.quotaUser) {
                        features = await nsvc.featureService.getUserFeatureNamesByUserAndClientId(item.quotaUser, item.client, item.quotaGroup ? item.quotaGroup : null);
                    } else {
                        features = await nsvc.clientService.getEnabledFeatures(item.client, true);
                    }

                    item.features = features.filter(x => SEARCH_FEATURES.includes(x));
                    fields.push("features");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.requestedItemClient = item.client;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields, true)
                });
            }
        });
    });

// ############################################################################################################
// Get one specific item aggregated by id
// ############################################################################################################
router.route('/aggregate/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true, fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            const options = {
                withFieldInstances: req.query.withFieldInstances !== undefined,
                withAttachmentInfo: req.query.withAttachmentInfo !== undefined,
                withStats: req.query.withStats !== undefined,
                noAttributes: req.query.noAttributes !== undefined,
                noUserAttributes: req.query.noUserAttributes !== undefined,
                noFields: req.query.noFields !== undefined,
                noLinks: req.query.noLinks !== undefined,
                noThumbnails: req.query.noThumbnails !== undefined,
                fetchUserAttributeTemplate: !!req.plan.attributeTemplatesAllowed
            };

            const item = await nsvc.itemService.getAggregated(id, req.user.client, req.isSystemUser, options);

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                nsvc.itemService.setConversation(req.plan, req.client, item);

                const fields = [
                    "_id", "name", "visibility", "version", "folder", "filename", "filesize", "hash", "mimeType", "type", "packageType", "acl",
                    "createdAt", "createdBy", "updatedAt", "updatedBy", "tags", "contributors", "description", "shortDescription",
                    "createdByUser", "updatedByUser", "resultingAcl", "properties", "allowConversation", "conversation",
                    "categories", "license", "quotaUser", "quotaGroup", "itemSize", "totalSize"
                ];

                if (!options.noThumbnails) {
                    fields.push("thumbnails");
                }

                if (!options.noLinks) {
                    fields.push("links");
                }

                if (!options.noAttributes) {
                    fields.push("attributes");
                }

                if (!options.noUserAttributes) {
                    fields.push("userAttributes");

                    if (options.fetchUserAttributeTemplate) {
                        fields.push("userAttributeTemplate");
                    }
                }

                if (!options.noFields) {
                    fields.push("fields");
                    fields.push("fieldSets");
                    fields.push("userFields");
                }

                if (options.withFieldInstances) {
                    fields.push("fieldInstances");
                    fields.push("userFieldInstances");
                }

                if (options.withAttachmentInfo) {
                    fields.push("attachments");
                }

                if (options.withStats) {
                    fields.push("counts");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields)
                });
            }
        });
    });

// ############################################################################################################
// Get one specific item aggregated by id
// ############################################################################################################
router.route('/publicaggregate/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            const options = {
                withFieldInstances: req.query.withFieldInstances !== undefined,
                withAttachmentInfo: req.query.withAttachmentInfo !== undefined,
                withStats: req.query.withStats !== undefined,
                noAttributes: req.query.noAttributes !== undefined,
                noUserAttributes: req.query.noUserAttributes !== undefined,
                noFields: req.query.noFields !== undefined,
                noLinks: req.query.noLinks !== undefined
            };

            const item = await nsvc.itemService.getPublicAggregated(id, options);

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {

                const fields = [
                    "_id", "name", "folder", "filename", "filesize", "hash", "mimeType", "type", "packageType", "version",
                    "createdAt", "updatedAt", "tags", "contributors", "description", "shortDescription", "properties",
                    "categories", "itemSize", "totalSize"
                ];

                if (item.client.publicConversations) {
                    nsvc.itemService.setConversation(item.plan, item.client, item);
                    fields.push("conversation");
                }

                if (item.client.publicLicenses) {
                    fields.push("license");
                }

                if (item.client.publicUserInfo) {
                    fields.push("createdByUser");
                    fields.push("updatedByUser");
                }

                if (!options.noLinks) {
                    fields.push("links");
                }

                if (!options.noAttributes) {
                    fields.push("attributes");
                }

                if (!options.noUserAttributes) {
                    fields.push("userAttributes");
                    fields.push("userAttributeTemplate");
                }

                if (!options.noFields) {
                    fields.push("fields");
                    fields.push("fieldSets");
                    fields.push("userFields");
                }

                if (options.withFieldInstances) {
                    fields.push("fieldInstances");
                    fields.push("userFieldInstances");
                }

                if (options.withAttachmentInfo) {
                    fields.push("attachments");
                }

                if (options.withStats) {
                    fields.push("counts");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields)
                });
            }
        });
    });

// ############################################################################################################
// Get one specific item aggregated and including all linked items recursively by id
// ############################################################################################################
router.route('/aggregaterecursive/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { fetchClient: true, fetchPlan: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            const options = {
                withFieldInstances: req.query.withFieldInstances !== undefined,
                withAttachmentInfo: req.query.withAttachmentInfo !== undefined,
                withStats: req.query.withStats !== undefined,
                noAttributes: req.query.noAttributes !== undefined,
                noUserAttributes: req.query.noUserAttributes !== undefined,
                noFields: req.query.noFields !== undefined,
                noLinks: false,
                noThumbnails: req.query.noThumbnails !== undefined,
                fetchUserAttributeTemplate: !!req.plan.attributeTemplatesAllowed
            };

            const item = await nsvc.itemService.getAggregatedRecursive(id, req.user.client, req.isSystemUser, options);

            if (!item || !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read", true)) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                nsvc.itemService.setConversation(req.plan, req.client, item);

                const fields = [
                    "_id", "name", "visibility", "version", "folder", "filename", "filesize", "hash", "mimeType", "type", "packageType", "acl",
                    "createdAt", "createdBy", "updatedAt", "updatedBy", "tags", "contributors", "description", "shortDescription", "flags",
                    "createdByUser", "updatedByUser", "resultingAcl", "properties", "allowConversation", "conversation",
                    "categories", "license", "quotaUser", "quotaGroup", "itemSize", "totalSize"
                ];

                if (!options.noThumbnails) {
                    fields.push("thumbnails");
                }

                if (!options.noLinks) {
                    fields.push("links");
                }

                if (!options.noAttributes) {
                    fields.push("attributes");
                }

                if (!options.noUserAttributes) {
                    fields.push("userAttributes");

                    if (options.fetchUserAttributeTemplate) {
                        fields.push("userAttributeTemplate");
                    }
                }

                if (!options.noFields) {
                    fields.push("fields");
                    fields.push("fieldSets");
                    fields.push("userFields");
                }

                if (options.withFieldInstances) {
                    fields.push("fieldInstances");
                    fields.push("userFieldInstances");
                }

                if (options.withAttachmentInfo) {
                    fields.push("attachments");
                }

                if (options.withStats) {
                    fields.push("counts");
                }

                // Set values on request object to track traffic in middleware
                req.requestedItem = item._id;
                req.quotaUser = item.quotaUser;
                req.quotaGroup = item.quotaGroup;

                item.flags = item.flags || [];

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(item, fields, true)
                });
            }
        });
    });

// ############################################################################################################
// Get items that link this item
// ############################################################################################################
router.route('/linking/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const items = await nsvc.itemService.getDependencies(id, req.user.client, "acl folder");
            const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "read");

            res.json({
                result: "success",
                data: filteredItems.map(x => { return {
                    _id: x._id,
                    name: x.name,
                    folder: x.folder
                }})
            });
        });
    });

// ############################################################################################################
// Get item history from audit log
// ############################################################################################################
router.route('/history/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("_id").equals(id);
            query.where("deletedAt").exists(false);

            const item = await query.select("acl folder client").exec();

            if (item && await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                const Audit = mongoose.model('Audit');
                const history = await Audit.aggregate().match({
                        itemId: id,
                        itemName: "Item"
                    }).lookup({
                        from: 'users', localField: 'user', foreignField: '_id', as: 'user'
                    })
                    .unwind('user')
                    .project("_id user.name createdAt changes")
                    .sort({ createdAt: -1 })
                    .exec();

                res.json({
                    result: "success",
                    data: history
                });
            } else {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
        });
    });

// ############################################################################################################
// Copy data from one item to another
// ############################################################################################################
router.route('/copyData')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const sourceItemId = nsvc.verify.objectId(req, "sourceItemId");
            const destItemId = nsvc.verify.objectId(req, "destItemId");

            await nsvc.itemService.copyItemData(sourceItemId, destItemId, req, res);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Make items public
// ############################################################################################################
router.route('/makepublic')
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");
            const recursive = nsvc.verify.optionalBoolean(req, "recursive", false);
            const inSubfolders = nsvc.verify.optionalBoolean(req, "inSubfolders", false);

            if (inSubfolders && !recursive)
                throw new ValidationError("If inSubfolders is set to true, recursive must also be true.");

            if (inSubfolders && idArray.length !== 1)
                throw new ValidationError("If inSubfolders is set to true, only a single ID may be submitted.");

            const count = await nsvc.itemService.updateItems(idArray, req.user, req.user.client, req.userObjectId, {
                visibility: 3 }, "publish", recursive, inSubfolders);

            if (count) {
                res.json({
                    result: "success"
                });
            } else {
                res.status(403).json({
                    result: "failed",
                    error: "Permission denied"
                });
            }
        });
    });

// ############################################################################################################
// Make items private
// ############################################################################################################
router.route('/makeprivate')
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");
            const recursive = nsvc.verify.optionalBoolean(req, "recursive", false);
            const inSubfolders = nsvc.verify.optionalBoolean(req, "inSubfolders", false);

            // Check if the user is allowed to make all of the items private.
            // First find the quotaGroups for the items and then check if the user has the "private_items" feature in all of them.
            const Item = mongoose.model("Item");
            const Group = mongoose.model("Group");

            const groups = (await Item.find({
                _id: { $in: idArray },
            }).select("quotaGroup").exec())
                .filter(item => item.quotaGroup)
                .map(item => item.quotaGroup.toString());
            const uniqueGroups = [...new Set(groups)];

            for (const groupId of uniqueGroups) {
                const privateAllowed = await nsvc.clientService.isFeatureAllowed(req.user.client, "private_items", req.user, groupId);
                if (!privateAllowed) {
                    const group = await Group.findOne({
                        _id: groupId
                    }).exec();
                    res.json({
                        result: "failed",
                        error: "You are not allowed to have private items in group " + group.name
                    });
                    return;
                }
            }

            if (inSubfolders && !recursive)
                throw new ValidationError("If inSubfolders is set to true, recursive must also be true.");

            if (inSubfolders && idArray.length !== 1)
                throw new ValidationError("If inSubfolders is set to true, only a single ID may be submitted.");

            const count = await nsvc.itemService.updateItems(idArray, req.user, req.user.client, req.userObjectId, {
                visibility: 1
            }, "publish", recursive, inSubfolders);

            if (count) {
                res.json({
                    result: "success"
                });
            } else {
                res.status(403).json({
                    result: "failed",
                    error: "Permission denied"
                });
            }
        });
    });

// ############################################################################################################
// Increase views on public item
// ############################################################################################################
router.route('/increaseViews/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            await nsvc.itemService.setCount(id, "views", null,true, 1, true)

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Like
// ############################################################################################################
router.route('/like/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            await nsvc.itemService.like(id, req.user.client, req.userObjectId);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Unlike
// ############################################################################################################
router.route('/unlike/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            await nsvc.itemService.unlike(id, req.user.client, req.userObjectId);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Do I like
// ############################################################################################################
router.route('/doILike/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const result = await nsvc.itemService.doILike(id, req.user.client, req.userObjectId);

            res.json({
                result: "success",
                data: result
            });
        });
    });

// ############################################################################################################
// Get count of views on item
// ############################################################################################################
router.route('/views/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const count = await nsvc.itemService.getCount(id, "views", true)

            res.json({
                result: "success",
                data: count || 0
            });
        });
    });

// ############################################################################################################
// Get count of likes on item
// ############################################################################################################
router.route('/likes/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const count = await nsvc.itemService.getCount(id, "likes", true)

            res.json({
                result: "success",
                data: count || 0
            });
        });
    });

// ############################################################################################################
// Get message count on item
// ############################################################################################################
router.route('/messages/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const count = await nsvc.itemService.getCount(id, "messages", true)

            res.json({
                result: "success",
                data: count || 0
            });
        });
    });

// ############################################################################################################
// Get counts on item
// ############################################################################################################
router.route('/publiccounts/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const counts = await nsvc.itemService.getCounts(id, true)

            res.json({
                result: "success",
                data: {
                    likes: counts.get("likes") || 0,
                    views: counts.get("views") || 0,
                    messages: counts.get("messages") || 0,
                }
            });
        });
    });

// ############################################################################################################
// Get counts on item
// ############################################################################################################
router.route('/counts/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const counts = await nsvc.itemService.getCounts(id, false, req.user.client, req.user)

            res.json({
                result: "success",
                data: {
                    likes: counts.get("likes") || 0,
                    views: counts.get("views") || 0,
                    messages: counts.get("messages") || 0,
                }
            });
        });
    });

// ############################################################################################################
// Check whether the user liked the item
// ############################################################################################################
router.route('/didlike/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const result = await nsvc.itemService.didILike(id, req.userObjectId);

            res.json({
                result: "success",
                data: result
            });
        });
    });

// ############################################################################################################
// Mark items so they will get no LOD levels created
// ############################################################################################################
router.route('/omitLodGeneration/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSystemUser: true } ), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');

            await Item.updateOne({
                _id: id,
                deletedAt: { $exists: false }
            }, {
                $set: {
                    omitLodGeneration: true
                }
            });

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Set items attributes
// ############################################################################################################
router.route('/setAttributes')
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

            // read all files and check if user has access to them (same client)
            const Item = mongoose.model('Item');
            const items = await Item.find({
                _id: idArray,
                client: req.user.client,
                deletedAt: { $exists: false }
            }).select("_id attributes acl folder version").exec();

            if (items.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }

            const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "write");
            const promises = [];

            for (const item of filteredItems) {
                for (const attr in req.body.attributes) {
                    if (req.body.attributes.hasOwnProperty(attr)) {
                        if (!item.attributes)
                            item.attributes = new Map();

                        item.attributes.set(attr, req.body.attributes[attr]);
                    }
                }
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;

                if (item.version && item.version.revision)
                    item.version.revision++;

                promises.push(item.save({ __user: req.userObjectId }));
            }

            await Promise.all(promises);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Set items user attributes
// ############################################################################################################
router.route('/setUserAttributes')
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

            // read all files and check if user has access to them (same client)
            const Item = mongoose.model('Item');
            const items = await Item.find({
                _id: idArray,
                client: req.user.client,
                deletedAt: { $exists: false }
            }).select("_id userAttributes acl folder version").exec();

            if (items.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }

            const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "write");
            const promises = [];

            for (const item of filteredItems) {
                for (const attr in req.body.userAttributes) {
                    if (req.body.userAttributes.hasOwnProperty(attr)) {
                        if (!item.userAttributes)
                            item.userAttributes = new Map();

                        item.userAttributes.set(attr, req.body.userAttributes[attr]);
                    }
                }
                item.updatedBy = req.userObjectId;
                item.__user = req.userObjectId;
                item.recalculateItemSize = true;

                if (item.version && item.version.revision)
                    item.version.revision++;

                promises.push(item.save({ __user: req.userObjectId }));
            }

            await Promise.all(promises);

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get items client
// ############################################################################################################
router.route('/getClient/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("_id").equals(id);
            query.where("deletedAt").exists(false);

            const item = await query.select("client folder acl").exec();

            if (!item ||
                !req.user.hasMembership(item.client) ||
                !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read")) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                res.json({
                    result: "success",
                    data: item.client
                });
            }
        });
    });

// ############################################################################################################
// Get relative item ID
// ############################################################################################################
router.route('/resolve/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const path = nsvc.verify.string(req, "path");

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            if (!req.isSystemUser)
                query.where("client").equals(req.user.client);

            query.where("deletedAt").exists(false);
            query.where("_id").equals(id);

            const item = await query.select("folder client acl visibility").exec();

            if (!item || (item.visibility < 2 && !await nsvc.aclTools.verifyAndGetAclFor(item, req.user, "read"))) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                const itemId = await nsvc.itemService.resolveRelativeItem(path, req.user.client, req.user, item.folder);
                if (!itemId) {
                    res.status(404).json({
                        result: "failed",
                        error: "Path not found"
                    });
                } else {
                    res.json({
                        result: "success",
                        data: itemId
                    });
                }
            }
        });
    });

// ############################################################################################################
// Get relative item ID with public access
// ############################################################################################################
router.route('/publicResolve/:id')
    .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.toObjectId(req.params.id);
            const path = nsvc.verify.string(req, "path");

            const Item = mongoose.model('Item');
            const query = Item.findOne();

            query.where("deletedAt").exists(false);
            query.where("visibility").gte(2); // public or not listed
            query.where("_id").equals(id);

            const item = await query.select("folder client").exec();

            if (!item) {
                res.status(404).json({
                    result: "failed",
                    error: "Item not found"
                });
            }
            else {
                const itemId = await nsvc.itemService.resolveRelativeItem(path, item.client, null, item.folder, true);
                if (!itemId) {
                    res.status(404).json({
                        result: "failed",
                        error: "Path not found"
                    });
                } else {
                    res.json({
                        result: "success",
                        data: itemId
                    });
                }
            }
        });
    });

// ############################################################################################################
// Rewire a set of items and also allow setting attributes in the process
// ############################################################################################################
router.route('/rewire')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const itemData = nsvc.verify.array(req, "items");
            const itemIds = itemData.map(x => nsvc.verify.toObjectId(x._id, "_id"));

            const Item = mongoose.model('Item');
            const query = Item.find();

            query.where("deletedAt").exists(false);
            query.where("_id").equals(itemIds);

            const items = await query.select("_id acl folder type client").exec();
            const filteredItems = await nsvc.aclTools.filterElements(items, req.user, "write", false);

            if (items.length !== itemIds.length) {
                res.status(404).json({
                    result: "failed",
                    error: "At least one of the items does not exist or you do not have write permission on it!"
                });
            } else {

                const itemDataMap = new Map();
                for (const item of itemData) {
                    itemDataMap.set(item._id, item);
                }

                for (const item of filteredItems) {
                    const data = itemDataMap.get(item._id.toString());
                    const update = {};
                    let attributesChanged = false;
                    let linksChanged = false;

                    // set attributes if any
                    // -----------------------------------------------------------------
                    if (data.attributes) {
                        update.attributes = new Map();
                        attributesChanged = true;
                        for (const key in data.attributes) {
                            if (data.attributes.hasOwnProperty(key)) {
                                update.attributes.set(key, data.attributes[key]);
                            }
                        }
                    }

                    // set links if any
                    // -----------------------------------------------------------------
                    if (data.links) {
                        update.links = [];
                        linksChanged = true;
                        for (const link of data.links) {
                            update.links.push({
                                to: nsvc.verify.toObjectId(link.to._id ? link.to._id : link.to),
                                usage: link.usage
                            });
                        }
                    }

                    // save
                    // -----------------------------------------------------------------
                    if (await nsvc.itemService.handleDependencyChange(item, req.userObjectId, attributesChanged, linksChanged, false))
                        update.recreateThumbnailsAndPreviews = true;

                    update.recalculateItemSize = true;
                    await Item.findOneAndUpdate({ _id: item._id }, { $set: update });

                }

                res.json({
                    result: "success"
                });
            }
        });
    });
