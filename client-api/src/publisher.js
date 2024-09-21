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

export default class NkPublisher {

    constructor(nkclient) {
        this.nkclient = nkclient;
        this.itemRepo = nkclient.getItemRepo();
        this.jobManager = nkclient.getJobManager();
        this.items = [];
        this.hasExternalResources = false;
        this.totalSize = 0;
        this.affectedFolderIds = new Set();
    }

    async getPreviousVersions(projectFolderId, subfolderName) {
        const result = [];

        const subfolderId = await this.nkclient.createFolder({
            name: subfolderName,
            parent: projectFolderId,
            returnIfExists: true
        });

        const folders = await this.nkclient.getFoldersInFolderList(subfolderId, {
            folderAsItemType: "Package"
        });

        for (const folder of folders.children) {
            if (folder.item) {
                result.push({
                    itemId: folder.item._id,
                    folderId: folder._id,
                    version: folder.name,
                    name: folder.item.name,
                    filesize: folder.item.filesize,
                    visibility: folder.item.visibility
                });
            }
        }

        console.log(result);

        return result;
    }

    async verify() {

        const _this = this;
        const items = new Map();
        const paths = new Map();

        const item = this.itemRepo.activeItem;
        const projectPath = await resolvePath(item.folder);

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

            if (entry.path.startsWith(projectPath)) {
                entry.path = entry.path.slice(projectPath.length);
            } else {
                entry.external = true;
            }

            items.set(item._id, entry);
        }

        await this.itemRepo.traverseItems(processItem);
        this.items = Array.from(items.values());

        this.hasExternalResources = false;
        this.totalSize = 0;
        for (const item of this.items) {
            if (item.external) {
                this.hasExternalResources = true;
            }
            this.totalSize += item.size;
        }

        /*console.log("Has external resources: ", this.hasExternalResources);
        console.log("Total size in MiB: ", this.totalSize / 1024 / 1024);
        console.log("Total number of items: ", this.items.length);
        console.log("Items to package: ", this.items);*/

        return !this.hasExternalResources;
    }

    getItems() {
        return this.items;
    }

    async copyToProject(projectFolderId, subdirectoryName, updateCallback) {
        const itemIdsToCopy = [];

        for (const item of this.items) {
            if (item.external) {
                itemIdsToCopy.push({ _id: item._id, isFolder: false });
            }
        }

        if (subdirectoryName) {
            projectFolderId = await this.nkclient.createFolder({
                name: subdirectoryName,
                parent: projectFolderId,
                returnIfExists: true
            });
        }

        this.affectedFolderIds.add(projectFolderId);

        if (itemIdsToCopy.length) {
            const result = await this.jobManager.execute("JS:CloneItem", itemIdsToCopy, [
                { name: "Deep Clone", value: false },
                { name: "Destination Folder", value: projectFolderId },
                { name: "Exclude Types", value: "" }
            ], updateCallback);

            if (result.state === 3) {
                // if the clone was successful, we get a log of CLONED:oldId;newId lines.
                // We split this up and go through the lines and replace links one by one
                const lines = result.log.split('\n').reverse();
                for (const line of lines) {
                    const parts = line.split(';');
                    const oldId = parts[1];
                    const newId = parts[2];
                    await this.itemRepo.replaceLink(oldId, newId);
                }
            } else if (result.state === 2) {
                throw new RuntimeException("Copying of items failed: " + result.error);
            }
        }
    }

    async unpublish(packageId) {
        await this.nkclient.makeItemPrivate(packageId, false, false);
    }

    async publish(item, name, projectFolderId, subfolderPath, makePublic, copyExternal) {

        this.affectedFolderIds.add(projectFolderId);

        let destinationFolderId = projectFolderId;
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

        const folders = await this.nkclient.getFoldersInFolderList(projectFolderId);
        const foldersToInclude = folders.children.map(x => x._id).filter(x => x !== firstSubFolderId).join(",");

        const result = await this.jobManager.execute("JS:CreatePackage", [{ _id: item._id, isFolder: false }], [
            { name: "Folders To Include", value: foldersToInclude },
            { name: "Destination Folder", value: destinationFolderId },
            { name: "Item Name", value: name },
            { name: "Make Public", value: !!makePublic },
            { name: "Copy External", value: !!copyExternal }
        ]);

        if (result.state === 2) {
            throw new RuntimeException("Packaging failed: " + result.error);
        }

        this.nkclient.eventBus.$emit('nk:folder:changed', Array.from(this.affectedFolderIds.values()));
    }

}
