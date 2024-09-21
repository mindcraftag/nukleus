"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs = require("fs");
const path = require("path");
const stream = require("stream");
const Storage = require('./storage');

class StorageFileSystem extends Storage {

    constructor(config) {
        super();
        this.storagePath = config.path;
    }

    async storeData(name, bufferOrStream) {
        if (!this.storagePath)
            throw "Filesystem storage plugin not yet initialized. Path is missing!";

        const filePath = path.join(this.storagePath, name);

        if (bufferOrStream instanceof stream.Stream) {
            return new Promise(((resolve, reject) => {
                const writeStream = fs.createWriteStream(filePath, {encoding: 'binary'});
                bufferOrStream.pipe(writeStream);
                writeStream.on('close', function() {
                    resolve();
                });
                writeStream.on('error', function(err) {
                    reject(err)
                })
            }));
        } else {
            return new Promise((resolve, reject) => {
                fs.writeFile(filePath, bufferOrStream, { encoding: 'binary' }, function(err) {
                    if (err)
                        reject(err);

                    resolve();
                });
            });
        }
    }

    async retrieveData(name, start, end) {
        if (!this.storagePath)
            throw "Filesystem storage plugin not yet initialized. Path is missing!";

        const filePath = path.join(this.storagePath, name);
        return {
            stream: fs.createReadStream(filePath, { start: start, end: end }),
            abortFunc: function() {}
        };
    }

    async deleteData(name) {
        if (!this.storagePath)
            throw "Filesystem storage plugin not yet initialized. Path is missing!";

        const filePath = path.join(this.storagePath, name);
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, function(err) {
                if (err)
                    reject(err);

                resolve();
            });
        });
    }

    async copyData(name, destName) {
        if (!this.storagePath)
            throw "Filesystem storage plugin not yet initialized. Path is missing!";

        const fileSrcPath = path.join(this.storagePath, name);
        const fileDestPath = path.join(this.storagePath, destName);

        return new Promise((resolve, reject) => {
            fs.copyFile(fileSrcPath, fileDestPath, function(err) {
                if (err)
                    reject(err);

                resolve();
            });
        })
    }

    async enumerate() {
        return fs.readdirSync(this.storagePath);
    }
}

module.exports = {

    type: "Storage",
    name: "FS",

    instantiate(cfg) {
        return new StorageFileSystem(cfg);
    }
};
