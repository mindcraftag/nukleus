"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment    = require("moment");
const AWS       = require("aws-sdk");
const logger    = require("../../tools/logger");
const Storage   = require('./storage');

class S3Storage extends Storage {

    constructor(cfg) {
        super();

        logger.info("Initializing S3 file storage");

        this._config = cfg;

        let endpoint;
        if (this._config.endpoint) {
            endpoint = new AWS.Endpoint(this._config.endpoint);
        }

        this._s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            credentials: new AWS.Credentials(this._config.accessKeyId, this._config.secretAccessKey),
            endpoint: endpoint
        });
    }

    async storeData(name, bufferOrStream) {
        if (!this._s3 || !this._config)
            throw "Amazon S3 storage plugin not yet fully initialized!";

        try {
            const startTime = moment().valueOf();
            logger.info(`Loading item ${name} to S3 bucket ${this._config.bucket}`);
            await this._uploadToS3(name, bufferOrStream);
            const time = moment().valueOf() - startTime;
            logger.info(` - ${this._config.bucket} -> Time: ${time} ms`);
        }
        catch(err) {
            throw `Upload to S3 failed: ${err}`;
        }
    }

    async retrieveData(name, start, end) {
        if (!this._s3 || !this._config)
            throw "Amazon S3 storage plugin not yet fully initialized!";

        const range = start!==undefined ? `bytes=${start}-${end}` : null;

        try {
            // Attempt to load the object first to see if it exists.
            await this._s3.headObject({
                Bucket: this._config.bucket,
                Key: name,
            }).promise();
        } catch (err) {
            throw `Can't load item from S3 with Name = ${name}: ${err}`;
        }

        const request = this._s3.getObject({
            Bucket: this._config.bucket,
            Key: name,
            Range: range
        });

        const stream = request.createReadStream();
        stream.on('error', function(err) {
            request.abort();
        });

        return {
            stream: stream,
            abortFunc: function() {
                request.abort();
            }
        };
    }

    async deleteData(name) {
        if (!this._s3 || !this._config)
            throw "Amazon S3 storage plugin not yet fully initialized!";

        try {
            const startTime = moment().valueOf();
            logger.info(`Deleting item ${name} from S3 bucket ${this._config.bucket}`);
            await this._deleteFromS3(name);
            const time = moment().valueOf() - startTime;
            logger.info(` - ${this._config.bucket} -> Time: ${time} ms`);
        }
        catch(err) {
            throw `Delete from S3 failed: ${err}`;
        }
    }

    async copyData(sourceName, destName) {
        if (!this._s3 || !this._config)
            throw "Amazon S3 storage plugin not yet fully initialized!";

        try {
            const startTime = moment().valueOf();
            logger.info(`Copying S3 item ${sourceName} to ${destName}`);
            await this._copyOnS3(sourceName, destName);
            const time = moment().valueOf() - startTime;
            logger.info(` - ${this._config.bucket} -> Time: ${time} ms`);
        }
        catch(err) {
            throw `Copy on S3 failed: ${err}`;
        }
    }

    async enumerate() {
        if (!this._s3 || !this._config)
            throw "Amazon S3 storage plugin not yet fully initialized!";

        try {
            const startTime = moment().valueOf();

            logger.info(`Getting all keys from bucket: ${this._config.bucket}`);

            let continuationToken = null;
            const results = [];

            do {
                const data = await this._enumerateS3(continuationToken);
                for (const content of data.Contents) {
                    results.push(content.Key);
                }

                if (data.IsTruncated) {
                    continuationToken = data.NextContinuationToken;
                } else {
                    continuationToken = null;
                }

            } while (continuationToken);

            const time = moment().valueOf() - startTime;
            logger.info(` - Enumerate ${this._config.bucket} found ${results.length} -> Time: ${time} ms`);
            return results;
        }
        catch(err) {
            throw `Enumerate on S3 failed: ${err}`;
        }
    }

    async _uploadToS3(name, bufferOrStream) {
        return new Promise((resolve, reject) => {
            this._s3.upload({
                Bucket: this._config.bucket,
                Key: name,
                Body: bufferOrStream
            }, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    async _copyOnS3(sourceName, destName) {
        return new Promise((resolve, reject) => {
            this._s3.copyObject({
                Bucket: this._config.bucket,
                CopySource: `/${this._config.bucket}/${sourceName}`,
                Key: destName
            }, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    async _deleteFromS3(name) {
        return new Promise((resolve, reject) => {
            this._s3.deleteObject({
                Bucket: this._config.bucket,
                Key: name
            }, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    async _enumerateS3(continuationToken) {
        return new Promise((resolve, reject) => {
            this._s3.listObjectsV2({
                Bucket: this._config.bucket,
                ContinuationToken: continuationToken
            }, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }
}

module.exports = {

    type: "Storage",
    name: "S3",

    instantiate(cfg) {
        return new S3Storage(cfg);
    }
};
