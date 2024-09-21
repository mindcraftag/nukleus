"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------
const { Readable } = require('stream');

exports.streamToBuffer = function(stream) {
    return new Promise((resolve, reject) => {
        try {
            const buffers = [];
            stream.on('data', function (d) {
                buffers.push(d);
            });
            stream.on('error', function(err) {
                reject(err);
            });
            stream.on('end', function () {
                const buffer = Buffer.concat(buffers);
                resolve(buffer);
            });
        }
        catch(err) {
            reject(err);
        }
    });
}

exports.bufferToStream = function(buffer) {
    const stream = new Readable();

    stream.push(buffer);
    stream.push(null);

    return stream;
}