"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const Jimp = require('jimp');
const { Readable } = require('stream');
const { streamToBuffer, bufferToStream } = require('./streamTools');

/**
 * @typedef {
 *  width: number,
 *  height: number,
 *  outputDataType?: "BASE_64" | "BUFFER" | "READABLE",
 *  outputMimeType?: "JPEG" | "PNG",
 *  resizeStrategy?: "COVER" | "SCALE_TO_FIT"
 *  quality?: number
 * } SizeOption
 */

/**
 * @typedef {
 *  width: number,
 *  height: number,
 *  data: Promise<string | Buffer>
 * } ResizedImageData
 */

const MIME_TYPES = {
    JPEG: Jimp.MIME_JPEG,
    PNG: Jimp.MIME_PNG,
    AUTO: Jimp.AUTO
}

/**
 * @param {Buffer} buffer 
 * @returns {Promise<{width: number, height: number, data: string}>}
 */

exports.convertToDataURL = async function(buffer) {
    if (!buffer.length)
        return null;

    const image = await Jimp.read(buffer);
    const data = await image.quality(90).getBase64Async(Jimp.MIME_JPEG);
    
    return {
        width: image.bitmap.width,
        height: image.bitmap.height,
        data: data
    };
}

/**
 * @param {Buffer} buffer 
 * @returns {Promise<{width: number, height: number}>}
 */
exports.getDimensionsFromBuffer = async function(buffer) {
    if (!buffer.length)
        return;

    const image = await Jimp.read(buffer);

    return {
        width: image.bitmap.width,
        height: image.bitmap.height,
    };
}

/**
 *
 * @param {Buffer} buffer 
 * @param {SizeOption[]} sizeOptions 
 * @returns {Promise<ResizedImageData[]>}
 */
exports.generateResizedImagesFromBuffer = async function (buffer, sizeOptions) {
    const promises = [];
    const originalImage = await Jimp.read(buffer);


    for (const size of sizeOptions) {
        const {width, height, outputDataType, outputMimeType, resizeStrategy, quality } = size;
        const clonedImage = originalImage.clone();

        // Resize
        let resizedImage;
        if (resizeStrategy === "SCALE_TO_FIT") {
            resizedImage = clonedImage.scaleToFit(width, height);
        } else {
            resizedImage = clonedImage.cover(width, height);
        }

        // Compress - only works for JPEG
        let compressedImage = resizedImage;
        if (quality !== undefined) {
            compressedImage = resizedImage.quality(quality);
        }

        // Output MimeType
        let data;
        let jimpMimeType = MIME_TYPES[outputMimeType];
        
        if (!jimpMimeType) {
            jimpMimeType = Jimp.AUTO;
        }

        // Transform to OutputType
        if (outputDataType === "BASE_64") {
            data = compressedImage.getBase64Async(jimpMimeType);
        } else if (outputDataType === "BUFFER") {
            data = compressedImage.getBufferAsync(jimpMimeType);
        } else {
            data = new Promise(async (resolve) => {
                const buffer = await compressedImage.getBufferAsync(jimpMimeType);
                const stream = bufferToStream(buffer);

                resolve(stream);
            })
        }
        
        promises.push(data);
    }

    const data = await Promise.all(promises);

    const images = data.map((entry, i) => {
        return {
            data: entry,
            width: sizeOptions[i].width,
            height: sizeOptions[i].height,
        }
    })

    return images;
};

/**
 * @param {Readable} stream 
 * @param {SizeOption[]} sizeOptions 
 * @returns {Promise<ResizedImageData[]>}
 */
exports.generateResizedImagesFromStream = async function(stream, sizeOptions) {
    const buffer = await streamToBuffer(stream);
    return exports.generateResizedImagesFromBuffer(buffer, sizeOptions);
}