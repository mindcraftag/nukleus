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
const limits        = require("@mindcraftgmbh/nukleus-service/src/limits");
const {ValidationError} = require("@mindcraftgmbh/nukleus-service/src/exception");
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
    path: "/api/folder",
    router: router,
    permissions: []
};

// ############################################################################################################
// Get list of folders
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            let query = {
                client: req.user.client,
                deletedAt: { $exists: false }
            };

            if (!req.user.superadmin) {
                query["$or"] = [
                    { hidden: { $exists: false } },
                    { hidden: null },
                    { hidden: false }
                ]
            }

            const Folder = mongoose.model('Folder');
            const folders = await Folder.find(query).select("-graph").exec();

            const clonedFolders = JSON.parse(JSON.stringify(folders));
            const filteredFolders = await nsvc.aclTools.filterElements(clonedFolders, req.user, "read", true);

            const fields = [
                "_id", "name", "parent", "createdAt", "createdBy", "updatedAt", "updatedBy",
                "acl", "allowWrite", "allowPublish", "contentSize"
            ];

            const mappedFolders = filteredFolders.map(function(obj) {
                const folder = nsvc.common.ensureExactFieldsInObject(obj, fields);
                // If the folder has the "hideSize" flag set and the user is not an admin, then we need to remove the contentSize field.
                if (obj.hideSize && !req.user.isAdmin()) {
                    folder.contentSize = undefined;
                }
                return folder;
            });

            res.json({
                result: "success",
                data: mappedFolders
            });
        });
    })

// ############################################################################################################
// Create folder
// ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const name = nsvc.verify.itemOrFolderName(req, "name");
            const parent = nsvc.verify.optionalObjectId(req, "parent");
            const returnIfExists = nsvc.verify.optionalBoolean(req, "returnIfExists", false);

            // Check if limits are not exceeded
            // -----------------------------------------------------
            const Folder = mongoose.model('Folder');
            const count = await Folder.find({ client: req.user.client }).count();
            if (count >= limits.MAX_FOLDERS_PER_CLIENT) {
                throw new ValidationError(`Maximum amount of folders exceeded. Allowed are ${limits.MAX_FOLDERS_PER_CLIENT}`);
            }

            // Check for write permission on the folder
            // -----------------------------------------------------
            if (!await nsvc.aclTools.verifyAndGetAclForFolderId(parent, req.user, "write")) {
                res.json({
                    result: "failed",
                    error: "Permission denied to write to folder"
                });
                return;
            }

            // If requested, check if it already exists, and just return its ID, otherwise continue
            // -----------------------------------------------------
            if (returnIfExists) {
                const folderId = await nsvc.folderService.getFolderId(name, parent, req.user.client);
                if (folderId) {
                    res.status(201).json({
                        result: "success",
                        data: folderId
                    });
                    return;
                }
            }

            // Check for existence of other folders or items with that name
            // -----------------------------------------------------
            const { conflict } = await nsvc.folderService.isNameConflict(name, parent, req.user.client, false);
            if (conflict) {
                res.json({
                    result: "failed",
                    error: "Folder or item with that name already exists"
                });
                return;
            }

            // Create the folder in the location of the user that made the request.
            // If a parent was specified, create the folder in the location of the parent folder.
            let location = req.user.location;

            // Verify that parent exists
            // -----------------------------------------------------
            if (parent) {
                const parentFolder = await Folder.findOne({
                    _id: parent,
                    client: req.user.client,
                    deletedAt: { $exists: false }
                }).select("_id location").exec();

                if (!parentFolder) {
                    res.json({
                        result: "failed",
                        error: "Parent folder not found"
                    });
                    return;
                }

                if (parentFolder.location) {
                    location = parentFolder.location;
                } else {
                    res.json({
                        result: "failed",
                        error: "Parent folder has no location"
                    });
                    return;
                }
            }

            // Create new folder
            // -----------------------------------------------------
            const folder = new Folder({
                name: name,
                parent: parent,
                location: location,
                client: req.user.client._id,
                createdBy: req.userObjectId,
                updatedBy: req.userObjectId,
                __user: req.userObjectId
            });

            await folder.save({ __user: req.userObjectId });

            if (parent) {
                // update timestamp for all parents and this folder so they are in sync
                await nsvc.folderService.markFolderAndAllParentsUpdated(folder._id, req.user.client);
            }

            await nsvc.aclTools.updateAclCache(folder, req.user.clientAcl, "folder");

            res.status(201).json({
                result: "success",
                data: folder._id
            });
        });
    })

