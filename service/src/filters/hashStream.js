"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const logger    = require('../tools/logger');
const util      = require('util');
const crypto    = require('crypto');
const stream    = require('stream');

function HashStream() {
    this.hash = crypto.createHash("sha256");
    this.callback = null;
    stream.Transform.call(this);
}
util.inherits(HashStream, stream.Transform);

HashStream.prototype.setCallback = function(cb){
    this.callback = cb;
};

HashStream.prototype._transform = function (chunk, enc, cb) {
    this.hash.update(chunk);
    this.push(chunk);
    cb();
};

HashStream.prototype._flush = function(cb) {
    if (this.callback) {
        this.callback(this.hash.digest('hex'));
    }
    cb();
};

exports.getHash = function(input) {
    const st = new HashStream();

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