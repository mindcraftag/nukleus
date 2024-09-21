import pako from "pako";
import tools from "./tools";

const MAGIC_BYTES = "LUMIPACK";

const packageCache = {
    files: {},
    items: {},
    folders: {}
}

export function getFileFromCache(itemID) {
    return packageCache.files[itemID];
}

export function getFolders() {
    return packageCache.folders;
}

export function getFolder(id) {
    return packageCache.folders[id];
}

export function findFolder(name, parentID) {
    for (const folder of Object.values(packageCache.folders)) {
        if (folder.name === name && folder.parent === parentID) {
            return folder;
        }
    }
}

export function findItem(name, parentID) {
    for (const item of Object.values(packageCache.items)) {
        if (item.name === name && item.folder._id === parentID) {
            return item;
        }
    }
}

export function getItems() {
    return packageCache.items;
}

export function getItemFromCache(itemID) {
    return packageCache.items[itemID];
}

export function addPackageToCache(packageID, packageContent) {
    packageCache.items[packageID] = packageContent.rootItem;

    for (const [id, item] of Object.entries(packageContent.metadata)) {
        if (packageContent.files[id]) {
            packageCache.files[id] = {
                blob: new Blob([packageContent.files[id]], {type: item.mimeType}),
                hash: item.hash,
                itemName: item.name,
                itemType: item.type,
                mimeType: item.mimeType
            }
        }
        packageCache.items[id] = item;
    }

    for (const folder of Object.values(packageContent.folders)) {
        folder._id = packageID + ":" + folder._id;
        folder.parent = packageID + ":" + folder.parent;
        packageCache.folders[folder._id] = folder;
    }
}

export async function parsePackage(binaryBlob, pkgID) {
    const input = Buffer.from(await binaryBlob.arrayBuffer());
    let headerFileOffset = 0;

    const magicValue = input.subarray(headerFileOffset, MAGIC_BYTES.length).toString();
    headerFileOffset += MAGIC_BYTES.length;

    const size = input.readInt32LE(MAGIC_BYTES.length)
    headerFileOffset += 4;

    const textDecoder = new TextDecoder();
    const headerBson = input.subarray(headerFileOffset, headerFileOffset + size);
    headerFileOffset += size;
    const header = JSON.parse(textDecoder.decode(headerBson));
    header.root = pkgID + "/" + header.root;

    let fileOffset = 0;
    const output = pako.ungzip(input.subarray(headerFileOffset));
    const buffer = Buffer.from(output);

    const metadataBson = buffer.subarray(fileOffset, fileOffset + header.metadataSize);
    fileOffset += header.metadataSize;
    const metadataRaw = JSON.parse(textDecoder.decode(metadataBson));
    const metadata = {};

    // Prefix all item IDs with the package ID
    Object.entries(metadataRaw).forEach(([id, item]) => {
        const newID = pkgID + "/" + id;
        item._id = newID;
        metadata[newID] = item;
        item.folder._id = pkgID + ":" + item.folder._id;

        for (const link of item.links) {
            link.to = pkgID + "/" + link.to;
        }
    });

    const foldersBson = buffer.subarray(fileOffset, fileOffset + header.foldersSize);
    fileOffset += header.foldersSize;
    const folders = JSON.parse(textDecoder.decode(foldersBson));

    const fileEntries = {};

    // Go over all items and store information about the position of their file content.
    for (const [_, value] of Object.entries(metadata)) {
        if (value.filesize) {
            fileEntries[value._id] = {
                start: fileOffset + (value.packageFileOffset || 0),
                end: fileOffset + (value.packageFileOffset || 0) + value.filesize
            }
        }
    }

    // Go over all found files, read them and store them in an object.
    const files = {};
    for (const [key, value] of Object.entries(fileEntries)) {
        const content = buffer.subarray(value.start, value.end);
        files[key] = content;
    }

    const rootItem = metadata[header.root];

    const hydratedItems = [];
    const hydrate = (item) => {
        // if (hydratedItems.includes(item._id)) return;

        hydratedItems.push(item._id);
        for (const link of item.links) {
            link.item = structuredClone(metadata[link.to]);
            hydrate(link.item);
        }
    };

    hydrate(rootItem);

    return {
        rootItem,
        metadata,
        folders,
        files
    }
}