// ############################################################################################################
// Modify folder
// ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.itemOrFolderName(req, "name");

            let query = {
                _id: id,
                client: req.user.client,
                deletedAt: { $exists: false }
            };

            if (!req.user.superadmin) {
                query["$or"] = [
                    { hidden: { $exists: false } },
                    { hidden: null },
                    { hidden: false }
                ]
            }

            const Folder = mongoose.model('Folder');
            const folder = await Folder.findOne(query).exec();

            if (!folder || !await nsvc.aclTools.verifyAndGetAclFor(folder, req.user, "write")) {
                res.json({
                    result: "failed",
                    error: "Folder not found"
                });
            }
            else {

                // Check for existence of other folder with that name
                // -----------------------------------------------------
                if (folder.name !== name) {

                    if (folder.immutable) {
                        res.status(403).json({
                            result: "failed",
                            error: "Folder is immutable and cannot be renamed"
                        });
                        return;
                    }

                    const { conflict } = await nsvc.folderService.isNameConflict(name, folder.parent, req.user.client);
                    if (conflict) {
                        res.json({
                            result: "failed",
                            error: "Folder or item with that name already exists"
                        });
                        return;
                    }
                }

                // Modify folder
                // -----------------------------------------------------
                folder.name = name;
                folder.updatedBy = req.userObjectId;
                folder.__user = req.userObjectId;

                // update ACLs
                // -----------------------------------------------------------------
                if (req.body.acl) {
                    await nsvc.aclTools.changeAcl(folder, req.body.acl, req.user);
                }

                await folder.save({ __user: req.userObjectId });

                if (folder.parent) {
                    // update timestamp for all parents and this folder so they are in sync
                    await nsvc.folderService.markFolderAndAllParentsUpdated(folder._id, folder.client);
                }

                await nsvc.aclTools.updateAclCache(folder, req.user.clientAcl, "folder");

                res.json({
                    result: "success"
                });
            }
        });
    })

// ############################################################################################################
// Delete folder
// ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

            for(const id of idArray) {
                await nsvc.folderService.recursiveDelete(id, req.user.client, req.user, true);
            }

            res.json({
                result: "success"
            });
        });
    });

async function getInfolderData(parentFolderId, folderAsItemType, folderAsItemName, nextItem, resolve, lastUpdatedAt, pageSize, req) {
    if (parentFolderId === "0")
        parentFolderId = null;
    else
        parentFolderId = nsvc.verify.toObjectId(parentFolderId);

    if (nextItem) {
        nextItem = nsvc.verify.toObjectId(nextItem);
    } else {
        nextItem = null;
    }

    const data = await nsvc.folderService.getSubfolders(parentFolderId, folderAsItemType, folderAsItemName, resolve, lastUpdatedAt, req.isSystemUser, req.user, req.user.client, req.superadmin, pageSize, nextItem);

    if (data.notModified) {
        return {
            data: {
                notModified: true
            }
        };
    } else {
        return {
            data: {
                parent: data.parent,
                children: data.children,
            },
            next: data.nextObjectID
        }
    }
}

// ############################################################################################################
// Get list of folders within folder
// ############ß################################################################################################
router.route('/infolder/:parentFolderId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const data = await getInfolderData(req.params.parentFolderId, req.query.folderAsItemType, req.query.folderAsItemName, req.query.nextItem, req.query.resolve, req.query.lastUpdatedAt, req.query.pageSize, req);

            res.json({
                result: "success",
                ...data
            });
        });
    });

// ############################################################################################################
// Get list of folders within a folder, for multiple folders at once.
// ############ß################################################################################################
router.route('/infolderquery')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const requestedFolders = nsvc.verify.array(req, "folders");

            const promises = requestedFolders.map((folder) => getInfolderData(folder.id, req.body.folderAsItemType, req.body.folderAsItemName, undefined, true, folder.lastUpdatedAt, null, req));

            const folderListings = await Promise.all(promises);

            res.json({
                result: "success",
                data: folderListings.map((listing, idx) => ({
                    id: requestedFolders[idx].id,
                    data: listing.data
                }))
            });

        });
    });

