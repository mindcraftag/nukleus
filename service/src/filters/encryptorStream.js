"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const util      = require('util');
const crypto    = require('crypto');
const stream    = require('stream');

function StreamEncryptor(secret) {
    this.callback = null;
    this.secret = secret;
    this.iv = secret.iv;
    this.key = secret.key;

    if (this.iv.buffer) {
        this.iv = this.iv.buffer;
    }

    if (this.key.buffer) {
        this.key = this.key.buffer;
    }

    this.cypher = crypto.createCipheriv('aes-256-ctr', this.key, this.iv);
    stream.Transform.call(this);
}
util.inherits(StreamEncryptor, stream.Transform);

StreamEncryptor.prototype.setCallback = function(cb) {
    this.callback = cb;
};

StreamEncryptor.prototype._transform = function (chunk, enc, cb) {
    this.push(this.cypher.update(chunk));
    cb();
};

StreamEncryptor.prototype._flush = function(cb) {
    this.push(this.cypher.final());
    if (this.callback){
        this.callback();
    }
    cb();
};

exports.encryptStream = function(input, secret) {
    const st = new StreamEncryptor(secret);
    st.on("error", function(err) {
        logger.error(err);
    });

    const promise = new Promise((resolve, reject) => {
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