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
const stream    = require('stream');

function LengthCounterStream() {
    this.callback = null;
    this.count = 0;
    stream.Transform.call(this);
}
util.inherits(LengthCounterStream, stream.Transform);

LengthCounterStream.prototype.setCallback = function(cb) {
    this.callback = cb;
};

LengthCounterStream.prototype._transform = function (chunk, enc, cb) {
    this.count += chunk.length;
    this.push(chunk);
    cb();
};

LengthCounterStream.prototype._flush = function(cb) {
    if (this.callback){
        this.callback(this.count);
    }
    cb();
};

exports.getStreamLength = function(input) {
    const st = new LengthCounterStream();

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