// ############################################################################################################
// Get path of folder
// ############################################################################################################
router.route('/path/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Folder = mongoose.model('Folder');
            let id = nsvc.verify.toObjectId(req.params.id);
            let folderPath = "";
            const elements = [];

            if (id) {
                if (!await nsvc.aclTools.verifyAndGetAclForFolderId(id, req.user, "read")) {
                    res.json({
                        result: "failed",
                        error: "folder not found"
                    });
                    return;
                }
            }

            while(id) {
                let query = {
                    _id: id,
                    client: req.user.client,
                    deletedAt: { $exists: false }
                };

                if (!req.user.superadmin) {
                    query["$or"] = [
                        { hidden: { $exists: false } },
                        { hidden: null },
                        { hidden: false }
                    ]
                }

                const folder = await Folder.findOne(query).select('name parent').exec();

                if (!folder) {
                    res.json({
                        result: "failed",
                        error: "folder not found"
                    });
                    return;
                }

                folderPath = "/" + folder.name + folderPath;
                id = folder.parent;
                elements.push({
                    id: folder.id,
                    name: folder.name
                })
            }

            res.json({
                result: "success",
                data: {
                    path: folderPath,
                    elements: elements.reverse()
                }
            });
        });
    });

// ############################################################################################################
// Get folder id of path
// ############################################################################################################
router.route('/resolve')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const path = nsvc.verify.path(req, "path");

            const folderId = await nsvc.folderService.resolveFolder(path, req.user.client, req.user, null);

            if (folderId === undefined) {
                res.json({
                    result: "failed",
                    error: "folder not found"
                });
            } else {
                res.json({
                    result: "success",
                    data: folderId
                });
            }
        });
    });

