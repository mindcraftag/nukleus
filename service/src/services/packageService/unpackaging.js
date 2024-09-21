const pako                         = require("pako");
const {MAGIC_NUKLEUS_PACKAGE: MAGIC_BYTES} = require("../../tools/fileanalysis");
const { mongoose } = require("@mindcraftgmbh/nukleus-model");
const crypto = require("crypto");
const { itemService } = require("../../..");
const { Readable } = require('stream');

// Take in a buffer with the binary data of a package and return an object
// with the information contained in the package.
exports.parsePackage = async function(input) {
    // We need to keep track of two different offsets, because only the "content" of the package is compressed.
    // The header offset tracks how far we are in the uncompressed data.
    let headerFileOffset = 0;

    // Check if the file has the correct magic bytes.
    const magicValue = input.subarray(headerFileOffset, MAGIC_BYTES.length);
    headerFileOffset += MAGIC_BYTES.length;
    if (!magicValue.equals(MAGIC_BYTES)) {
        throw new Error("Invalid magic bytes in package file.");
    }

    // Read the size of the header.
    const size = input.readInt32LE(MAGIC_BYTES.length)
    headerFileOffset += 4;

    // Parse the header.
    const textDecoder = new TextDecoder();
    const headerBson = input.subarray(headerFileOffset, headerFileOffset + size);
    headerFileOffset += size;
    const header = JSON.parse(textDecoder.decode(headerBson));

    // Now we need another offset, because the "content" of the package needs to be
    // decompressed and lives in its own separate buffer.
    let fileOffset = 0;
    const output = pako.ungzip(input.subarray(headerFileOffset));
    const buffer = Buffer.from(output);

    // Parse the metadata and folder information.
    const metadataString = buffer.subarray(fileOffset, fileOffset + header.metadataSize);
    fileOffset += header.metadataSize;
    const metadata = JSON.parse(textDecoder.decode(metadataString));

    const foldersString = buffer.subarray(fileOffset, fileOffset + header.foldersSize);
    fileOffset += header.foldersSize;
    const folders = JSON.parse(textDecoder.decode(foldersString));

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

    return {
        header, metadata, files, folders
    };
}



exports.unpack = async function(input, folderID, client, plan) {
    const {header, metadata, files, folders} = await exports.parsePackage(input);

    const folderMap = {};

    const Folder = mongoose.model('Folder');

    const createSubFolders = async (folderID, newParentID) => {
        const subfolders = folders.filter(f => f.parent === folderID);

        for (const subfolder of subfolders) {
            const existingFolderWithSameName = await Folder.findOne({
                name: subfolder.name,
                parent: newParentID,
                client: subfolder.client,
                deletedAt: { $exists: false }
            });

            let newFolderName;
            if (existingFolderWithSameName) {
                // The id will be at least two ObjectIDs long, so it's shorter to use the hash.
                // Also otherwise multiple folders with the same name might have many repeating characters.
                const hash = crypto.createHash('md5').update(subfolder._id).digest('hex');
                newFolderName = subfolder.name + " (" + hash + ")";
            } else {
                newFolderName = subfolder.name;
            }

            const newFolder = await Folder.create({
                name: newFolderName,
                parent: newParentID,
                client: client._id
            })
            folderMap[subfolder._id] = newFolder._id.toString();
            await createSubFolders(subfolder._id, newFolder._id);
        }

    }

    folderMap[header.rootFolder] = folderID;
    await createSubFolders(header.rootFolder, folderID)

    const Item = mongoose.model('Item');

    const itemMap = {};

    const uploadContent = async (id, item) => {
        if (files[id]) {
            const readStream = Readable.from(files[id]);
            await itemService.uploadFile(readStream, item, false, client, plan, false, "", true, true);
            await item.save();
        }
    }

    const convertLinksToObjectID = (links) => {
        return links.map(link => {
            return {
                to: new mongoose.Types.ObjectId(link.to),
                usage: link.usage
            }
        });
    };

    const createItem = async (item) => {
        // It's possible that the item was already created, because it was referenced by another item.
        // In that case we don't have to create the item again and can just return the ID of the created item.
        try {
            const newItem = await Item.create({
                name: item.name,
                client: client._id,
                type: item.type,
                links: convertLinksToObjectID(item.links),
                attributes: item.attributes,
                userAttributes: item.userAttributes,
                mimeType: item.mimeType,
                folder: folderMap[item.folder._id]
            });
            await uploadContent(item._id, newItem);

            itemMap[item._id] = newItem._id.toString();
            return newItem._id.toString();
        } catch (e) {
            const existingItem = await Item.findOne({
                name: item.name,
                client: client._id,
                folder: folderMap[item.folder._id]
            });
            itemMap[item._id] = existingItem._id.toString();
            return existingItem._id.toString();
        }
    }

    const processItem = async (item) => {
        if (!itemMap[item._id]) {
            for (const link of item.links) {
                link.to = await processItem(metadata[link.to]);
            }

            return await createItem(item);
        } else {
            return itemMap[item._id];
        }
    }

    // Recursive links don't exist, so we can just go through all items and process them individually.
    for (const item of Object.values(metadata)) {
        if (!itemMap[item._id]) {

            for (const link of item.links) {
                if (itemMap[link.to]) {
                    link.to = itemMap[link.to];
                } else {
                    link.to = await processItem(metadata[link.to]);
                }
            }

            await createItem(item);
        }
    }
}
