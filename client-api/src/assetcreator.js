"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import {RuntimeException} from "./exception";
import JSZip from "jszip";

export default class NkAssetCreator {

    constructor(nkclient) {
        this.nkclient = nkclient;
        this.itemRepo = nkclient.getItemRepo();
        this.jobManager = nkclient.getJobManager();
        this.items = [];
        this.mainItem = null;
        this.totalSize = 0;
        this.oldMainItemId = null;
        this.originalItemIds = [];
        this.affectedFolderIds = new Set();
        this.packageId = null;
    }

    async scan(itemId) {
        const _this = this;
        const items = new Map();
        const paths = new Map();

        this.mainItem = await this.itemRepo.loadItem(itemId, true, false);
        this.oldMainItemId = this.mainItem._id;
        const itemPath = await resolvePath(this.mainItem.folder);

        async function resolvePath(folder) {
            try {
                if (!folder)
                    return "/";
                else {
                    const folderId = folder._id ? folder._id : folder;
                    if (paths.has(folderId))
                        return paths.get(folderId);
                    else {
                        const result = await _this.nkclient.getFolderPath(folderId);
                        const path = result.path;
                        paths.set(folderId, path);
                        return path;
                    }
                }
            }
            catch(err) {
                console.error(err);
                return "";
            }
        }

        async function processItem(item) {
            const entry = {
                _id: item._id,
                name: item.name,
                type: item.type,
                size: item.totalSize,
                path: await resolvePath(item.folder),
                item: item,
                external: false
            };

            if (entry.path.startsWith(itemPath)) {
                entry.path = entry.path.slice(itemPath.length);
            } else {
                entry.external = true;
            }

            _this.affectedFolderIds.add(item.folder);
            items.set(item._id, entry);
        }

        await this.itemRepo.traverseItems(processItem, this.mainItem);
        this.items = Array.from(items.values());
        this.originalItemIds = this.items.map(x => x._id);

        this.hasExternalResources = false;
        this.totalSize = 0;
        for (const item of this.items) {
            if (item.external) {
                this.hasExternalResources = true;
            }
            this.totalSize += item.size;
        }

        /*console.log("Total size in MiB: ", this.totalSize / 1024 / 1024);
        console.log("Total number of items: ", this.items.length);
        console.log("Items to package: ", this.items);*/

        return this.items;
    }

    getItems() {
        return this.items;
    }

    async saveMainItemChanges() {
        const item = this.mainItem;

        await this.nkclient.updateItem({
            _id: item._id,
            name: item.name,
            shortDescription: item.shortDescription,
            description: item.description,
            tags: item.tags,
            categories: item.categories,
            visibility: item.visibility,
            contributors: item.contributors,
            version: item.version
        });
    }

    async createAssetFolder(rootFolderId, path) {
        let destinationFolderId = rootFolderId;
        const folderNames = path.split('/');

        for (const folderName of folderNames) {
            destinationFolderId = await this.nkclient.createFolder({
                name: folderName,
                parent: destinationFolderId,
                returnIfExists: true
            });
        }

        const contents = await this.nkclient.getItemsInFolderList(destinationFolderId, true);
        if (contents && contents.length) {
            throw new Error("Asset folder already exists and is not empty!");
        }

        return destinationFolderId;
    }

    async createAsset(assetFolderId, moveItems, updateCallback) {
        const itemIdsToCopy = [];

        for (const item of this.items) {
            itemIdsToCopy.push({ _id: item._id, isFolder: false });
        }

        this.affectedFolderIds.add(assetFolderId);

        if (itemIdsToCopy.length) {
            if (moveItems) {
                const count = await this.nkclient.moveItems({items: itemIdsToCopy, dest: assetFolderId});
                if (count !== itemIdsToCopy.length) {
                    console.warn("Not all items could be moved. Most likely due to permissions.");
                }

                this.mainItem.folder = assetFolderId;
            } else {
                const result = await this.jobManager.execute("JS:CloneItem", [{ _id: this.mainItem._id, isFolder: false }], [
                    {name: "Deep Clone", value: true},
                    {name: "Destination Folder", value: assetFolderId},
                    {name: "Exclude Types", value: ""}
                ], updateCallback);

                if (result.state === 3) {
                    // if the clone was successful, we get a log of CLONED:oldId;newId lines.
                    // We split this up and take the first and only newId
                    const lines = result.log.split('\n').reverse();
                    const parts = lines[0].split(';');
                    this.mainItem._id = parts[2];
                    this.mainItem.folder = assetFolderId;
                } else if (result.state === 2) {
                    throw new RuntimeException("Copying of items failed: " + result.error);
                }
            }
        }

        return this.mainItem._id;
    }

    async createPackage(subfolderPath, makePublic, copyExternal) {
        let destinationFolderId = this.mainItem.folder;
        this.affectedFolderIds.add(destinationFolderId);

        let firstSubFolderId;
        if (subfolderPath) {
            const folderNames = subfolderPath.split('/');

            for (const folderName of folderNames) {
                destinationFolderId = await this.nkclient.createFolder({
                    name: folderName,
                    parent: destinationFolderId,
                    returnIfExists: true
                });

                this.affectedFolderIds.add(destinationFolderId);

                if (!firstSubFolderId)
                    firstSubFolderId = destinationFolderId;
            }
        }

        const folders = await this.nkclient.getFoldersInFolderList(this.mainItem.folder);
        const foldersToInclude = folders.children.map(x => x._id).filter(x => x !== firstSubFolderId).join(",");

        const result = await this.jobManager.execute("JS:CreatePackage", [{ _id: this.mainItem._id, isFolder: false }], [
            { name: "Folders To Include", value: foldersToInclude },
            { name: "Destination Folder", value: destinationFolderId },
            { name: "Item Name", value: this.mainItem.name },
            { name: "Make Public", value: !!makePublic },
            { name: "Copy External", value: !!copyExternal }
        ]);

        if (result.state === 2) {
            throw new RuntimeException("Packaging failed: " + result.error);
        }

        const lines = result.log.split('\n').reverse();
        const parts = lines[0].split(';');
        this.packageId = parts[2];
    }

    async replaceReferences() {
        await this.itemRepo.replaceLink(this.oldMainItemId, this.packageId);
    }

    async deleteOriginalItems() {
        await this.nkclient.deleteItem(this.originalItemIds);
    }

    sendFolderRefreshEvent() {
        this.nkclient.eventBus.$emit('nk:folder:changed', Array.from(this.affectedFolderIds.values()));
    }

    async processUploads(files) {
        const results = [];
        for (const file of files) {
            if (file.type === 'application/zip') {
                const zip = new JSZip();
                try {
                    const content = await zip.loadAsync(file);
                    console.log('Files in the ZIP archive:');
                    content.forEach((relativePath, zipEntry) => {
                        console.log(relativePath, zipEntry);
                        results.push({
                            path: relativePath,
                            file: zipEntry
                        })
                    });
                } catch (error) {
                    console.error('Error reading the ZIP file:', error);
                }
            } else {
                results.push({
                    path: "/",
                    file: file
                });
            }
        }
        return results;
    }

    async createAssetFromFiles(processedFiles, name, type) {

    }

}
