"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const jwt                   = require('jsonwebtoken');
const bcrypt                = require('bcryptjs');
const mongoose              = require('@mindcraftgmbh/nukleus-model').mongoose;
const crypto                = require('crypto');
const hawk                  = require('@hapi/hawk');
const config                = require('../config');
const accessTokenService    = require('../services/accessTokenService');

let serverBaseUrl = null;
let systemUserId = null;

let hawkCredentials = {
    id: 'n',
    key: 'es4tgp8j7Wpv987hw34e5t987hnaw43tg',
    algorithm: 'sha256'
};

exports.init = function(baseUrl) {
    serverBaseUrl = baseUrl;
};

exports.scorePassword = function(pass) {
    let score = 0;
    if (!pass)
        return score;

    // award every unique letter until 5 repetitions
    let letters = {};
    for (let i=0; i<pass.length; i++) {
        letters[pass[i]] = (letters[pass[i]] || 0) + 1;
        score += 5.0 / letters[pass[i]];
    }

    // bonus points for mixing it up
    let variations = {
        digits: /\d/.test(pass),
        lower: /[a-z]/.test(pass),
        upper: /[A-Z]/.test(pass),
        nonWords: /\W/.test(pass),
    }

    let variationCount = 0;
    for (const check in variations) {
        variationCount += (variations[check] === true) ? 1 : 0;
    }
    score += (variationCount - 1) * 10;

    return parseInt(score);
}

exports.createAesSecret = function() {
    return {
        key: crypto.randomBytes(32),
        iv: crypto.randomBytes(16)
    }
}

exports.checkPassStrength = function(pass) {
    const score = exports.scorePassword(pass);
    if (score > 80)
        return "strong";
    if (score > 60)
        return "good";
    if (score >= 30)
        return "weak";

    return "";
}

exports.setSystemUserId = function(sysUserId) {
    systemUserId = sysUserId;
};

exports.getSystemUserId = function() {
    return systemUserId;
}

exports.createLinkWithBewit = function(url) {
    const bewitUrl = "https://api.nukleus.cloud" + url;
    const bewit = hawk.uri.getBewit(bewitUrl, {
        credentials: hawkCredentials,
        ttlSec:      60*60
    });
    return serverBaseUrl + url + '?bewit=' + bewit;
};

exports.validateMac = async function(req, res, next) {
    try {
        if (req === undefined && res === undefined && next === undefined) {
            // in case this happens, we're triggering the checkAccess function to return
            // its configuration. do that.
            return {
                anonymous: true,
                requiresMac: true,
                permissions: [],
                options: null
            };
        }

        const host = "api.nukleus.cloud";

        var request = {
            method: req.method,
            url: req.originalUrl,
            headers: {
                host: host
            },
            port: req.port,
            host: host
        };

        var options = { };
        options.port = 443;
        options.host = "api.nukleus.cloud";

        const {credentials, attributes} = await hawk.uri.authenticate(request, function (id) {
            return hawkCredentials;
        }, options);
        next();
    }
    catch(err) {
        console.error(err);
        return res.send(401);
    }
};

exports.sha256 = function(buffer) {
    return crypto.createHash("sha256").update(buffer).digest('hex');
};

exports.createRandomPassword = function(length, passwordChars) {
    return new Promise((resolve, reject) => {
        length = length || 32;
        passwordChars = passwordChars || "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#@!%&()/";
        const randPassword = Array(length).fill(passwordChars).map(function(x) {
            return x[Math.floor(Math.random() * x.length)]
        }).join('');
        resolve(randPassword);
    });
};

exports.passwordHash = function(password) {
    return bcrypt.hashSync(password, 8);
};

exports.comparePasswords = function(password, passwordHash) {
    return bcrypt.compareSync(password, passwordHash);
};

exports.createToken = function(userId, client, expiration) {
    return jwt.sign({ id: userId, client: client }, config.security.tokenSecret, {
        expiresIn: expiration || config.security.tokenExpiration
    });
};

exports.verifyToken = function(token) {
    try {
        return jwt.verify(token, config.security.tokenSecret);
    }
    catch(err) {
        return null;
    }
};

exports.accessAnonymous = function() {
    return async function(req, res, next) {
        if (req === undefined && res === undefined && next === undefined) {
            // in case this happens, we're triggering the checkAccess function to return
            // its configuration. do that.
            return {
                anonymous: true,
                permissions: [],
                options: null
            };
        }

        next();
    }
}