// ############################################################################################################
// Move folder
// ############################################################################################################
router.route('/move')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), async function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const idList = nsvc.verify.objectIdArray(req, "folders");
            const destFolder = nsvc.verify.optionalObjectId(req, "dest") || null;

            // Check access to the destination folder.
            if (!(await nsvc.aclTools.verifyAndGetAclForFolderId(destFolder, req.user, "write"))) {
                // The user does not have "write" access to the destination folder, so we don't allow the move.
                res.status(403).json({
                    result: "failed",
                    error: "Destination folder is inaccessible"
                });
                return;
            }

            const Folder = mongoose.model('Folder');
            const folders = await Folder.find( {
                _id: idList,
                client: req.user.client,
                deletedAt: { $exists: false }
            }).select("_id name client acl immutable parent").exec();

            if (folders.length === 0) {
                res.status(404).json({
                    result: "failed",
                    error: "Folders not found"
                });
            } else {

                // Verify that destination exists
                // -----------------------------------------------------
                if (destFolder) {
                    const destFolderObj = await Folder.findOne({
                        _id: destFolder,
                        client: req.user.client
                    }).select("_id").exec();

                    if (!destFolderObj) {
                        res.status(400).json({
                            result: "failed",
                            error: "Destination folder not found"
                        });
                    }
                }

                const filteredFolders = await nsvc.aclTools.filterElements(folders, req.user, "write");
                const filteredIdArray = filteredFolders.map(x => x._id);

                for (const folder of filteredFolders) {

                    if (folder.immutable) {
                        res.status(403).json({
                            result: "failed",
                            error: "At least one folder is immutable and cannot be moved"
                        });
                        return;
                    }

                    if (await nsvc.folderService.isFolderWithinFolder(folder, destFolder, req.user.client)) {
                        res.status(400).json({
                            result: "failed",
                            error: "Cannot copy folder into itself or a subfolder of itself"
                        });
                        return;
                    }

                    const { conflict } = await nsvc.folderService.isNameConflict(folder.name, destFolder, req.user.client, false);
                    if (conflict) {
                        res.status(400).json({
                            result: "failed",
                            error: "Destination folder has a folder with the same name: " + folder.name
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

                // Get a list of all contained item IDs
                // -----------------------------------------------------
                const containedItemIds = await nsvc.folderService.getFoldersItemsRecursive(filteredIdArray, req.user.client);

                // Verify quota is not exceeded
                // -----------------------------------------------------
                if (quotaUser || quotaGroup) {
                    const containedItems = await nsvc.itemService.getItems(containedItemIds, req.user.client, "totalSize filesize quotaUser quotaGroup");
                    if (quotaUser) {
                        let dataLength = 0;
                        for (const item of containedItems) {
                            if (!quotaUser.equals(item.quotaUser))
                                dataLength += item.totalSize || item.filesize;
                        }
                        await nsvc.userService.verifyQuota(quotaUser, req.user.client, dataLength);
                    } else if (quotaGroup) {
                        let dataLength = 0;
                        for (const item of containedItems) {
                            if (!quotaGroup.equals(item.quotaGroup))
                                dataLength += item.totalSize || item.filesize;
                        }
                        await nsvc.groupService.verifyQuota(quotaGroup, req.user.client, dataLength);
                    }
                }

                // Collect all folders that are affected and need their sizes recalculated
                // -----------------------------------------------------
                const affectedFolders = new Map();
                for (const folder of filteredFolders) {
                    if (folder.parent) {
                        affectedFolders.set(folder.parent.toString(), folder.parent);
                    }
                }

                if (destFolder) {
                    affectedFolders.set(destFolder.toString(), destFolder);
                }

                const affectedFolderIds = Array.from(affectedFolders.values());

                // We want all moved folders, their affected folders and contained items to have the same updatedAt timestamp.
                // This makes caching easier, because otherwise the more recent updatedAt date of the parent would invalidate
                // the cache for no reason.
                const updateTime = Date.now();

                // Move the folders
                // -----------------------------------------------------
                const count = await Folder.updateMany({
                    _id: filteredIdArray,
                    client: req.user.client
                }, {
                    $set: {
                        parent: destFolder,
                        updatedBy: req.userObjectId,
                        updatedAt: updateTime
                    }
                }, {
                    timestamps: false
                });

                // Go over all modified folders and update their ACL cache entry.
                for (const folder of filteredFolders) {
                    // We need to set the parent to the destination folder,
                    // because it will be used in the ACL cache update.
                    folder.parent = destFolder;
                    await nsvc.aclTools.updateAclCache(folder, req.user.clientAcl, "folder");
                }

                // Update the quota users of all contained items
                // -----------------------------------------------------
                if (containedItemIds.length) {
                    const Item = mongoose.model('Item');
                    await Item.updateMany({
                        _id: containedItemIds,
                        client: req.user.client
                    }, {
                        $set: {
                            quotaUser: quotaUser,
                            quotaGroup: quotaGroup,
                            updatedAt: updateTime
                        }
                    }, {
                        timestamps: false
                    });
                }

                // Now trigger folder size recalculation
                // -----------------------------------------------------
                if (affectedFolderIds.length) {
                    const Folder = mongoose.model('Folder');
                    await Folder.updateMany({
                        _id: affectedFolderIds
                    }, {
                        $set: {
                            recalculateContentSize: true,
                            updatedAt: updateTime
                        }
                    }, {
                        timestamps: false
                    });
                }

                // Set the "nextLocation" of all moved folders to the destination folders location (or the system location if no destination folder was given).
                // A job will then move the folders and their items to the new location. This is neccessary because the folder might have been moved
                // from a user folder to a group folder.
                const newLocation = destFolder ? destFolder.location : nsvc.config.systemLocation;
                for (const folderId of filteredIdArray) {
                    const folder = await Folder.findOne({
                        _id: folderId,
                    }).exec();

                    if (folder.location !== newLocation) {
                        folder.nextLocation = newLocation;
                        await folder.save();
                    }
                }

                for (const affectedFolderId of affectedFolderIds) {
                    await nsvc.folderService.markFolderAndAllParentsUpdated(affectedFolderId, req.user.client, updateTime);
                }

                // Moving the folders and their items to the new location may take a while, so we hand it over to the job system.
                const Job = mongoose.model('Job');
                const job = new Job({
                    type: "JS:SetFolderLocation",
                    state: 0,
                    message: '',
                    log: '',
                    progress: 0,
                    elements: [],
                    parameters: [],
                    createdBy: req.user._id,
                    client: req.user.client
                });

                await job.save();

                res.json({
                    result: "success",
                    data: count.modifiedCount
                });
            }
        });
    });

