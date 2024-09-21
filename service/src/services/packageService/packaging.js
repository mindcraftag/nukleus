const pako                         = require("pako");
const {MAGIC_NUKLEUS_PACKAGE: MAGIC_BYTES} = require("../../tools/fileanalysis");
const { getItemDownloadStream, streamToBuffer } = require('./util');

/*

Structure of a package:
+-------+-------------+--------+----------+---------+--------+--------+-----+--------+
| MAGIC | HEADER_SIZE | HEADER | METADATA | FOLDERS | FILE_1 | FILE_2 | ... | FILE_N |
+-------+-------------+--------+----------+---------+--------+--------+-----+--------+
                               \_____________________________________________________/
                                               compressed with zlib

Explanation of the fields:
- MAGIC: a magic value to identify the file as a nukleus package
- HEADER_SIZE: the size of the header in bytes, stored as a 32 bit little-endian unsigned integer
- HEADER: the string-representation of a JSON structure containing the following fields:
    - root: id of the root item
    - type: what kind of item is included in this package (Scene, Mesh)
    - metadataSize: size of the metadata block in bytes
    - foldersSize: size of the folder information block in bytes
- METADATA: a string-representation of a JSON structure containing the items that are included in this package.
            The key is the item ID[1], the value is the item itself. The item includes a pointer into the files block.
- FOLDERS: a string-representation of a JSON structure containing the included folders
- FILES: The original content of the files, concatenated together.

[1]: Because it is possible to create a package of a scene that includes another package, we need to be careful with what IDs we use.
     The user can create a package from an item, change the item, and then create another package from it. In this case we have two different items, both with the same ID.
     Therefore we need to prefix the ID of the item with the package ID where it came from. So for example "<packageID>/<itemID>".

*/


// Create buffers from the header, items and folders.
function dataToBuffers(header, items, folders) {
    // Convert the items into plain objects and remove fields we don't need.
    const metadata = {};
    for (const [id, item] of Object.entries(items)) {
        const serializedItem = JSON.parse(JSON.stringify(item));
        delete serializedItem.encryptionKey;
        delete serializedItem.storages;

        metadata[id] = serializedItem;
    }

    // Stringify the metadata and folders and turn them into buffers.
    const textEncoder = new TextEncoder();
    const metadataJSON = textEncoder.encode(JSON.stringify(metadata));
    const foldersJSON = textEncoder.encode(JSON.stringify(folders));

    // Now we can calculate the size of the metadata and folders in bytes.
    // This information is needed to decode the package.
    header.metadataSize = metadataJSON.byteLength;
    header.foldersSize = foldersJSON.byteLength;

    const headerJSON = textEncoder.encode(JSON.stringify(header));
    const headerSize = headerJSON.byteLength;

    // Write the size of the header JSON string as a 32 bit unsigned little-endian integer.
    const sizeBytes = Buffer.alloc(4);
    sizeBytes.writeUInt32LE(headerSize, 0);

    // Collect the buffers into two arrays, one for the header and one for the rest.
    // We need two arrays, because we want to compress the metadata, folders and files, while keeping
    // the header uncompressed, so we can read it without decompressing the whole package. 
    const bufferParts = [
        metadataJSON,
        foldersJSON
    ];

    const headerBuffer = Buffer.concat([
        Buffer.from(MAGIC_BYTES),
        sizeBytes,
        headerJSON
    ]);

    return {
        headerBuffer, bufferParts
    };
}

exports.dataToBuffers = dataToBuffers;
