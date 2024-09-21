"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

var defaults = require("defaults");

/**
 * To help TypeScript understand that this function behaves like a class,
 * we add this type-annotation:
 * @type Class
 */
var RedisStore = function (options) {
    options = defaults(options, {
        expiry: 60, // default expiry is one minute
        prefix: "rl:",
        resetExpiryOnChange: false,
        redisURL: undefined,
        passIfNotConnected: false,
    });

    var expiryMs = Math.round(1000 * options.expiry);

    options.client.connect().then(function() {
        console.log("Connected to redis");
    }).catch(function(err) {
        console.error("Redis connection error: ", err);
    })

    var setExpire = function (replies, rdskey) {
        // if this is new or has no expiry
        if (options.resetExpiryOnChange || replies[0] === 1 || replies[1] === -1) {
            // then expire it after the timeout
            options.client.pExpire(rdskey, expiryMs);
            return expiryMs;
        } else {
            return replies[1];
        }
    };

    var processReplies = function (replies) {
        // in ioredis, every reply consists of an array [err, value].
        // We don't need the error here, and if we aren't dealing with an array,
        // nothing is changed.
        return replies.map(function (val) {
            if (Array.isArray(val) && val.length >= 2) {
                return val[1];
            }

            return val;
        });
    };

    this.incr = function (key, cb) {
        var rdskey = options.prefix + key;

        // If the Redis client is not connected, and the option to pass is enabled,
        // then bypass now!
        if (!options.client.connected && options.passIfNotConnected) {
            console.warn("redis client is not connected, rate-limit-redis disabled!");
            return cb(null, 0, null);
        }

        options.client
            .multi()
            .incr(rdskey)
            .pTTL(rdskey)
            .exec()
            .then(function (replies) {
                replies = processReplies(replies);
                var ttl = setExpire(replies, rdskey);

                cb(
                    null,
                    replies[0],
                    ttl > 0 ? new Date(new Date().getTime() + ttl) : null
                );
            }).catch(function(err) {
                console.error(err);
                cb(err);
            });
    };

    this.decrement = function (key) {
        var rdskey = options.prefix + key;

        options.client
            .multi()
            .decr(rdskey)
            .pTTL(rdskey)
            .exec()
            .then(function (replies) {
                replies = processReplies(replies);
                setExpire(replies, rdskey);
            }).catch(function(err) {
                console.error(err);
            });
    };

    this.resetKey = function (key) {
        var rdskey = options.prefix + key;

        options.client.del(rdskey).catch(function(err) {
            console.error(err);
        });
    };
};

module.exports = RedisStore;