// ############################################################################################################
// Get list of folders with minimum fields for syncing
// ############################################################################################################
router.route('/synclist')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            let query = {
                client: req.user.client,
                deletedAt: { $exists: false }
            };

            if (!req.user.superadmin) {
                query["$or"] = [
                    { hidden: { $exists: false } },
                    { hidden: null },
                    { hidden: false }
                ]
            }

            const Folder = mongoose.model('Folder');
            const folders = await Folder.find(query).select('_id name parent client acl').exec();

            const filteredFolders = await nsvc.aclTools.filterElements(folders, req.user, "read");

            res.json({
                result: "success",
                data: filteredFolders.map(x => { return {
                    _id: x._id,
                    name: x.name,
                    parent: x.parent
                }})
            });
        });
    });

// ############################################################################################################
// Get one specific folder by id
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const Folder = mongoose.model('Folder');

            const aggregate = Folder.aggregate();

            aggregate.match({_id: nsvc.verify.toObjectId(req.params.id)});
            aggregate.match({"client": req.user.client});
            aggregate.match({"deletedAt": { $exists: false }});

            let folder = await aggregate.exec();
            if (folder.length)
                folder = folder[0];
            else
                folder = null;

            if (!folder || !await nsvc.aclTools.verifyAndGetAclFor(folder, req.user, "read")) {
                res.json({
                    result: "failed",
                    error: "folder not found"
                });
            }
            else {
                const fields = [
                    "_id", "name", "parent", "createdAt", "createdBy", "updatedAt", "updatedBy", "acl", "resultingAcl"
                ];

                // Superadmins additionally receive the location of the folder.
                if (req.user.superadmin) {
                    fields.push("location");
                }

                // We only return the contentSize field if the user is admin or if the folder does not have the "hideSize" flag set.
                if (!folder.hideSize || req.user.isAdmin()) {
                    fields.push("contentSize");
                }

                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInObject(folder, fields)
                });
            }
        });
    });

// ############################################################################################################
// Get folders client
// ############################################################################################################
router.route('/getClient/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const id = nsvc.verify.toObjectId(req.params.id);
            const Folder = mongoose.model('Folder');
            const folder = await Folder.findOne({
                _id: id,
                deletedAt: { $exists: false }
            }).select("client").exec();

            if (!folder || !req.user.hasMembership(folder.client)) {
                res.status(404).json({
                    result: "failed",
                    error: "Folder not found"
                });
            }
            else {
                res.json({
                    result: "success",
                    data: folder.client
                });
            }
        });
    });

async function getACLforFolderID(folderIdInput, req) {
    if (folderIdInput === "0") {
        // If the folder ID is "0", then we return the ACL for the root folder.
        // We can't load the folder from the database, because the root folder
        // is not a "real" folder, so instead we assemble the folder object
        // manually.
        const acl = await nsvc.aclTools.getAclFor({
            _id: "0",
            client: req.user.client,
            parent: null
        });
        return {
            result: "success",
            data: acl
        };
    }

    const Folder = mongoose.model('Folder');
    const folder = await Folder.findOne({
        _id: folderIdInput,
        client: req.user.client,
        deletedAt: { $exists: false }
    });

    if (!folder) {
        return {
            result: "failed",
            error: "Folder not found"
        };
    }

    if (folder.parent === undefined)
        folder.parent = null;

    const acl = await nsvc.aclTools.getAclFor(folder);
    return {
        result: "success",
        data: acl
    };
}

// ############################################################################################################
// Get folder's ACL
// ############################################################################################################
router.route('/acl/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const aclInfo = await getACLforFolderID(req.params.id, req);
            res.json(aclInfo);
        });
    });

// ############################################################################################################
// Get folder's ACL
// ############################################################################################################
router.route('/aclquery')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            const IDs = nsvc.verify.array(req, "ids");
            const promises = IDs.map((id) => getACLforFolderID(id, req));
            const aclData = await Promise.all(promises);

            if (aclData.some((folder) => folder.result === "failed")) {
                res.json({
                    result: "failed",
                    error: "Some requested folders could not be found"
                });
            } else {
                res.json({
                    result: "success",
                    data: aclData.map((folder, idx) => ({
                        id: IDs[idx],
                        acl: folder.data
                    }))
                });
            }
        });
    });

// ############################################################################################################
// Initialize the ACL cache. This is needed for the tests so we can add items and folders to the testdata
// without having to manually add a correct ACL cache entry.
// ############################################################################################################
router.route('/initializeAclCache')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], { needsSystemUser: true }), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            await nsvc.aclTools.initializeAclCache();

            res.json({
                result: "success",
            });
        });
    });