exports.checkAccess = function(permissions, options) {

    // Check passed permissions
    // ------------------------------------------------------------------
    if (permissions && !Array.isArray(permissions))
        throw "Permissions must be an array!";

    // Check passed options
    // ------------------------------------------------------------------
    if (!options || typeof options !== 'object') {
        options = {
            needsSystemUser: false,
            needsSuperAdmin: options || false,
            fetchPlan: false,
            fetchMetrics: false,
            fetchClient: false
        };
    } else {
        options.needsSystemUser = !!options.needsSystemUser;
        options.needsSuperAdmin = !!options.needsSuperAdmin;
        options.fetchPlan = !!options.fetchPlan;
        options.fetchMetrics = !!options.fetchMetrics;
        options.fetchClient = !!options.fetchClient;
    }

    return async function(req, res, next) {
        try {
            if (req === undefined && res === undefined && next === undefined) {
                // in case this happens, we're triggering the checkAccess function to return
                // its configuration. do that.
                return {
                    anonymous: false,
                    permissions: permissions,
                    options: options
                };
            }

            // Get fields from headers
            // ------------------------------------------------------------------
            const token = req.headers['x-access-token'];
            const apiToken = req.headers['x-api-token'];
            const requestedClient = req.headers['x-request-client'];
            const impersonateUser = req.headers['x-impersonate-user'];
            const haveToken = token && token.length;
            const haveApiToken = apiToken && apiToken.length;
            let lockedTokenClientId;

            if (haveToken && haveApiToken) {
                res.status(401).json({
                    result: 'failed',
                    error: 'cannot use both access and api token'
                });
                return;
            }

            if (!haveToken && !haveApiToken) {
                res.status(401).json({
                    result: 'failed',
                    error: 'no token provided'
                });
                return;
            }

            if (haveToken) {
                // Decode the provided access token
                // ------------------------------------------------------------------
                const decoded = exports.verifyToken(token);
                if (decoded) {
                    req.userId = decoded.id;
                    req.userIsApiToken = false;
                    if (decoded.client)
                        lockedTokenClientId = new mongoose.Types.ObjectId(decoded.client);
                } else {
                    res.status(401).json({
                        result: 'failed',
                        error: 'token invalid'
                    });
                    return;
                }
            } else {

                if (options.needsSuperadmin) {
                    // don't allow API Tokens to access superadmin resources
                    res.status(403).json({
                        result: 'failed',
                        error: 'permission denied'
                    });
                    return;
                }

                // Fetch the provided api token and get the user
                // ------------------------------------------------------------------
                const result = await accessTokenService.validateAccessToken(apiToken, "Api");
                if (!result.valid) {
                    res.status(401).json({
                        result: 'failed',
                        error: 'token invalid'
                    });
                    return;
                }

                req.userId = result.userId;
                req.userIsApiToken = true;
            }

            // Load the user and see if it exists and is active
            // ------------------------------------------------------------------
            const User = mongoose.model('User');
            req.user = await User.findOne({
                _id: req.userId,
                deletedAt: { $exists: false },
                waitingForApproval: { $exists: false },
                active: true
            }).select("-password -avatar").exec();

            if (!req.user) {
                res.status(401).json({
                    result: 'failed',
                    error: 'user not found'
                });
                return;
            }

            // Is the user the system user or a client system user?
            // ------------------------------------------------------------------
            req.isSystemUser = req.userId === systemUserId.toString();
            req.isClientSystemUser = req.user.internal && req.user.account.startsWith("system@");

            // A system user might need to impersonate a user to be able to create items in the name of the user
            // that triggered a job for example.
            if ((req.isSystemUser || req.isClientSystemUser) && impersonateUser) {
                let query = {
                    _id: new mongoose.Types.ObjectId(impersonateUser),
                    deletedAt: { $exists: false },
                    waitingForApproval: { $exists: false },
                    active: true
                };

                // Client System user may only impersonate users of its client
                if (req.isClientSystemUser)
                    query["memberships.client"] = req.user.memberships[0].client;

                req.user = await User.findOne(query).select("-password -avatar").exec();

                if (!req.user) {
                    res.status(401).json({
                        result: 'failed',
                        error: 'user to impersonate not found'
                    });
                    return;
                }

                req.userId = req.user._id;
            }

            req.user.isSystemUser = req.isSystemUser;
            req.user.isClientSystemUser = req.isClientSystemUser;

            if (options.needsSystemUser) {
                if (!req.isSystemUser && !req.isClientSystemUser) {
                    res.status(403).json({
                        result: "failed",
                        error: "permission denied"
                    });
                    return;
                }
            }

            // Parse the provided client Id if there is any
            // ------------------------------------------------------------------
            let requestedClientId = null;
            if (!lockedTokenClientId && requestedClient) {
                try {
                    requestedClientId = new mongoose.Types.ObjectId(requestedClient);
                } catch (err) { }
            }

            // Choose active membership to client
            // ------------------------------------------------------------------
            if (!req.user.setActiveMembership(lockedTokenClientId || requestedClientId)) {
                res.status(403).json({
                    result: 'failed',
                    error: 'no member in client'
                });
                return;
            }

            // Validate the user has the required permissions to access this resource
            // ------------------------------------------------------------------
            if (!req.user.hasPermissions(permissions, options.needsSuperAdmin)) {
                res.status(403).json({
                    result: 'failed',
                    error: 'permission denied'
                });
                return;
            }

            // Load the client details
            // ------------------------------------------------------------------
            const Client = mongoose.model('Client');
            const ClientMetrics = mongoose.model('ClientMetrics');

            const query = Client.findOne({ _id: req.user.client, deletedAt: { $exists: false } });
            let client;

            if (options.fetchClient)
                client = await query.exec();
            else
                client = await query.select("name acl currentPlan").exec()

            if (!client) {
                res.status(401).json({
                    result: 'failed',
                    error: 'requested client not found'
                });
                return;
            }

            let clientMetrics = undefined;
            if (options.fetchMetrics) {
                const clientMetricsData = await ClientMetrics.findOne({ client: client._id }).exec();
                clientMetrics = clientMetricsData.metrics;
            }

            if (options.fetchPlan) {
                const Plan = mongoose.model('Plan');
                req.plan = await Plan.findOne({ _id: client.currentPlan }).exec();
            }

            if (options.fetchClient) {
                req.client = client;
            }

            // Set some fields on the request object that we might need later
            // ------------------------------------------------------------------
            req.user.clientName = client.name;
            req.user.clientAcl = client.acl;
            req.user.clientMetrics = clientMetrics;
            req.userObjectId = new mongoose.Types.ObjectId(req.userId);

            next();
        }
        catch(err) {
            try {
                if (err.name === "JsonWebTokenError") {
                    console.error(err);
                    res.status(401).json({
                        result: 'failed',
                        error: "access token error: " + err.message
                    });
                } else {
                    console.error(err);
                    res.status(500).json({
                        result: 'failed',
                        error: "error during authentication"
                    });
                }
            }
            catch(err) { }
        }
    }
};
