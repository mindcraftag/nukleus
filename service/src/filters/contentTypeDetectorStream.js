"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fileanalysis  = require('../tools/fileanalysis');
const logger        = require('../tools/logger');
const util          = require('util');
const stream        = require('stream');

function ContentTypeDetectorStream(filename) {
    this.callback = null;
    this.detectionReturned = false;
    this.buffer = null;
    this.filename = filename;
    stream.Transform.call(this);
}
util.inherits(ContentTypeDetectorStream, stream.Transform);

ContentTypeDetectorStream.prototype.setCallback = function(cb) {
    this.callback = cb;
};

ContentTypeDetectorStream.prototype._transform = function (chunk, enc, cb) {
    if (!this.detectionReturned && this.callback) {
        const newBuf = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk);
        if (!this.buffer)
            this.buffer = newBuf;
        else
            this.buffer = Buffer.concat([this.buffer, newBuf]);

        if (this.buffer.length >= 1024) {
            this.detectionReturned = true;
            fileanalysis.getContentType(this.buffer, this.filename).then(this.callback);
        }
    }
    this.push(chunk);
    cb();
};

ContentTypeDetectorStream.prototype._flush = function(cb) {
    // If the detection result was already returned, then we don't do anything now.
    if (this.detectionReturned) {
        cb();
        return;
    }
    
    // If a detection result was not returned yet, but if we do have some data in the buffer,
    // we'll try to detect the content type now.
    if (this.buffer && this.buffer.length > 0) {
        fileanalysis.getContentType(this.buffer, this.filename).then((mimeType) => {
            this.callback(mimeType);
            cb();
        }).catch(err => {
            this.callback("");
            cb();
        });
    } else {
        // If the buffer is empty (for example because the file was empty), we return an empty string.
        this.callback("");
        cb();
    }
};

exports.getContentType = function(input, filename) {
    const st = new ContentTypeDetectorStream(filename);

    const promise = new Promise((resolve, reject) => {
        st.on("error", function(err) {
            logger.error(err);
            reject(err);
        });

        try {
            st.setCallback(resolve);
            input.pipe(st);
        }
        catch(err) {
            reject(err);
        }
    });

    return {
        stream: st,
        promise: promise
    };
};
