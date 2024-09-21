"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const rateLimit     = require('express-rate-limit');
const RedisStore    = require('./redisStore');
const logger        = require('../tools/logger');
const { createClient, createCluster} = require("redis");

let limiters = new Map();
let config = {
    maxRequests: 1000,
    windowSeconds: 60 * 5
};

exports.init = function(cfg) {
    config = cfg;

    switch(cfg.type) {
        case "memory":
            // this is default, do nothing
            break;

        case "redis":
            logger.info(`Using redis at ${cfg.host}:${cfg.port}`)
            break;

        default:
            throw "Invalid value for type of limiter storage: " + cfg.type;
    }
}

function keyGenerator(req) {
    return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
}

function getRedisUrl() {
    return `redis://${config.host}:${config.port}`;
}

function createRedisClient() {
    if (!config.cluster)
        return createClient({ url: getRedisUrl() });
    else
        return createCluster({
            rootNodes: [{ url: getRedisUrl() }],
            defaults: { password: config.password }});
}

exports.getRedisEntries = async function() {
    const client = createRedisClient();
    client.on("error", (err) => {
        console.error(err);
        process.exit(1);
    });
    await client.connect();

    const keys = await client.keys("*");

    const entries = {};
    for (const key of keys) {
        entries[key] = await client.get(key);
    }
    return entries;
}

exports.createLimiter = function(maxRequests, windowSeconds) {
    maxRequests = maxRequests || config.maxRequests;
    windowSeconds = windowSeconds || config.windowSeconds;

    const key = `${maxRequests}_${windowSeconds}`;

    if (limiters.has(key))
        return limiters.get(key);

    logger.info(`Creating new limiter with ${maxRequests} max requests within a ${windowSeconds} second window`);

    let options = {
        keyGenerator: keyGenerator,
        windowMs: windowSeconds * 1000,
        max: maxRequests,       // Requests per window
        standardHeaders: true,  // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false    // Disable the `X-RateLimit-*` headers
    };

    if (config.type === 'redis') {
        const client = createRedisClient();
        client.on("error", (err) => {
            console.error(err);
            process.exit(1);
        });
        options.store = new RedisStore({
            client: client,
            expiry: config.windowSeconds,
            prefix: `rl_${key}_`
        });
    }

    const limiter = rateLimit(options);
    limiters.set(key, limiter);
    return limiter;
}
