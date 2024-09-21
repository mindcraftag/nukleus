const fileStorage                  = require('../fileStorageService');
const decryptorStream              = require('../../filters/decryptorStream');

// Take in a stream and return a buffer that contains the streams data.
async function streamToBuffer(stream) {
    return new Promise((resolve) => {
        const parts = [];

        stream.on("data", (chunks) => parts.push(chunks));
        stream.on("end", () => resolve(Buffer.concat(parts)));
    });
}

// Get a download stream for an item. 
// The download stream will be decrypted if applicable.
async function getItemDownloadStream(item) {
    const download = await fileStorage.download(item._id.toString(), item.storages);

    let stream = download.stream;
    if (item.encryptionKey) {
        const decryptor = decryptorStream.decryptStream(stream, item.encryptionKey);
        stream = decryptor.stream;
    }
    return stream;
}

// Export these functions because they will be useful in the tests for this service.
exports.streamToBuffer = streamToBuffer;
exports.getItemDownloadStream = getItemDownloadStream;