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
const logger    = require('../tools/logger');

function incrementBuffer(buf, cnt) {
    let i, len, mod;
    len = buf.length;
    i = len - 1;
    while (cnt !== 0) {
        mod = (cnt + buf[i]) % 256;
        cnt = Math.floor((cnt + buf[i]) / 256);
        buf[i] = mod;
        i -= 1;
        if (i < 0) {
            i = len - 1;
        }
    }
    return buf;
}

function StreamDecryptor(secret, counter, offset, length) {
    this.counter = counter || 0;
    this.callback = null;
    this.secret = secret;
    this.offset = offset || 0;
    this.length = length;
    this.iv = secret.iv;
    this.key = secret.key;

    if (this.iv.buffer) {
        this.iv = this.iv.buffer;
    }

    if (this.key.buffer) {
        this.key = this.key.buffer;
    }

    this.iv = incrementBuffer(this.iv, this.counter);
    this.decypher = crypto.createDecipheriv('aes-256-ctr', this.key, this.iv);
    stream.Transform.call(this);
}
util.inherits(StreamDecryptor, stream.Transform);

StreamDecryptor.prototype.setCallback = function(cb) {
    this.callback = cb;
};

StreamDecryptor.prototype._transform = function (chunk, enc, cb) {
    if (this.length === undefined || this.length > 0) {
        let buffer = this.decypher.update(chunk);
        if (this.offset) {
            if (buffer.length < this.offset) {
                this.offset -= buffer.length;
            } else {
                let length = buffer.length - this.offset;
                if (length > this.length) {
                    length = this.length;
                }

                buffer = buffer.slice(this.offset, this.offset + length);
                this.offset = 0;
                this._pushBuffer(buffer);
            }
        } else {
            if (this.length !== undefined && buffer.length > this.length) {
                buffer = buffer.slice(0, this.length);
            }

            this._pushBuffer(buffer);
        }
    }
    cb();
};

StreamDecryptor.prototype._pushBuffer = function(buffer) {
    this.push(buffer);
    if (this.length !== undefined)
        this.length -= buffer.length;
}

StreamDecryptor.prototype._flush = function(cb) {
    this.push(this.decypher.final());
    if (this.callback){
        this.callback();
    }
    cb();
};

exports.decryptStream = function(input, secret, counter, offset, length) {
    const st = new StreamDecryptor(secret, counter, offset, length);
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