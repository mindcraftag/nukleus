"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose = require('@mindcraftgmbh/nukleus-model').mongoose;
const logger = require('../tools/logger');
const moment = require('moment');

function log(req, res, bytes, durationMs, date) {
    try {
        const status = res.statusCode;

        // we don't log rate limited requests
        if (status === 429)
            return;

        // we do not log requests from job agents
        if (req.user && (req.user.isSystemUser || req.user.isClientSystemUser))
            return;

        // There may be multiple IP addresses in the X-Forwarded-For header.
        // Since we know that there is exactly one trusted proxy (the nginx
        // ingress) in front of the API, we can only trust the last IP address
        // in the list. This is explained in more detail on MDN:
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For#selecting_an_ip_address

        let ip = "";
        if (req.headers["x-forwarded-for"]) {
            const parts = req.headers["x-forwarded-for"].split(", ");
            ip = parts[parts.length - 1];
        } else {
            ip = req.connection.remoteAddress;
        }

        // we do not track local traffic
        if (ip === "::1")
            return;

        const method = req.method;
        const path = req.baseUrl + (req.route ? req.route.path : "");
        const user = req.user ? req.user._id : undefined;
        const client = req.user ? req.user.client : req.requestedItemClient;
        const mdate = moment(date);

        //logger.info(`TrafficCounter: ${date} ${method} ${path} - ${bytes} bytes to ${ip} in ${durationMs} ms -> ${user} ${client}`);

        const ApiRequest = mongoose.model("ApiRequest");
        const apiRequest = new ApiRequest({
            ip: ip,
            path: path,
            method: method,
            status: status,
            year: mdate.year(),
            month: mdate.month(),
            day: mdate.date(),
            hour: mdate.hour(),
            minute: mdate.minute(),
            date: date,
            client: client,
            user: user,
            requestedItem: req.requestedItem,
            quotaUser: req.quotaUser,
            quotaGroup: req.quotaGroup,
            bytes: bytes,
            timeMs: durationMs
        });

        apiRequest.save().catch(function (err) {
            logger.error("Traffic Counter:", err);
        });
    }
    catch(err) {
        logger.error(err.toString());
    }
}

function count(obj) {
    if (obj) {
        if (typeof obj === "string")
            return obj.length;
        else if (obj instanceof Buffer)
            return obj.length;
    }
    return 0;
}

module.exports = function() {

    return function (req, res, next) {

        const start = new Date();
        let logged = false;
        let done = false;
        let bytes = 0;

        function countAndLog(obj) {
            bytes += count(obj);
            if (!logged) {
                logged = true;
                const end = new Date();
                const duration = end - start;
                log(req, res, bytes, duration, start);
            }
        }

        res.write = (function(write) {
            return function(obj, encoding, fd) {
                write.apply(res, arguments);
                bytes += count(obj);
            }
        })(res.write);

        res.end = (function(end) {
            return function(obj, encoding, fd) {
                end.apply(res, arguments);
                if (!done)
                    countAndLog(obj);
            }
        })(res.end);

        res.send = (function(send) {
            return function(obj) {
                done = true;
                send.apply(res, arguments);
                countAndLog(obj);
            }
        })(res.send);

        next();
    };
}
