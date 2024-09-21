"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

/**
 * @fileoverview NkClient class for handling API interactions with the Nukleus cloud service.
 * @module NkClient
 */

import axios from 'axios';
import WebSocket from 'isomorphic-ws';
import moment from 'moment';

import NkItemRepo from "./itemrepo.js";
import NkItemCache from './storage/itemcache';
import NkFolderCache from './storage/foldercache';
import NkThumbCache from "./storage/thumbcache";
import NkEventEmitter from "./eventemitter";
import NkUserCache from "./usercache";
import NkGroupCache from "./groupcache";
import * as pkgTools from './package';
import NkPreviewCache from "./previewcache";
import NkPublisher from "./publisher";
import NkJobManager from "./jobmanager";
import NkAssetCreator from "./assetcreator";
import eventBus from "./eventbus";
import tools from './tools'

const LONG_RUNNING_OP_THRESHOLD_MS = 1000;

/**
 * Enumeration for item visibility levels.
 * @readonly
 * @enum {number}
 */
const ItemVisibility = {
    Draft: 0,
    Private: 1,
    NotListed: 2,
    Public: 3
};

export { ItemVisibility };

/**
 * Class representing an NkClient.
 * @extends NkEventEmitter
 */
export default class NkClient extends NkEventEmitter {

    /**
     * Create an NkClient.
     * @param {Object} options - Configuration options.
     */
    constructor(options) {
        super();

        options = options || {};
        this.options = Object.assign({
            host: "auto",
            viewerHost: "auto",
            https: true,
            path: "",
            websocketPath: "/api/ws",
            wsAutoReconnect: true,
            wsAutoConnect: false,
            forcePublicApi: false,
            debug: false
        }, options);

        if (this.options.host === "auto") {
            this.options.host = "api.nukleus.cloud";
            if (typeof window === 'object' && 'location' in window) {
                if (window.location.href.includes("dev.nukleus.cloud")) {
                    this.options.host = 'api-dev.nukleus.cloud';
                } else if (window.location.href.includes("localhost")) {
                    this.options.host = 'localhost:8081';
                    this.options.https = false;
                }
            }
        }

        if (this.options.viewerHost === "auto") {
            this.options.viewerHost = "viewer.nukleus.cloud";
            if (typeof window === 'object' && 'location' in window) {
                if (window.location.href.includes("dev.nukleus.cloud")) {
                    this.options.viewerHost = "viewer-dev.nukleus.cloud";
                } else if (window.location.href.includes("localhost")) {
                    this.options.viewerHost = 'localhost:8090';
                    this.options.viewerHttps = false;
                }
            }
        }

        this.accessToken = this.options.accessToken;
        this.apiToken = this.options.apiToken;
        this.forcePublicApi = !!this.options.forcePublicApi;
        this.usePublicApi = !this.accessToken && !this.apiToken;
        this.usePersistentStorage = this.options.usePersistentStorage || true;
        this.storageSizeMib = this.options.storageSizeMib || 1024;
        this.requestClientId = this.options.requestClientId;

        this.cachedMe = null;

        this.itemRepo = new NkItemRepo(this.usePublicApi, this);
        this.itemCache = new NkItemCache(this.usePublicApi, this.usePersistentStorage, this, this.storageSizeMib);
        this.folderCache = new NkFolderCache(this);
        this.thumbCache = new NkThumbCache(this);
        this.userCache = new NkUserCache(this);
        this.groupCache = new NkGroupCache(this);
        this.previewCache = new NkPreviewCache(this);
        this.jobManager = new NkJobManager(this);
        this.eventBus = eventBus;
        this.profiler = null;

        this.webProtocol = this.options.https ? "https" : "http";
        this.restUrl = `${this.webProtocol}://${this.options.host}${this.options.path}`;

        this.wsProtocol = this.options.https ? "wss" : "ws";
        this.wsUrl = `${this.wsProtocol}://${this.options.host}${this.options.websocketPath}`;

        this.viewerProtocol = this.options.viewerHttps ? "https" : "http";
        this.viewerUrl = `${this.viewerProtocol}://${this.options.viewerHost}`;

        this.api = axios.create({
            baseURL: this.restUrl,
            json: true
        });

        this.ws = null;
        this.wsLastPing = null;

        this.setDebugMode(this.options.debug);
    }

    setDebugMode(mode) {
        this.options.debug = !!mode;

        this.eventBus.setDebugMode(this.options.debug);
    }

    /**
     * Connect to the websocket.
     * @param {boolean} force - Force reconnection if already connected.
     */
    websocketConnect(force) {
        const _this = this;

        if (this.ws) {
            if (force)
                this.websocketDisconnect();
            else {
                console.warn("Websocket is already connected!");
                return;
            }
        }

        this.ws = new WebSocket(this.wsUrl);

        this.ws.onerror = function(err) {
            console.error("Websocket error", err);
            _this.$emit('nk:client:websocketError', err);
        };

        this.ws.onopen = function() {
            _this.$emit('nk:client:websocketOpen');

            if (_this.accessToken) {
                _this.websocketSend(JSON.stringify({
                    type: "auth",
                    subscriptions: ["item", "folder", "job", "user", "notification"],
                    token: _this.accessToken
                }));
            }
        };

        this.ws.onclose = function() {
            _this.$emit('nk:client:websocketClosed');
            if (_this.options.wsAutoReconnect)
                _this.websocketConnect(true);
        };

        this.ws.onmessage = function(msg) {
            try {
                const data = JSON.parse(msg.data);

                switch (data.type) {
                    case "ping": {
                        _this.wsLastPing = new Date();
                        _this.ws.send(JSON.stringify({
                            type: "ping"
                        }));
                        break;
                    }
                    case "authenticated":
                        _this.$emit('nk:client:websocketAuthenticated');
                        break;
                    case "Item":
                    case "Folder":
                    case "Notification":
                    case "Job":
                    case "User":
                        eventBus.$emit("nk:client:elementUpdate", data);
                        break;

                    default:
                        console.warn("Unknown websocket message: ", data);
                        break;
                }
            } catch (err) {
                console.error("Websocket error:", err);
            }
        };
    }

    /**
     * Disconnect from the websocket.
     */
    websocketDisconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Send a message over the websocket.
     * @param {string} data - The message to send.
     */
    websocketSend(data) {
        if (!this.ws) {
            console.error('Websocket is not created');
            return;
        }

        this.ws.send(data);
    }

    /**
     * Get a new NkPublisher instance.
     * @returns {NkPublisher} The NkPublisher instance.
     */
    getPublisher() {
        return new NkPublisher(this);
    }

    /**
     * Get a new NkAssetCreator instance
     * @return {NkAssetCreator} The NkAssetCreator instance.
     */
    getAssetCreator() {
        return new NkAssetCreator(this);
    }

    /**
     * Get the Job Manager instance.
     * @returns {NkJobManager} The Job Manager instance.
     */
    getJobManager() {
        return this.jobManager;
    }

    /**
     * Get the Thumbnail Cache instance.
     * @returns {NkThumbCache} The Thumbnail Cache instance.
     */
    getThumbCache() {
        return this.thumbCache;
    }

    /**
     * Get the Item Cache instance.
     * @returns {NkItemCache} The Item Cache instance.
     */
    getItemCache() {
        return this.itemCache;
    }

    /**
     * Get the Item Repository instance.
     * @returns {NkItemRepo} The Item Repository instance.
     */
    getItemRepo() {
        return this.itemRepo;
    }

    /**
     * Get the visibility of the root item.
     * @returns {number} The visibility level.
     */
    getRootVisibility() {
        return this.itemRepo.activeItem ? this.itemRepo.activeItem.visibility : ItemVisibility.Private;
    }

    /**
     * Get the Event Bus instance.
     * @returns {Object} The Event Bus instance.
     */
    getEventBus() {
        return this.eventBus;
    }

    /**
     * Set the force public API option.
     * @param {boolean} value - The value to set.
     */
    setForcePublicApi(value) {
        this.forcePublicApi = value;
        this._updateUsePublicApi();
    }

    /**
     * Update the use of the public API based on the current configuration.
     * @private
     */
    _updateUsePublicApi() {
        this.usePublicApi = this.forcePublicApi || (!this.apiToken && !this.accessToken);
        this.itemRepo.usePublicApi = this.usePublicApi;
        this.itemCache.usePublicApi = this.usePublicApi;
    }

    /**
     * Set the API token.
     * @param {string} token - The API token.
     */
    setApiToken(token) {
        this.apiToken = token;
        this._updateUsePublicApi();
    }

    /**
     * Set the access token.
     * @param {string} token - The access token.
     */
    setAccessToken(token) {
        this.accessToken = token;
        this._updateUsePublicApi();
        if (this.accessToken && this.options.wsAutoConnect) {
            this.websocketConnect();
        }
    }

    /**
     * Get the API token.
     * @returns {string} The API token.
     */
    getApiToken() {
        return this.apiToken;
    }

    /**
     * Get the access token.
     * @returns {string} The access token.
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Update the base URL.
     * @param {string} host - The new host.
     */
    updateBaseUrl(host) {
        this.options.host = host;

        this.webProtocol = this.options.https ? "https" : "http";
        const restUrl = `${this.webProtocol}://${this.options.host}${this.options.path}`;
        this.setApiBaseUrl(restUrl);

        this.wsProtocol = this.options.https ? "wss" : "ws";
        const wsUrl = `${this.wsProtocol}://${this.options.host}${this.options.websocketPath}`;
        this.setWsBaseUrl(wsUrl);
    }

    /**
     * Set the API base URL.
     * @param {string} url - The new API base URL.
     */
    setApiBaseUrl(url) {
        this.restUrl = url;
        this.api = axios.create({
            baseURL: this.restUrl,
            json: true
        });
    }

    /**
     * Set the WebSocket base URL.
     * @param {string} url - The new WebSocket base URL.
     */
    setWsBaseUrl(url) {
        this.wsUrl = url;
        if (this.accessToken && this.options.wsAutoConnect) {
            this.websocketDisconnect();
            this.websocketConnect();
        }
    }

    /**
     * Set the request client ID.
     * @param {string} id - The client ID.
     */
    setRequestClientId(id) {
        this.requestClientId = id;
    }

    /**
     * Get the API base URL.
     * @returns {string} The API base URL.
     */
    getApiBaseUrl() {
        return this.restUrl;
    }

    /**
     * Get the WebSocket base URL.
     * @returns {string} The WebSocket base URL.
     */
    getWsBaseUrl() {
        return this.wsUrl;
    }

    /**
     * Get the viewer base URL.
     * @returns {string} The viewer base URL.
     */
    getViewerBaseUrl() {
        return this.viewerUrl;
    }

    /**
     * Set the profiler.
     * @param {Object} profiler - The profiler instance.
     * @throws {Error} If the profiler does not provide a start function.
     */
    setProfiler(profiler) {
        if (!profiler || typeof profiler.start !== 'function')
            throw new Error("Profiler needs to be an object providing a start function.");

        this.profiler = profiler;
    }

    /**
     * Logs in a user using two-factor authentication.
     *
     * @param {string} account - The account identifier (username or email).
     * @param {string} password - The account password.
     * @param {string} client - The client identifier.
     * @returns {Promise<Object>} - A promise that resolves to the server's response.
     */
    async login2FA(account, password, client) {
        return this.execute('post', '/api/auth/login2fa', { account, password, client });
    }

    /**
     * Confirms the two-factor authentication code for a user.
     *
     * @param {string} account - The account identifier (username or email).
     * @param {string} code - The 2FA code.
     * @returns {Promise<Object>} - A promise that resolves to the server's response.
     */
    async confirm2FA(account, code) {
        return this.execute('post', '/api/auth/confirm2fa', { account, code });
    }

    /**
     * Checks if the user is authenticated.
     *
     * @returns {boolean} - True if the user is authenticated, false otherwise.
     */
    isAuthenticated() {
        return !!this.accessToken || !!this.apiToken;
    }

    /**
     * Checks if a feature is enabled. For this to work, cachedMe must be filled so at least one
     * call to me() must have been made.
     * @param feature
     */
    isFeatureEnabled(feature) {
        if (!this.cachedMe) {
            console.error("Call to isFeatureEnabled() before user data was requested with me().");
            return false;
        }

        return this.cachedMe.features.includes(feature);
    }

    /**
     * Resolves the user or group information for a given item.
     *
     * @param {Object} item - The item containing user or group information.
     * @param {string} item.quotaUser - The user quota identifier.
     * @param {string} item.quotaGroup - The group quota identifier.
     * @param {string} item.createdBy - The identifier of the user who created the item.
     * @returns {Promise<Object>} - A promise that resolves to an object containing the resolved user or group information.
     */
    async resolveUserOrGroupInfoForItem(item) {
        if (item.quotaUser) {
            return this.userCache.resolve(item.quotaUser);
        } else if (item.quotaGroup) {
            return this.groupCache.resolve(item.quotaGroup);
        } else if (item.createdBy) {
            return this.userCache.resolve(item.createdBy);
        } else {
            return {
                name: "?",
                initials: "?",
                avatar: null
            };
        }
    }

    /**
     * Start an operation that is being monitored for its running time. If it runs too long, events will be produced.
     * @param name
     * @return {{runningMs: number, name, startTimeMs: DOMHighResTimeStamp, finish: op.finish, reportProgress: op.reportProgress, percent: number}}
     * @private
     */
    _startOp(name) {
        const _this = this;
        const op = {
            id: tools.createGUID(),
            name: name,
            startTimeMs: performance.now(),
            runningMs: 0,
            percent: 0,
            reportProgress: function(percent) {
                op.percent = percent;
            },
            finish: function() {
                clearInterval(op.interval);
                if (op.runningMs > LONG_RUNNING_OP_THRESHOLD_MS) {
                    try {
                        _this.$emit('nk:client:longRunningOpFinished', op.id);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        function intervalFunc() {
            op.runningMs = performance.now() - op.startTimeMs;
            if (op.runningMs > LONG_RUNNING_OP_THRESHOLD_MS) {
                try {
                    _this.$emit('nk:client:longRunningOp', op.id, op.name, op.percent);
                }
                catch(err) {
                    console.error(err);
                }
            }
        }

        op.interval = setInterval(intervalFunc, 100);
        return op;
    }

    /**
     * Execute an API request.
     * @param {string} method - HTTP method.
     * @param {string} resource - API resource path.
     * @param {Object} [data] - Request payload.
     * @param {Object} [options] - Options object
     * @param {string} [options.responseType] - Response type.
     * @param {boolean} [options.withNext] - Include pagination cursor.
     * @param {Function} [options.progressCallback] - Upload progress callback.
     * @param {string} [options.emitOnSuccess] - Event to emit on success
     * @param {AbortController} [options.controller] - Abort controller for the request.
     * @returns {Promise<Object>} The response data.
     */
    async execute(method, resource, data, options) {
        let _this = this;
        let headers = {};

        options = options || {};

        if (data && typeof data.getHeaders === 'function')
            headers = data.getHeaders();

        if (this.accessToken) {
            headers['x-access-token'] = this.accessToken;
        }

        if (this.apiToken) {
            headers['x-api-token'] = this.apiToken;
        }

        if (this.requestClientId) {
            headers['x-request-client'] = this.requestClientId;
        }

        const profilerTask = this.profiler ? this.profiler.start('NkClient', `${method} ${resource}`) : null;

        const op = this._startOp(options.opName || `${method} ${resource}`);

        return this.api({
            method,
            url: resource,
            data,
            responseType: options.responseType,
            headers: headers,
            signal: options.controller ? options.controller.signal : undefined,
            onUploadProgress: function (progressEvent) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                op.reportProgress(percentCompleted);
                _this.$emit('nk:client:progress', { type: "upload", percent: percentCompleted });
                if (typeof options.progressCallback === 'function') {
                    options.progressCallback(percentCompleted, progressEvent.loaded, progressEvent.total);
                }
            },

            onDownloadProgress: function (progressEvent) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                op.reportProgress(percentCompleted);
                _this.$emit('nk:client:progress', { type: "download", percent: percentCompleted });
                if (typeof options.progressCallback === 'function') {
                    options.progressCallback(percentCompleted, progressEvent.loaded, progressEvent.total);
                }
            },
        }).then(res => {

            if (profilerTask)
                profilerTask.done();

            op.finish();

            // We have a response. Set progress to "done"
            // ----------------------------------------------------------
            _this.$emit('nk:client:progress', { type: 'done' });

            // Check if we have a json response or a binary response
            // ----------------------------------------------------------
            if (res.headers["content-type"].startsWith("application/json")) {

                // Check if our request was successful, if so, return the result
                // ----------------------------------------------------------
                if (res.data.result === 'success') {

                    let result;

                    if (options.withNext) {
                        result = {
                            data: res.data.data,
                            next: res.data.next
                        };
                    } else {
                        result = res.data.data;
                    }

                    if (options.emitOnSuccess)
                        this.eventBus.$emit(options.emitOnSuccess, result);

                    return result;
                } else {
                    // Result is either a redirect or an error
                    // ----------------------------------------------------------
                    if (res.data.redirect) {
                        this.$emit('nk:client:redirect', res.data.redirect);
                    }

                    if (res.data.error)
                        throw res.data.error;
                    else
                        throw "API response seems to be json but does not contain result type!";
                }
            } else {

                if (options.emitOnSuccess)
                    this.eventBus.$emit(options.emitOnSuccess);

                // Result is a binary download. Return a blob
                // ----------------------------------------------------------
                return {
                    blob: new Blob([res.data], {
                        type: res.headers["content-type"]
                    }),
                    hash: res.headers["sha256-hash"],
                    itemName: res.headers["nukleus-itemname"],
                    itemType: res.headers["nukleus-itemtype"],
                    mimeType: res.headers["content-type"]
                };
            }
        }).catch(error => {

            if (profilerTask)
                profilerTask.done();

            op.finish();

            _this.$emit('nk:client:progress', { type: 'done' });

            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                if (error.response.status === 401) {
                    this.$emit('nk:client:unauthorized');
                    console.log(error);
                    throw "Access denied. Please login again."
                }

                if (error.response.data && error.response.data.error) {
                    throw error.response.data.error;
                }
            }

            throw error;
        });
    }

    /**
     * Create a FormData instance from a buffer or file.
     * @param {Buffer|Blob} data - The file data
     * @param {string} filename - The filename.
     * @returns {FormData} The FormData instance.
     * @private
     */
    _createFormData(data, filename) {
        const formData = new FormData();
        if (typeof File === 'function' && data instanceof Blob) {
            formData.append('file', data);
        } else if (global.Buffer && global.Buffer.isBuffer(data)) {
            formData.append('file', data, filename);
        } else {
            const blob = new Blob([data]);
            formData.append('file', blob, filename);
        }
        return formData;
    }

    // Authentication
    // ----------------------------------------------------------------------------

    /**
     * Get the current user details.
     * @returns {Promise<Object>} The user details.
     */
    async me(useFromCache) {
        if (useFromCache && this.cachedMe)
            return this.cachedMe;

        this.cachedMe = await this.execute('get', '/api/auth/me');
        return this.cachedMe;
    }

    /**
     * Get the home folder.
     * @returns {Promise<Object>} The home folder details.
     */
    async getHomeFolder() {
        return this.execute('get', '/api/auth/homefolder');
    }

    /**
     * Get the list of clients for the current user.
     * @returns {Promise<Array>} The list of clients.
     */
    async myClients() {
        return this.execute('get', '/api/auth/myclients');
    }

    /**
     * Register a new user.
     * @param {Object} data - The registration data.
     * @returns {Promise<Object>} The registration response.
     */
    async register(data) {
        return this.execute('post', '/api/auth/register', data);
    }

    /**
     * Delete the current user account.
     * @param {string} password - The password for confirmation.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteMyAccount(password) {
        return this.execute('post', '/api/auth/deletemyaccount', { password: password });
    }

    /**
     * Confirm the user's email.
     * @param {string} token - The email confirmation token.
     * @returns {Promise<Object>} The confirmation response.
     */
    async confirmEmail(token) {
        return this.execute('get', '/api/auth/confirmemail/' + token);
    }

    /**
     * Confirm the change of email.
     * @param {string} token - The email change confirmation token.
     * @returns {Promise<Object>} The confirmation response.
     */
    async confirmEmailChange(token) {
        return this.execute('get', '/api/auth/confirmchangedemail/' + token);
    }

    /**
     * Request a password reset.
     * @param {string} email - The user's email.
     * @param {string} [optionalClientId] - Optional client ID.
     * @returns {Promise<Object>} The request response.
     */
    async forgotPassword(email, optionalClientId) {
        return this.execute('post', '/api/auth/forgotpassword', { account: email, client: optionalClientId });
    }

    /**
     * Set a new password using a token.
     * @param {string} token - The password reset token.
     * @param {string} password - The new password.
     * @returns {Promise<Object>} The reset response.
     */
    async setNewPassword(token, password) {
        return this.execute('post', '/api/auth/setnewpassword', { token: token, password: password });
    }

    /**
     * Check if an account exists.
     * @param {Object} data - The account data.
     * @param {string} data.account - The account name
     * @returns {Promise<Object>} The account existence response.
     */
    async accountExists(data) {
        return this.execute('post', '/api/auth/accountExists', data);
    }

    // Items
    // ----------------------------------------------------------------------------

    /**
     * Get items in a folder.
     * @param {string} folderId - The folder ID.
     * @param {boolean} [forceReload] - Forces the reload of the data, so no cached data is used
     * @returns {Promise<Array>} The list of items.
     */
    async getItemsInFolderList(folderId, forceReload) {
        // Only try to get cached items if we have a folderId, i.e. if it's not the root folder.
        if (folderId && !forceReload) {
            const cachedItems = await this.folderCache.getItemListing(folderId);
            if (cachedItems) {
                return cachedItems;
            }
        }

        const response = await this.execute('get', '/api/item/infolder/' + (folderId ? folderId : "0"));
        await this.folderCache.addItemListing(folderId, response);

        return response;
    }

    /**
     * Get an item by ID.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The item details.
     */
    async getItem(id) {
        return this.execute('get', '/api/item/' + id);
    }

    /**
     * Get aggregated item data, using public or authenticated API based on configuration.
     * @param {string} id - The item ID.
     * @param {Object} [options] - Query options.
     * @returns {Promise<Object>} The aggregated item data.
     */
    getItemAggregatedPOP(id, options) {
        if (this.usePublicApi) {
            return this.getItemPublicAggregated(id, options);
        } else {
            return this.getItemAggregated(id, options);
        }
    }

    /**
     * Get aggregated item data from the public API.
     * @param {string} id - The item ID.
     * @param {Object} [options] - Query options.
     * @returns {Promise<Object>} The aggregated item data.
     */
    async getItemPublicAggregated(id, options) {
        const cachedItem = pkgTools.getItemFromCache(id);

        if (cachedItem) {
            return cachedItem;
        }

        let query = [];

        if (options) {
            if (options.withFieldInstances) {
                query.push("withFieldInstances");
            }
            if (options.withAttachmentInfo) {
                query.push("withAttachmentInfo");
            }
            if (options.noAttributes) {
                query.push("noAttributes");
            }
            if (options.noUserAttributes) {
                query.push("noUserAttributes");
            }
            if (options.noFields) {
                query.push("noFields");
            }
            if (options.noThumbnails) {
                query.push("noThumbnails");
            }
            if (options.noLinks) {
                query.push("noLinks");
            }
        }

        if (query.length)
            query = `?${query.join("&")}`;

        if (pkgTools.getItemFromCache(id)) {
            return pkgTools.getItemFromCache(id);
        }

        return this.execute('get', '/api/item/publicaggregate/' + id + query);
    }

    /**
     * Get aggregated item data from the authenticated API.
     * @param {string} id - The item ID.
     * @param {Object} [options] - Query options.
     * @param {boolean} [options.withFieldInstances] - Return field instances
     * @param {boolean} [options.withAttachmentInfo] - Return attachment information
     * @param {boolean} [options.noAttributes] - Return no attributes
     * @param {boolean} [options.noUserAttributes] - Return no user attributes
     * @param {boolean} [options.noFields] - Return no field data
     * @param {boolean} [options.noThumbnails] - Return no thumbnail data
     * @param {boolean} [options.noLinks] - Return no link data
     * @returns {Promise<Object>} The aggregated item data.
     */
    async getItemAggregated(id, options) {
        const cachedItem = pkgTools.getItemFromCache(id);

        if (cachedItem) {
            return cachedItem;
        }

        let query = [];

        if (options) {
            if (options.withFieldInstances) {
                query.push("withFieldInstances");
            }
            if (options.withAttachmentInfo) {
                query.push("withAttachmentInfo");
            }
            if (options.noAttributes) {
                query.push("noAttributes");
            }
            if (options.noUserAttributes) {
                query.push("noUserAttributes");
            }
            if (options.noFields) {
                query.push("noFields");
            }
            if (options.noThumbnails) {
                query.push("noThumbnails");
            }
            if (options.noLinks) {
                query.push("noLinks");
            }
        }

        if (query.length)
            query = `?${query.join("&")}`;

        if (pkgTools.getItemFromCache(id)) {
            return pkgTools.getItemFromCache(id);
        }

        return this.execute('get', `/api/item/aggregate/${id}${query}`);
    }

    /**
     * Get recursively aggregated item data.
     * @param {string} id - The item ID.
     * @param {Object} [options] - Query options.
     * @param {boolean} [options.withFieldInstances] - Return field instances
     * @param {boolean} [options.withAttachmentInfo] - Return attachment information
     * @param {boolean} [options.noAttributes] - Return no attributes
     * @param {boolean} [options.noUserAttributes] - Return no user attributes
     * @param {boolean} [options.noFields] - Return no field data
     * @param {boolean} [options.noThumbnails] - Return no thumbnail data
     * @returns {Promise<Object>} The recursively aggregated item data.
     */
    async getItemAggregatedRecursive(id, options) {
        let query = [];

        if (options) {
            if (options.withFieldInstances) {
                query.push("withFieldInstances");
            }
            if (options.withAttachmentInfo) {
                query.push("withAttachmentInfo");
            }
            if (options.noAttributes) {
                query.push("noAttributes");
            }
            if (options.noUserAttributes) {
                query.push("noUserAttributes");
            }
            if (options.noFields) {
                query.push("noFields");
            }
            if (options.noThumbnails) {
                query.push("noThumbnails");
            }
        }

        if (query.length)
            query = `?${query.join("&")}`;

        return this.execute('get', `/api/item/aggregaterecursive/${id}${query}`);
    }

    /**
     * Get recursively aggregated public item data.
     * @param {string} id - The item ID.
     * @param {boolean} [withFeatures] - Include features.
     * @returns {Promise<Object>} The recursively aggregated public item data.
     */
    async getItemPublicRecursive(id, withFeatures) {
        return this.execute('get', '/api/item/publicrecursive/' + id + (withFeatures ? "?withFeatures" : ""));
    }

    /**
     * Get public item data.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The public item data.
     */
    async getItemPublic(id) {
        return this.execute('get', '/api/item/public/' + id);
    }

    /**
     * Get item history.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The item history.
     */
    async getItemHistory(id) {
        return this.execute('get', '/api/item/history/' + id);
    }

    /**
     * Create a new item.
     * @param {Object} data - The item data.
     * @param {string} data.type - The type of the item. For example "Image", "Mesh", "Material", etc.
     * @param {string} data.name - The name of the item
     * @param {string} data.folder - The folder ID of the item or null/undefined if it should be in the root folder
     * @param {string} [data.itemTemplate] - Item template to use, if any
     * @param {Object} [data.version] - Version of the item, has to be an object. Example: { major: 0, minor: 0, revision: 1}
     * @param {ItemVisibility} [data.visibility] - Visibility of the object. Default is Private
     * @param {boolean} [data.allowConversation] - True, if this item should allow conversations
     * @param {boolean} [data.fixNameCollisions] - Fix name collisions. If the item name exists already, an index will be appended
     * @param {string} [data.client] - Client ID for the item. Default client will be used if omitted
     * @param {string} [data.userAttributeTemplate] - User attribute templated to be used
     * @returns {Promise<String>} The created item ID.
     */
    async createItem(data) {
        return this.execute('post', '/api/item', data);
    }

    /**
     * Update an existing item.
     * @param {Object} data - The item data.
     * @returns {Promise<Object>} The updated item.
     */
    async updateItem(data) {
        return this.execute('put', '/api/item', data);
    }

    /**
     * Delete an item by ID.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteItem(id) {
        return this.execute('delete', '/api/item', { id: id });
    }

    /**
     * Rename item
     * @param {string} id - The item ID.
     * @param {string} name - The new item name.
     * @returns {Promise<Object>} The updated item.
     */
    async renameItem(id, name) {
        return this.updateItem({_id: id, name});
    }

    /**
     * Query public items list.
     * @param {Object} query - The query parameters.
     * @returns {Promise<Array>} The list of items.
     */
    async queryPublicItemsList(query) {
        return this.execute('post', '/api/item/publicquery', query);
    }

    /**
     * Query items list, using public or authenticated API based on configuration.
     * @param {Object} query - The query parameters.
     * @returns {Promise<Array>} The list of items.
     */
    async queryItemsListPOP(query) {
        if (this.usePublicApi) {
            return this.queryPublicItemsList(query);
        } else {
            return this.queryItemsList(query);
        }
    }

    /**
     * Query items list.
     * @param {Object} query - The query parameters.
     * @returns {Promise<Array>} The list of items.
     */
    async queryItemsList(query) {
        return this.execute('post', '/api/item/query', query);
    }

    /**
     * Query items list and export as Excel.
     * @param {Object} query - The query parameters.
     */
    async queryItemsListAsExcel(query) {
        query.exportAsExcel = true;
        const response = await this.execute('post', '/api/item/query', query, "arraybuffer");
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'export.xlsx');
        link.click();
    }

    /**
     * Move items to a different folder.
     * @param {Object} data - The move data.
     * @param {Array<string>} data.items - An array of item IDs
     * @param {string} [data.dest] - The destination folder. If omitted, the destination folder is the root folder
     * @returns {Promise<number>} The amount of moved items
     */
    async moveItems(data) {
        return this.execute('post', '/api/item/move', data);
    }

    /**
     * Download an item by ID.
     * @param {string} id - The item ID.
     * @param {Function} [progressCallback] - Download progress callback.
     * @returns {Promise<Blob>} The downloaded item.
     */
    async downloadItem(id, progressCallback) {
        const cachedFile = pkgTools.getFileFromCache(id);

        if (cachedFile) {
            return cachedFile;
        } else {
            return this.execute('get', `/api/item/download/${id}`, null, {
                responseType: "arraybuffer",
                progressCallback: progressCallback,
                opName: `Downloading item ${id}`
            });
        }
    }

    /**
     * Download a public item by ID.
     * @param {string} id - The item ID.
     * @param {Function} [loadingProgressFunc] - Download progress callback.
     * @returns {Promise<Blob>} The downloaded item.
     */
    async publicDownloadItem(id, loadingProgressFunc) {
        const cachedFile = pkgTools.getFileFromCache(id);

        if (cachedFile) {
            return cachedFile;
        } else {
            return this.execute('get', `/api/item/publicdownload/${id}`, null, {
                responseType: "arraybuffer",
                progressCallback: loadingProgressFunc
            });
        }
    }

    /**
     * Get the hash of an item by ID.
     * @param {string} id - The item ID.
     * @returns {Promise<string>} The item hash.
     */
    async getItemHash(id) {
        const cachedItem = pkgTools.getItemFromCache(id);

        if (cachedItem) {
            return cachedItem.hash;
        } else {
            return this.execute('get', `/api/item/hash/${id}`);
        }
    }

    /**
     * Request a secure download for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The request response.
     */
    async requestSecureDownload(id) {
        return this.execute('get', '/api/item/requestsecuredownload/' + id);
    }

    /**
     * Get a thumbnail for an item.
     * @param {string} size - The thumbnail size.
     * @param {string} id - The item ID.
     * @returns {Promise<Blob>} The thumbnail.
     */
    async getThumbnail(size, id) {
        return this.execute('get',  `/api/item/thumbnail/${size}/${id}`);
    }

    /**
     * Get a public thumbnail for an item.
     * @param {string} size - The thumbnail size.
     * @param {string} id - The item ID.
     * @returns {Promise<Blob>} The thumbnail.
     */
    async getPublicThumbnail(size, id) {
        return this.execute('get',  `/api/item/publicthumbnail/${size}/${id}`);
    }

    /**
     * Make an item public.
     * @param {string} id - The item ID.
     * @param {boolean} recursive - Apply to sub-items.
     * @param {boolean} inSubfolders - Apply to items in subfolders.
     * @returns {Promise<Object>} The response.
     */
    async makeItemPublic(id, recursive, inSubfolders) {
        return this.execute('put', '/api/item/makepublic', { id: id, recursive: recursive, inSubfolders: inSubfolders });
    }

    /**
     * Make an item private.
     * @param {string} id - The item ID.
     * @param {boolean} recursive - Apply to sub-items.
     * @param {boolean} inSubfolders - Apply to items in subfolders.
     * @returns {Promise<Object>} The response.
     */
    async makeItemPrivate(id, recursive, inSubfolders) {
        return this.execute('put', '/api/item/makeprivate', { id: id, recursive: recursive, inSubfolders: inSubfolders });
    }

    /**
     * Generate thumbnails for an item.
     * @param {string} id - The item ID.
     * @param {Buffer|File} buffer - The image buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async generateThumbnails(id, buffer) {
        const formData = this._createFormData(buffer, "screenshot.jpg");
        return this.execute('post', `/api/item/generateThumbnails/${id}`, formData);
    }

    /**
     * Generate LOD (Level of Detail) levels for an item.
     * @param {string} id - The item ID.
     * @param {Buffer|File} buffer - The image buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async generateLodLevels(id, buffer) {
        const formData = this._createFormData(buffer, "screenshot.jpg");
        return this.execute('post', `/api/item/generateLodLevels/${id}`, formData);
    }

    /**
     * Omit LOD generation for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async omitLodGeneration(id) {
        return this.execute('get', `/api/item/omitLodGeneration/${id}`);
    }

    /**
     * Upload a file and create a new item.
     * @param {string} folderId - The folder ID.
     * @param {Buffer|Blob} data - The file data
     * @param {string} filename - The filename.
     * @param {Object} [options] - Options for the item
     * @param {number} [options.autoDestructIn] - Auto-destruct time in minutes.
     * @param {ItemVisibility} [options.visibility] - Visibility of the object. Default is Private
     * @param {Function} [progressCallback] - Upload progress callback.
     * @param {AbortController} [controller] - Abort controller for the request.
     * @returns {Promise<Object>} The created item.
     */
    async uploadAndCreate(folderId, data, filename, options, progressCallback, controller) {
        const formData = this._createFormData(data, filename);
        let url = `/api/item/uploadAndCreate/${folderId}`;

        if (options) {
            if (typeof options === 'object') {
                if (options.autoDestructIn)
                    url += "?autoDestructIn=" + options.autoDestructIn;
                else if (options.visibility)
                    url += "?visibility=" + options.visibility;
            }
            else  {
                url += "?autoDestructIn=" + options;
            }
        }

        return this.execute('post', url, formData, {
            progressCallback: progressCallback,
            controller: controller
        });
    }

    /**
     * Upload a file to an existing item.
     * @param {string} itemId - The item ID.
     * @param {Buffer|File} bufferOrFile - The file buffer or file.
     * @param {string} filename - The filename.
     * @param {Function} [progressCallback] - Upload progress callback.
     * @param {AbortController} [controller] - Abort controller for the request.
     * @returns {Promise<Object>} The response.
     */
    async upload(itemId, bufferOrFile, filename, progressCallback, controller) {
        const formData = this._createFormData(bufferOrFile, filename);
        return this.execute('post', `/api/item/upload/${itemId}`, formData,{
            progressCallback: progressCallback,
            controller: controller
        });
    }

    /**
     * Clear the thumbnail for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async clearThumbnail(id) {
        return this.execute('get', `/api/item/clearThumbnail/${id}`);
    }

    /**
     * Reset the thumbnail for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async resetThumbnail(id) {
        return this.execute('get', `/api/item/resetThumbnail/${id}`);
    }

    /**
     * Download an attachment of an item.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @param {Function} [progressCallback] - Download progress callback.
     * @returns {Promise<Blob>} The downloaded attachment.
     */
    async downloadAttachmentPOP(id, name, index, progressCallback) {
        if (this.usePublicApi) {
            return this.downloadPublicAttachment(id, name, index, progressCallback);
        } else {
            return this.downloadAttachment(id, name, index, progressCallback);
        }
    }

    /**
     * Download a public attachment of an item.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @param {Function} [progressCallback] - Download progress callback.
     * @returns {Promise<Blob>} The downloaded attachment.
     */
    async downloadPublicAttachment(id, name, index, progressCallback) {
        return this.execute('get', `/api/item/publicattachment/${id}/${name}/${index}`, null, {
            responseType: "arraybuffer",
            progressCallback: progressCallback
        });
    }

    /**
     * Download an attachment of an item.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @param {Function} [progressCallback] - Download progress callback.
     * @returns {Promise<Blob>} The downloaded attachment.
     */
    async downloadAttachment(id, name, index, progressCallback) {
        return this.execute('get', `/api/item/attachment/${id}/${name}/${index}`, null, {
            responseType: "arraybuffer",
            progressCallback: progressCallback
        });
    }

    /**
     * Upload an attachment to an item.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @param {Buffer|File} buffer - The file buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async uploadAttachment(id, name, index, buffer) {
        const formData = this._createFormData(buffer, "screenshot.jpg");
        return this.execute('post', `/api/item/attachment/${id}/${name}/${index}`, formData);
    }

    /**
     * Generate thumbnails and previews for an item.
     * @param {string} id - The item ID.
     * @param {Buffer|File} buffer - The image buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async generateThumbnailsAndPreviews(id, buffer) {
        const formData = this._createFormData(buffer, "screenshot.jpg");
        return this.execute('post', `/api/item/generateThumbnailsAndPreviews/${id}`, formData);
    }

    /**
     * Get client information for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The client information.
     */
    async getItemClient(id) {
        return this.execute('get', `/api/item/getClient/${id}`);
    }

    /**
     * Get ACL (Access Control List) for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The item ACL.
     */
    async getItemAcl(id) {
        return this.execute('get', `/api/item/acl/${id}`);
    }

    /**
     * Get items linking to a specified item.
     * @param {string} id - The item ID.
     * @returns {Promise<Array>} The list of linking items.
     */
    async getItemsLinking(id) {
        return this.execute('get', `/api/item/linking/${id}`);
    }

    /**
     * Set attributes for a list of items.
     * @param {Array<string>} idList - The list of item IDs.
     * @param {Object} attributes - The attributes to set.
     * @returns {Promise<Object>} The response.
     */
    async setAttributes(idList, attributes) {
        return this.execute('put', `/api/item/setAttributes`, {
            id: idList,
            attributes: attributes
        });
    }

    /**
     * Get the item sync list since a specified date.
     * @param {Date} date - The sync date.
     * @returns {Promise<Array>} The sync list.
     */
    async getItemSyncList(date) {
        const datestr = moment(date).format('YYYYMMDDHHmmss');
        return this.execute('get', `/api/item/synclist/${datestr}`);
    }

    /**
     * Increase views count for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async increaseViews(id) {
        return this.execute('get', `/api/item/increaseViews/${id}`);
    }

    /**
     * Get the views count for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<number>} The views count.
     */
    async getViews(id) {
        return this.execute('get', `/api/item/views/${id}`);
    }

    /**
     * Get public item counts.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The public item counts.
     */
    async getPublicItemCounts(id) {
        return this.execute('get', `/api/item/publiccounts/${id}`);
    }

    /**
     * Get item counts.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The item counts.
     */
    async getItemCounts(id) {
        return this.execute('get', `/api/item/counts/${id}`);
    }

    /**
     * Like an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async likeItem(id) {
        return this.execute('get', `/api/item/like/${id}`);
    }

    /**
     * Unlike an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async unlikeItem(id) {
        return this.execute('get', `/api/item/unlike/${id}`);
    }

    /**
     * Check if the current user likes an item.
     * @param {string} id - The item ID.
     * @returns {Promise<boolean>} Whether the user likes the item.
     */
    async doILike(id) {
        return this.execute('get', `/api/item/doILike/${id}`);
    }

    /**
     * Set auto-destruct date for an item.
     * @param {string} id - The item ID.
     * @param {Date} date - The auto-destruct date.
     * @returns {Promise<Object>} The response.
     */
    async setItemAutoDestruct(id, date) {
        const datestr = moment(date).format('YYYYMMDDHHmmss');
        return this.execute('get', `/api/item/setAutoDestruct/${id}/${datestr}`);
    }

    /**
     * Clear auto-destruct date for an item.
     * @param {string} id - The item ID.
     * @returns {Promise<Object>} The response.
     */
    async clearItemAutoDestruct(id) {
        return this.execute('get', `/api/item/clearAutoDestruct/${id}`);
    }

    /**
     * Resolve relative item path.
     * @param {string} id - The item ID.
     * @param {string} path - The relative path.
     * @returns {Promise<string>} The resolved item ID.
     */
    async resolveRelativeItem(id, path) {
        const cachedItem = pkgTools.getItemFromCache(id);
        if (cachedItem) {
            const folders = path.split("/");
            const itemToSearch = folders.pop();

            let parentID = cachedItem.folder._id;
            for (const folderName of folders) {
                // We need to find a folder that is in parentID and has the name folderName
                let found = false;
                for (const [id, folder] of Object.entries(pkgTools.getFolders())) {
                    if (folder.parent === parentID && folder.name === folderName) {
                        parentID = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    break;
                }
            }

            // We need to find an item that is in parentID and has the name item
            for (const [id, item] of Object.entries(pkgTools.getItems())) {
                if (item.folder._id === parentID && item.name === itemToSearch) {
                    return item._id;
                }
            }
        } else {
            return this.execute('post', '/api/item/resolve/' + id, { path: path });
        }
    }

    /**
     * Resolve public relative item path.
     * @param {string} id - The item ID.
     * @param {string} path - The relative path.
     * @returns {Promise<string>} The resolved item ID.
     */
    async publicResolveRelativeItem(id, path) {
        const cachedItem = pkgTools.getItemFromCache(id);
        if (!cachedItem) {
            return this.execute('post', '/api/item/publicResolve/' + id, { path: path });
        } else {
            const parts = path.split('/');
            const itemName = parts.pop()

            let currentFolder = pkgTools.getFolder(cachedItem.folder._id);

            for (const part of parts) {
                if (part === "..") {
                    currentFolder = pkgTools.getFolder(currentFolder.parent);
                } else {
                    currentFolder = pkgTools.findFolder(part, currentFolder._id);
                }
            }

            const item =  pkgTools.findItem(itemName, currentFolder._id);
            return item._id;
        }
    }

    /**
     * Rewire one or more items, also setting attributes
     * @param {Array<Object>} items - Array of objects, containing { _id: "itemId", links: [ { to: "itemId", usage: "<usage>"} ], attributes: { ... }}
     * @return {Promise<void>}
     */
    async rewireItems(items) {
        return this.execute('post', '/api/item/rewire', { items: items });
    }

    // Folders
    // ----------------------------------------------------------------------------

    /**
     * Get a folder by ID.
     * @param {string} id - The folder ID.
     * @returns {Promise<Object>} The folder details.
     */
    async getFolder(id) {
        return this.execute('get', '/api/folder/' + id);
    }

    /**
     * Get folders in a folder.
     * @param {string} [parentId] - The parent folder ID.
     * @param {Object} [options] - Options object
     * @param {boolean} [options.resolveNames] - Resolve names of folders.
     * @param {string} [options.folderAsItemType] - Fetch folders as items of a specific type.
     * @param {string} [options.folderAsItemName] - Fetch folders as items of a specific name.
     * @returns {Promise<Array>} The list of folders.
     */
    async getFoldersInFolderList(parentId, options) {
        parentId = parentId || "0";
        options = options || {};

        let queryParams = []
        let cachedFolder, lastUpdatedAt = "";
        // We only want to return cached responses when the arguments are resolveNames=true and folderAsItemType=false.
        // This way we don't need to worry about modifying the cached data into the correct format.
        if (options.resolveNames && !options.folderAsItemType && parentId !== "0") {
            cachedFolder = await this.folderCache.getFolderListing(parentId);

            // The cached folder is only valid for 10 seconds after it was cached.
            if (cachedFolder && Date.now() - new Date(cachedFolder.cachedAt).getTime() < 10000) {
                return cachedFolder;
            }

            // If we have a cached folder and if it has a parent, we can use the updatedAt timestamp to only fetch the status if possible.
            if (cachedFolder && cachedFolder.parent)
                queryParams.push(`lastUpdatedAt=${cachedFolder.parent.updatedAt}`);
        }

        if (options.resolveNames)
            queryParams.push('resolve');

        if (options.folderAsItemType)
            queryParams.push(`folderAsItemType=${options.folderAsItemType}`);

        if (options.folderAsItemName)
            queryParams.push(`folderAsItemName=${options.folderAsItemName}`);

        let query = "";
        if (queryParams.length)
            query = "?" + queryParams.join('&');

        const response = await this.execute('get', `/api/folder/infolder/${parentId}${query}`);

        // If the folder was not modified since the last time we fetched it, we can return the cached folder.
        if (response.notModified === true) {
            return cachedFolder;
        } else if (!options.resolveNames || options.folderAsItemType) {
            // We don't cache the response when not resolving names or when
            // fetching folders as items, so we just return the response directly.
            return response;
        } else {
            // If the folder was modified, we also need to update the ACLs of the folder and its children.
            const acls = await this.getFolderAclList([parentId, ...response.children.map(child => child._id)]);

            for (const aclData of acls) {
                await this.folderCache.addACL(aclData.id, aclData.acl);
            }
            await this.folderCache.addFolderListing(parentId, response);

            return response;
        }
    }

    /**
     * Update the folder cache for a list of folders.
     * @param {Array<string>} IDs - The list of folder IDs.
     */
    async updateFolderCache(IDs) {
        const data = [];
        for (const id of IDs) {
            // Ignore folders without an ID (i.e. root folders).
            if (!id) {
                continue;
            }
            const cachedFolder = await this.folderCache.getFolderListing(id);

            // If possible, add the lastUpdatedAt timestamp from the cache.
            if (cachedFolder && cachedFolder.parent) {
                data.push({
                    id: id,
                    lastUpdatedAt: cachedFolder.parent.updatedAt
                });
            } else {
                data.push({
                    id: id,
                });
            }
        }

        const response = await this.execute('post', `/api/folder/infolderquery`, { folders: data });

        for (const folderListing of response) {
            if (folderListing.data.notModified === true) {
                // If the folder was not modified since the last time we fetched it, we only need to update the cachedAt date.
                await this.folderCache.refreshCacheForFolder(folderListing.id);
            } else {
                await this.folderCache.addFolderListing(folderListing.id, folderListing.data);
            }
        }
    }
    /**
     * Create a new folder.
     * @param {Object} data - The folder data.
     * @param {string} data.name - The name of the folder
     * @param {string} [data.parent] - The ID of the parent folder or omit to create in root folder
     * @param {boolean} [data.returnIfExists] - true, if the folder should be returned in case it already exists.
     * @returns {Promise<string>} The folder's ID
     */
    async createFolder(data) {
        return this.execute('post', '/api/folder', data);
    }

    /**
     * Update an existing folder.
     * @param {Object} data - The folder data.
     * @param {string} data._id - The id of the folder
     * @param {string} data.name - The name of the folder
     * @param {string} [data.acl] - Optional acl array in case it should be updated
     * @returns {Promise<Object>} The updated folder details.
     */
    async updateFolder(data) {
        return this.execute('put', '/api/folder', data);
    }

    /**
     * Delete a folder by ID.
     * @param {string} id - The folder ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteFolder(id) {
        return this.execute('delete', '/api/folder', { id: id });
    }

    /**
     * Rename folder
     * @param {string} id - The folder ID.
     * @param {string} name - The new folder name.
     * @returns {Promise<Object>} The updated folder details.
     */
    async renameFolder(id, name) {
        return this.updateFolder({_id: id, name});
    }

    /**
     * Move folders to a different location.
     * @param {Object} data - The move data.
     * @returns {Promise<Object>} The move response.
     */
    async moveFolders(data) {
        return this.execute('post', '/api/folder/move', data);
    }

    /**
     * Get the path of a folder by ID.
     * @param {string} id - The folder ID.
     * @returns {Promise<string>} The folder path.
     */
    async getFolderPath(id) {
        return this.execute('get', '/api/folder/path/' + id);
    }

    /**
     * Get client information for a folder.
     * @param {string} id - The folder ID.
     * @returns {Promise<Object>} The client information.
     */
    async getFolderClient(id) {
        return this.execute('get', `/api/folder/getClient/${id}`);
    }

    /**
     * Get the Access Control List (ACL) for a folder.
     * @param {string} id - The folder ID.
     * @returns {Promise<Object>} The folder ACL.
     */
    async getFolderAcl(id) {
        // Get the cached ACLs for the folder, but limit the valid age of the cached folder to 10 seconds.
        const cachedAcl = this.folderCache.getFolderACLs(id ? id : "0", 10000);

        // If the ID is not defined, then we're accessing the root folder, which we can't cache at all.
        if (cachedAcl && id) {
            // If we have cached ACLs, we can return it.
            return cachedAcl;
        } else {
            // Otherwise we need to fetch the ACLs from the server.
            const data = await this.execute('get', `/api/folder/acl/${id ? id : "0"}`);
            await this.folderCache.addACL(id ? id : "0", data);

            return data;
        }
    }

    /**
     * Get the ACL list for multiple folders.
     * @param {Array<string>} ids - The list of folder IDs.
     * @returns {Promise<Array>} The list of ACLs.
     */
    async getFolderAclList(ids) {
        return this.execute('post', `/api/folder/aclquery`, { ids: ids });
    }

    /**
     * Get a user by ID.
     * @param {string} id - The user ID.
     * @returns {Promise<Object>} The user details.
     */
    async getUser(id) {
        return this.execute('get', '/api/user/' + id);
    }

    /**
     * Get the list of users.
     * @returns {Promise<Array>} The list of users.
     */
    async getUsersList() {
        return this.execute('get', '/api/user');
    }

    /**
     * Create a new user.
     * @param {Object} data - The user data.
     * @returns {Promise<Object>} The created user details.
     */
    async createUser(data) {
        return this.execute('post', '/api/user', data);
    }

    /**
     * Query users with a search query.
     * @param {string} searchQuery - The search query.
     * @param {string} groupID - The group ID.
     * @param {string} [cursor] - Pagination cursor.
     * @returns {Promise<Object>} The query response.
     */
    async queryUser(searchQuery, groupID, cursor) {
        return this.execute('post', '/api/user/query',
            { searchQuery, groupID, cursor }, { withNext: true });
    }

    /**
     * Update an existing user.
     * @param {Object} data - The user data.
     * @returns {Promise<Object>} The updated user details.
     */
    async updateUser(data) {
        return this.execute('put', '/api/user', data);
    }

    /**
     * Delete a user by ID.
     * @param {string} id - The user ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteUser(id) {
        return this.execute('delete', '/api/user', { id: id });
    }

    /**
     * Update the profile of the current user.
     * @param {Object} data - The profile data.
     * @returns {Promise<Object>} The updated profile details.
     */
    async updateMyProfile(data) {
        return this.execute('put', '/api/user/myprofile', data);
    }

    /**
     * Switch to a different client.
     * @param {string} id - The client ID.
     * @returns {Promise<Object>} The switch response.
     */
    async switchClient(id) {
        return this.execute('get', `/api/user/switchclient/${id}`);
    }

    /**
     * Activate a user account with a token.
     * @param {string} password - The user password.
     * @param {string} token - The activation token.
     * @returns {Promise<Object>} The activation response.
     */
    async activateUser(password, token) {
        return this.execute('post', '/api/user/activate', { token: token, password: password });
    }

    /**
     * Get the list of users pending approval.
     * @returns {Promise<Array>} The list of users.
     */
    async getUsersToApprove() {
        return this.execute('get', '/api/user/approvals');
    }

    /**
     * Approve a user's registration.
     * @param {string} userId - The user ID.
     * @returns {Promise<Object>} The approval response.
     */
    async approveUserRegistration(userId) {
        return this.execute('get', `/api/user/approveuserregistration/${userId}`);
    }

    /**
     * Reject a user's registration.
     * @param {string} userId - The user ID.
     * @returns {Promise<Object>} The rejection response.
     */
    async rejectUserRegistration(userId) {
        return this.execute('get', `/api/user/rejectuserregistration/${userId}`);
    }

    /**
     * Upload an avatar for the current user.
     * @param {Buffer|Blob} data - The avatar data. Can be passed as a buffer or a blob
     * @returns {Promise<Object>} The upload response.
     */
    async uploadAvatar(data) {
        const formData = new FormData();
        if (data instanceof Blob) {
            formData.append('file', data);
        } else {
            const blob = new Blob([data]);
            formData.append('file', blob, "avatar.jpg");
        }
        return this.execute('post', '/api/user/uploadAvatar', formData);
    }

    /**
     * Clear the avatar of the current user.
     * @returns {Promise<Object>} The response.
     */
    async clearAvatar() {
        return this.execute('get', '/api/user/clearAvatar');
    }

    /**
     * Get the avatar of a user.
     * @param {string} userId - The user ID.
     * @param {string} size - The avatar size.
     * @returns {Promise<Blob>} The avatar image.
     */
    async getAvatar(userId, size) {
        return this.execute('get', `/api/user/avatar/${size}/${userId}`);
    }

    /**
     * Get the public information of a user.
     * @param {string} userId - The user ID.
     * @param {string} clientId - The client ID.
     * @param {string} avatarSize - The avatar size.
     * @returns {Promise<Object>} The user public information.
     */
    async getUserPublicInfo(userId, clientId, avatarSize) {
        return this.execute('get', `/api/user/publicinfo/${userId}/${clientId}/${avatarSize}`);
    }

    /**
     * Get a user attribute by key.
     * @param {string} key - The attribute key.
     * @returns {Promise<Object>} The attribute value.
     */
    async getUserAttribute(key) {
        return this.execute('get', `/api/user/attribute/${key}`);
    }

    /**
     * Clear a user attribute by key.
     * @param {string} key - The attribute key.
     * @returns {Promise<Object>} The response.
     */
    async clearUserAttribute(key) {
        return this.execute('delete', `/api/user/attribute/${key}`);
    }

    /**
     * Set a user attribute.
     * @param {string} key - The attribute key.
     * @param {string} value - The attribute value.
     * @returns {Promise<Object>} The response.
     */
    async setUserAttribute(key, value) {
        return this.execute('post', `/api/user/attribute/${key}`, value);
    }

    /**
     * Get a group by ID.
     * @param {string} id - The group ID.
     * @returns {Promise<Object>} The group details.
     */
    async getGroup(id) {
        return this.execute('get', '/api/group/' + id);
    }

    /**
     * Get the folder of a group.
     * @param {string} id - The group ID.
     * @returns {Promise<Object>} The group folder details.
     */
    async getGroupFolder(id) {
        return this.execute('get', '/api/group/folder/' + id);
    }

    /**
     * Get the list of groups.
     * @returns {Promise<Array>} The list of groups.
     */
    async getGroupsList() {
        return this.execute('get', '/api/group');
    }

    /**
     * Create a new group.
     * @param {Object} data - The group data.
     * @returns {Promise<Object>} The created group details.
     */
    async createGroup(data) {
        return this.execute('post', '/api/group', data);
    }

    /**
     * Query groups with a search query.
     * @param {string} searchQuery - The search query.
     * @param {string} [cursor] - Pagination cursor.
     * @returns {Promise<Object>} The query response.
     */
    async queryGroup(searchQuery, cursor) {
        return this.execute('post', '/api/group/query',
            { searchQuery, cursor }, { withNext: true });
    }

    /**
     * Update an existing group.
     * @param {Object} data - The group data.
     * @returns {Promise<Object>} The updated group details.
     */
    async updateGroup(data) {
        return this.execute('put', '/api/group', data);
    }

    /**
     * Delete a group by ID.
     * @param {string} id - The group ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteGroup(id) {
        return this.execute('delete', '/api/group', { id: id });
    }

    /**
     * Get quota information for a group.
     * @param {string} id - The group ID.
     * @returns {Promise<Object>} The quota information.
     */
    async getGroupQuotaInfo(id) {
        return this.execute('get', '/api/group/quota/' + id);
    }

    /**
     * Get public information for a group.
     * @param {string} groupId - The group ID.
     * @param {string} clientId - The client ID.
     * @param {string} avatarSize - The avatar size.
     * @returns {Promise<Object>} The public group information.
     */
    async getGroupPublicInfo(groupId, clientId, avatarSize) {
        return this.execute('get', `/api/group/publicinfo/${groupId}/${clientId}/${avatarSize}`);
    }


    /**
     * Get the list of clients.
     * @returns {Promise<Array>} The list of clients.
     */
    async getClientsList() {
        return this.execute('get', '/api/client');
    }

    /**
     * Get a client by ID.
     * @param {string} id - The client ID.
     * @returns {Promise<Object>} The client details.
     */
    async getClient(id) {
        return this.execute('get', `/api/client/${id}`);
    }

    /**
     * Create a new client.
     * @param {Object} data - The client data.
     * @returns {Promise<Object>} The created client details.
     */
    async createClient(data) {
        return this.execute('post', '/api/client', data);
    }

    /**
     * Query clients with a search query.
     * @param {string} searchQuery - The search query.
     * @param {string} [cursor] - Pagination cursor.
     * @returns {Promise<Object>} The query response.
     */
    async queryClient(searchQuery, cursor) {
        return this.execute('post', '/api/client/query',
            { searchQuery, cursor }, { withNext: true });
    }

    /**
     * Update an existing client.
     * @param {Object} data - The client data.
     * @returns {Promise<Object>} The updated client details.
     */
    async updateClient(data) {
        return this.execute('put', '/api/client', data);
    }

    /**
     * Delete a client by ID.
     * @param {string} id - The client ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteClient(id) {
        return this.execute('delete', '/api/client', { id: id });
    }

    /**
     * Get client metrics for a specific month and year.
     * @param {string} id - The client ID.
     * @param {number} year - The year.
     * @param {number} month - The month.
     * @returns {Promise<Object>} The client metrics.
     */
    async getClientMetrics(id, year, month) {
        return this.execute('get', `/api/client/metrics/${year}/${month}/${id}`);
    }

    /**
     * Join a client.
     * @param {string} id - The client ID.
     * @returns {Promise<Object>} The join response.
     */
    async joinClient(id) {
        return this.execute('get', `/api/client/join/${id}`);
    }

    /**
     * Leave a client.
     * @param {string} id - The client ID.
     * @returns {Promise<Object>} The leave response.
     */
    async leaveClient(id) {
        return this.execute('get', `/api/client/leave/${id}`);
    }

    /**
     * Get the current user's client.
     * @returns {Promise<Object>} The current user's client.
     */
    async myClient() {
        return this.execute('get', '/api/client/my');
    }

    /**
     * Save the current user's client.
     * @param {Object} data - The client data.
     * @returns {Promise<Object>} The saved client details.
     */
    async saveMyClient(data) {
        return this.execute('put', '/api/client/my', data);
    }

    /**
     * Get public categories for a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of public categories.
     */
    async getPublicCategories(clientId) {
        return this.execute('get', `/api/client/publiccategories/${clientId}`);
    }

    /**
     * Get the list of categories.
     * @returns {Promise<Array>} The list of categories.
     */
    async getCategories() {
        return this.execute('get', `/api/client/categories`);
    }

    /**
     * Get the categories in a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of categories.
     */
    async getCategoriesInClient(clientId) {
        return this.execute('get', `/api/client/categories/${clientId}`);
    }

    /**
     * Update the categories in a client.
     * @param {string} clientId - The client ID.
     * @param {Array} categories - The categories to update.
     * @returns {Promise<Object>} The update response.
     */
    async updateCategoriesInClient(clientId, categories) {
        return this.execute('post', `/api/client/categories/${clientId}`, categories);
    }

    /**
     * Get the list of licenses.
     * @returns {Promise<Array>} The list of licenses.
     */
    async getLicenses() {
        return this.execute('get', '/api/license');
    }

    /**
     * Get licenses in a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of licenses.
     */
    async getLicensesInClient(clientId) {
        return this.execute('get', `/api/license/inclient/${clientId}`);
    }

    /**
     * Get a license by ID.
     * @param {string} id - The license ID.
     * @returns {Promise<Object>} The license details.
     */
    async getLicense(id) {
        return this.execute('get', `/api/license/${id}`);
    }

    /**
     * Create a new license.
     * @param {Object} data - The license data.
     * @returns {Promise<Object>} The created license details.
     */
    async createLicense(data) {
        return this.execute('post', '/api/license', data);
    }

    /**
     * Update an existing license.
     * @param {Object} data - The license data.
     * @returns {Promise<Object>} The updated license details.
     */
    async updateLicense(data) {
        return this.execute('put', '/api/license', data);
    }

    /**
     * Delete a license by ID.
     * @param {string} id - The license ID.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteLicense(id, clientId) {
        return this.execute('delete', '/api/license', { _id: id, client: clientId });
    }

    /**
     * Get the list of public licenses for a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of public licenses.
     */
    async getPublicLicenses(clientId) {
        return this.execute('get', `/api/license/publiclist/${clientId}`);
    }

    /**
     * Get a public license by ID.
     * @param {string} id - The license ID.
     * @returns {Promise<Object>} The license details.
     */
    async getPublicLicense(id) {
        return this.execute('get', `/api/license/public/${id}`);
    }

    /**
     * Get the list of data types.
     * @returns {Promise<Array>} The list of data types.
     */
    async getDatatypesList() {
        return this.execute('get', '/api/datatype');
    }

    /**
     * Get the list of data types on the client.
     * @returns {Promise<Array>} The list of data types.
     */
    async getDatatypesListOnClient() {
        return this.execute('get', '/api/datatype/onclient');
    }

    /**
     * Get the list of data types on the client for all users.
     * @returns {Promise<Array>} The list of data types.
     */
    async getDatatypesListOnClientForAll() {
        return this.execute('get', '/api/datatype/onclientforall');
    }

    /**
     * Get the list of all data types.
     * @returns {Promise<Array>} The list of all data types.
     */
    async getAllDatatypesList() {
        return this.execute('get', '/api/datatype/all');
    }

    /**
     * Get a data type by ID.
     * @param {string} id - The data type ID.
     * @returns {Promise<Object>} The data type details.
     */
    async getDatatype(id) {
        return this.execute('get', `/api/datatype/${id}`);
    }

    /**
     * Create a new data type.
     * @param {Object} data - The data type data.
     * @returns {Promise<Object>} The created data type details.
     */
    async createDatatype(data) {
        return this.execute('post', '/api/datatype', data);
    }

    /**
     * Update an existing data type.
     * @param {Object} data - The data type data.
     * @returns {Promise<Object>} The updated data type details.
     */
    async updateDatatype(data) {
        return this.execute('put', '/api/datatype', data);
    }

    /**
     * Delete a data type by ID.
     * @param {string} id - The data type ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteDatatype(id) {
        return this.execute('delete', '/api/datatype', { id: id });
    }

    /**
     * Get the list of notifications for the current user.
     * @param {number} [maxCount] - Maximum number of notifications.
     * @returns {Promise<Array>} The list of notifications.
     */
    async getMyNotifications(maxCount) {
        return this.execute('get', '/api/notification' + (maxCount ? `?maxCount=${maxCount}` : ''));
    }

    /**
     * Mark a notification as read.
     * @param {string} id - The notification ID.
     * @returns {Promise<Object>} The response.
     */
    async markNotificationAsRead(id) {
        return this.execute('get', `/api/notification/markasread/${id}`);
    }

    /**
     * Mark all notifications as read.
     * @returns {Promise<Object>} The response.
     */
    async markAllNotificationsAsRead() {
        return this.execute('get', `/api/notification/markallasread`);
    }

    /**
     * Create a new job.
     * @param {Object} data - The job data.
     * @returns {Promise<Object>} The created job details.
     */
    async createJob(data) {
        return this.execute('post', '/api/job', data, { emitOnSuccess: "nk:job:created" });
    }

    /**
     * Get the list of manual job types.
     * @returns {Promise<Array>} The list of manual job types.
     */
    async getManualJobTypes() {
        return this.execute('get', '/api/job/manualtypes');
    }

    /**
     * Get the list of manual job types on the client.
     * @returns {Promise<Array>} The list of manual job types.
     */
    async getManualJobTypesOnClient() {
        return this.execute('get', '/api/job/manualtypes/onclient');
    }

    /**
     * Get the list of manual job types on the client for all users.
     * @returns {Promise<Array>} The list of manual job types.
     */
    async getManualJobTypesOnClientForAll() {
        return this.execute('get', '/api/job/manualtypes/onclientforall');
    }

    /**
     * Get the list of all manual job types.
     * @returns {Promise<Array>} The list of manual job types.
     */
    async getAllManualJobTypes() {
        return this.execute('get', '/api/job/manualtypes/all');
    }

    /**
     * Get the list of all manual job types for a client.
     * @param {string} id - The client ID.
     * @returns {Promise<Array>} The list of manual job types.
     */
    async getAllManualJobTypesForClient(id) {
        return this.execute('get', `/api/job/manualtypes/all/${id}`);
    }

    /**
     * Get the list of client job types.
     * @returns {Promise<Array>} The list of client job types.
     */
    async getClientJobTypes() {
        return this.execute('get', '/api/job/clientTypes');
    }

    /**
     * Get the list of jobs for the current user.
     * @returns {Promise<Array>} The list of jobs.
     */
    async getMyJobs() {
        return this.execute('get', '/api/job/mine');
    }

    /**
     * Get the list of all jobs.
     * @returns {Promise<Array>} The list of jobs.
     */
    async getJobs() {
        return this.execute('get', '/api/job');
    }

    /**
     * Get the aggregated list of jobs.
     * @returns {Promise<Array>} The aggregated list of jobs.
     */
    async getJobsAggregated() {
        return this.execute('get', '/api/job/aggregated');
    }

    /**
     * Get the list of jobs within a specific timeframe.
     * @param {string} from - The start date.
     * @param {string} till - The end date.
     * @returns {Promise<Array>} The list of jobs.
     */
    async getJobsTimeframe(from, till) {
        return this.execute('get', `/api/job/all/${from}/${till}`);
    }

    /**
     * Get a job by ID.
     * @param {string} id - The job ID.
     * @returns {Promise<Object>} The job details.
     */
    async getJob(id) {
        return this.execute('get', `/api/job/${id}`);
    }

    /**
     * Get the state of a job.
     * @param {string} id - The job ID.
     * @returns {Promise<Object>} The job state.
     */
    async getJobState(id) {
        return this.execute('get', `/api/job/state/${id}`);
    }

    /**
     * Get the list of job agents.
     * @returns {Promise<Array>} The list of job agents.
     */
    async getAgents() {
        return this.execute('get', '/api/jobagent');
    }

    /**
     * Get the aggregated list of job agents.
     * @returns {Promise<Array>} The aggregated list of job agents.
     */
    async getAgentsAggregated() {
        return this.execute('get', '/api/jobagent/aggregated');
    }

    /**
     * Enable a job agent.
     * @param {string} id - The job agent ID.
     * @returns {Promise<Object>} The enable response.
     */
    async enableJobAgent(id) {
        return this.execute('get', `/api/jobagent/enable/${id}`);
    }

    /**
     * Disable a job agent.
     * @param {string} id - The job agent ID.
     * @returns {Promise<Object>} The disable response.
     */
    async disableJobAgent(id) {
        return this.execute('get', `/api/jobagent/disable/${id}`);
    }

    /**
     * Restart a job agent.
     * @param {string} id - The job agent ID.
     * @returns {Promise<Object>} The restart response.
     */
    async restartJobAgent(id) {
        return this.execute('get', `/api/jobagent/restart/${id}`);
    }

    /**
     * Get the list of permissions.
     * @returns {Promise<Array>} The list of permissions.
     */
    async getPermissionsList() {
        return this.execute('get', '/api/permission');
    }

    /**
     * Get the list of plugins.
     * @returns {Promise<Array>} The list of plugins.
     */
    async getPlugins() {
        return this.execute('get', '/api/plugin');
    }

    /**
     * Get the list of plans.
     * @returns {Promise<Array>} The list of plans.
     */
    async getPlans() {
        return this.execute('get', '/api/plan');
    }

    /**
     * Get a plan by ID.
     * @param {string} id - The plan ID.
     * @returns {Promise<Object>} The plan details.
     */
    async getPlan(id) {
        return this.execute('get', `/api/plan/${id}`);
    }

    /**
     * Create a new plan.
     * @param {Object} data - The plan data.
     * @returns {Promise<Object>} The created plan details.
     */
    async createPlan(data) {
        return this.execute('post', '/api/plan', data);
    }

    /**
     * Update an existing plan.
     * @param {Object} data - The plan data.
     * @returns {Promise<Object>} The updated plan details.
     */
    async updatePlan(data) {
        return this.execute('put', '/api/plan', data);
    }

    /**
     * Delete a plan by ID.
     * @param {string} id - The plan ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deletePlan(id) {
        return this.execute('delete', '/api/plan', { id: id });
    }

    /**
     * Get the list of workflows.
     * @returns {Promise<Array>} The list of workflows.
     */
    async getWorkflows() {
        return this.execute('get', '/api/workflow');
    }

    /**
     * Get a workflow by ID.
     * @param {string} id - The workflow ID.
     * @returns {Promise<Object>} The workflow details.
     */
    async getWorkflow(id) {
        return this.execute('get', `/api/workflow/${id}`);
    }

    /**
     * Create a new workflow.
     * @param {Object} data - The workflow data.
     * @returns {Promise<Object>} The created workflow details.
     */
    async createWorkflow(data) {
        return this.execute('post', '/api/workflow', data);
    }

    /**
     * Update an existing workflow.
     * @param {Object} data - The workflow data.
     * @returns {Promise<Object>} The updated workflow details.
     */
    async updateWorkflow(data) {
        return this.execute('put', '/api/workflow', data);
    }

    /**
     * Delete a workflow by ID.
     * @param {string} id - The workflow ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteWorkflow(id) {
        return this.execute('delete', '/api/workflow', { id: id });
    }

    /**
     * Start a workflow.
     * @param {Object} data - The workflow data.
     * @returns {Promise<Object>} The start response.
     */
    async startWorkflow(data) {
        return this.execute('post', '/api/workflow/start', data);
    }

    /**
     * Get the list of access tokens.
     * @returns {Promise<Array>} The list of access tokens.
     */
    async getAccessTokens() {
        return this.execute('get', '/api/accesstoken');
    }

    /**
     * Get the list of client access tokens.
     * @returns {Promise<Array>} The list of client access tokens.
     */
    async getClientAccessTokens() {
        return this.execute('get', '/api/accesstoken/client');
    }

    /**
     * Create a new access token.
     * @param {Object} data - The access token data.
     * @returns {Promise<Object>} The created access token details.
     */
    async createAccessToken(data) {
        return this.execute('post', '/api/accesstoken', data);
    }

    /**
     * Create a new client access token.
     * @param {Object} data - The access token data.
     * @returns {Promise<Object>} The created client access token details.
     */
    async createClientAccessToken(data) {
        return this.execute('post', '/api/accesstoken/client', data);
    }

    /**
     * Delete an access token by ID.
     * @param {string} id - The access token ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteAccessToken(id) {
        return this.execute('delete', '/api/accesstoken', { id: id });
    }

    /**
     * Delete a client access token by ID.
     * @param {string} id - The access token ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteClientAccessToken(id) {
        return this.execute('delete', '/api/accesstoken/client', { id: id });
    }

    /**
     * Enable an access token.
     * @param {string} id - The access token ID.
     * @returns {Promise<Object>} The enable response.
     */
    async enableAccessToken(id) {
        return this.execute('get', `/api/accesstoken/enable/${id}`);
    }

    /**
     * Disable an access token.
     * @param {string} id - The access token ID.
     * @returns {Promise<Object>} The disable response.
     */
    async disableAccessToken(id) {
        return this.execute('get', `/api/accesstoken/disable/${id}`);
    }

    /**
     * Get the list of API tokens.
     * @returns {Promise<Array>} The list of API tokens.
     */
    async getApiTokens() {
        return this.execute('get', '/api/apitoken');
    }

    /**
     * Create a new API token.
     * @param {Object} data - The API token data.
     * @returns {Promise<Object>} The created API token details.
     */
    async createApiToken(data) {
        return this.execute('post', '/api/apitoken', data);
    }

    /**
     * Delete an API token by ID.
     * @param {string} id - The API token ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteApiToken(id) {
        return this.execute('delete', '/api/apitoken', { id: id });
    }

    /**
     * Get the list of invoices for the current user's client.
     * @returns {Promise<Array>} The list of invoices.
     */
    async getMyClientInvoices() {
        return this.execute('get', '/api/invoice');
    }

    /**
     * Get the list of invoices for the current user.
     * @returns {Promise<Array>} The list of invoices.
     */
    async getMyUserInvoices() {
        return this.execute('get', '/api/invoice/my');
    }

    /**
     * Get the list of invoices for a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of invoices.
     */
    async getClientInvoices(clientId) {
        return this.execute('get', `/api/invoice/client/${clientId}`);
    }

    /**
     * Download an invoice by ID.
     * @param {string} invoiceId - The invoice ID.
     * @param {string} [filename] - The filename for the download.
     * @returns {Promise<void>} The download action.
     */
    async downloadInvoice(invoiceId, filename) {
        const response = await this.execute('get', `/api/invoice/download/${invoiceId}`, null, { responseType: "arraybuffer" });
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || "invoice.pdf");
        document.body.appendChild(link);
        link.click();
    }

    /**
     * Regenerate an invoice by ID.
     * @param {string} invoiceId - The invoice ID.
     * @returns {Promise<Object>} The regeneration response.
     */
    async regenerateInvoice(invoiceId) {
        return this.execute('get', `/api/invoice/regenerate/${invoiceId}`);
    }

    /**
     * Get the list of invoices for a specific month and year.
     * @param {number} year - The year.
     * @param {number} month - The month.
     * @returns {Promise<Array>} The list of invoices.
     */
    async getInvoicesForMonth(year, month) {
        return this.execute('get', `/api/invoice/month/${month}/${year}`);
    }

    /**
     * Refund an invoice.
     * @param {string} invoice - The invoice ID.
     * @param {number} amount - The refund amount.
     * @param {string} reason - The reason for the refund.
     * @returns {Promise<Object>} The refund response.
     */
    async refundInvoice(invoice, amount, reason) {
        return this.execute('post', `/api/invoice/refund`, {
            invoice: invoice,
            amount: amount,
            reason: reason
        });
    }

    /**
     * Start a checkout process for payment.
     * @param {string} successUrl - The success URL.
     * @param {string} cancelUrl - The cancel URL.
     * @returns {Promise<Object>} The checkout response.
     */
    async paymentStartCheckout(successUrl, cancelUrl) {
        return this.execute('post', '/api/payment/checkout', {
            successUrl: successUrl,
            cancelUrl: cancelUrl
        });
    }

    /**
     * Start a checkout process for user payment.
     * @param {string} successUrl - The success URL.
     * @param {string} cancelUrl - The cancel URL.
     * @returns {Promise<Object>} The checkout response.
     */
    async paymentStartUserCheckout(successUrl, cancelUrl) {
        return this.execute('post', '/api/payment/usercheckout', {
            successUrl: successUrl,
            cancelUrl: cancelUrl
        });
    }

    /**
     * Get the list of supported currencies.
     * @returns {Promise<Array>} The list of currencies.
     */
    async getSupportedCurrencies() {
        return this.execute('get', '/api/payment/supportedCurrencies');
    }

    /**
     * Get the list of purchasable items.
     * @returns {Promise<Array>} The list of purchasables.
     */
    async getPurchasables() {
        return this.execute('get', '/api/purchasable');
    }

    /**
     * Get a purchasable item by ID.
     * @param {string} id - The purchasable ID.
     * @returns {Promise<Object>} The purchasable details.
     */
    async getPurchasable(id) {
        return this.execute('get', `/api/purchasable/${id}`);
    }

    /**
     * Create a new purchasable item.
     * @param {Object} data - The purchasable data.
     * @returns {Promise<Object>} The created purchasable details.
     */
    async createPurchasable(data) {
        return this.execute('post', '/api/purchasable', data);
    }

    /**
     * Update an existing purchasable item.
     * @param {Object} data - The purchasable data.
     * @returns {Promise<Object>} The updated purchasable details.
     */
    async updatePurchasable(data) {
        return this.execute('put', '/api/purchasable', data);
    }

    /**
     * Delete a purchasable item by ID.
     * @param {string} id - The purchasable ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deletePurchasable(id) {
        return this.execute('delete', '/api/purchasable', { id: id });
    }

    /**
     * Get the list of public purchasables for a client.
     * @param {string} clientId - The client ID.
     * @returns {Promise<Array>} The list of public purchasables.
     */
    async getPublicPurchasables(clientId) {
        return this.execute('get', `/api/purchasable/public/${clientId}`);
    }

    /**
     * Get the list of purchases.
     * @returns {Promise<Array>} The list of purchases.
     */
    async getPurchases() {
        return this.execute('get', '/api/purchase');
    }

    /**
     * Make a purchase.
     * @param {Object} data - The purchase data.
     * @returns {Promise<Object>} The purchase details.
     */
    async purchase(data) {
        return this.execute('post', '/api/purchase', data);
    }

    /**
     * Cancel a purchase by ID.
     * @param {string} id - The purchase ID.
     * @returns {Promise<Object>} The cancellation response.
     */
    async cancelPurchase(id) {
        return this.execute('delete', '/api/purchase', { id: id });
    }

    /**
     * Query purchases with various parameters.
     * @param {string} startDate - The start date.
     * @param {string} endDate - The end date.
     * @param {string} email - The email associated with the purchase.
     * @param {string} invoice - The invoice number.
     * @param {string} [cursor] - Pagination cursor.
     * @param {number} [limit] - Result limit.
     * @returns {Promise<Array>} The list of purchases.
     */
    async queryPurchases(startDate, endDate, email, invoice, cursor, limit) {
        return this.execute('post', '/api/purchase/query', {
            startDate: startDate,
            endDate: endDate,
            email: email,
            invoice: invoice,
            cursor: cursor,
            limit: limit
        });
    }

    /**
     * Get the list of attribute templates.
     * @returns {Promise<Array>} The list of attribute templates.
     */
    async getAttributeTemplates() {
        return this.execute('get', '/api/attributetemplate');
    }

    /**
     * Get an attribute template by ID.
     * @param {string} id - The attribute template ID.
     * @returns {Promise<Object>} The attribute template details.
     */
    async getAttributeTemplate(id) {
        return this.execute('get', `/api/attributetemplate/${id}`);
    }

    /**
     * Create a new attribute template.
     * @param {Object} data - The attribute template data.
     * @returns {Promise<Object>} The created attribute template details.
     */
    async createAttributeTemplate(data) {
        return this.execute('post', '/api/attributetemplate', data);
    }

    /**
     * Update an existing attribute template.
     * @param {Object} data - The attribute template data.
     * @returns {Promise<Object>} The updated attribute template details.
     */
    async updateAttributeTemplate(data) {
        return this.execute('put', '/api/attributetemplate', data);
    }

    /**
     * Delete an attribute template by ID.
     * @param {string} id - The attribute template ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteAttributeTemplate(id) {
        return this.execute('delete', '/api/attributetemplate', { id: id });
    }

    /**
     * Get the list of storages.
     * @returns {Promise<Array>} The list of storages.
     */
    async getStorages() {
        return this.execute('get', '/api/storage');
    }

    /**
     * Get a conversation by ID.
     * @param {string} id - The conversation ID.
     * @returns {Promise<Object>} The conversation details.
     */
    async getConversation(id) {
        return this.execute('get', `/api/conversation/${id}`);
    }

    /**
     * Get a public conversation by ID.
     * @param {string} id - The conversation ID.
     * @returns {Promise<Object>} The conversation details.
     */
    async getPublicConversation(id) {
        return this.execute('get', `/api/conversation/public/${id}`);
    }

    /**
     * Create a new conversation.
     * @param {string} parentId - The parent ID.
     * @param {string} parentType - The parent type.
     * @returns {Promise<Object>} The created conversation details.
     */
    async createConversation(parentId, parentType) {
        return this.execute('post', '/api/conversation', { parentId, parentType });
    }

    /**
     * Post a message in a conversation.
     * @param {string} id - The conversation ID.
     * @param {string} text - The message text.
     * @param {string} [replyTo] - The ID of the message to reply to.
     * @returns {Promise<Object>} The posted message details.
     */
    async postConversationMessage(id, text, replyTo) {
        return this.execute('post', '/api/conversation/post', { id, text, replyTo });
    }

    /**
     * Edit a message in a conversation.
     * @param {string} id - The message ID.
     * @param {string} text - The new message text.
     * @returns {Promise<Object>} The updated message details.
     */
    async editConversationMessage(id, text) {
        return this.execute('put', '/api/conversation/post', { id, text });
    }

    /**
     * Delete a message from a conversation.
     * @param {string} id - The message ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteConversationMessage(id) {
        return this.execute('delete', '/api/conversation/post', { id });
    }

    /**
     * Subscribe to a conversation.
     * @param {string} id - The conversation ID.
     * @returns {Promise<Object>} The subscription response.
     */
    async subscribeToConversation(id) {
        return this.execute('post', `/api/conversation/subscribe`, { id });
    }

    /**
     * Unsubscribe from a conversation.
     * @param {string} id - The conversation ID.
     * @returns {Promise<Object>} The unsubscription response.
     */
    async unsubscribeFromConversation(id) {
        return this.execute('post', `/api/conversation/unsubscribe`, { id });
    }

    /**
     * Like a conversation entry by ID.
     * @param {string} id - The conversation entry ID.
     * @returns {Promise<void>}
     */
    async likeConversationEntry(id) {
        return this.execute('post', `/api/conversation/like`, {
            id
        });
    }

    /**
     * Unlike a conversation entry by ID.
     * @param {string} id - The conversation entry ID.
     * @returns {Promise<void>}
     */
    async unlikeConversationEntry(id) {
        return this.execute('post', `/api/conversation/unlike`, {
            id
        });
    }

    /**
     * Execute a command.
     * @param {Object} data - The command data.
     * @returns {Promise<Object>} The command response.
     */
    async command(data) {
        return this.execute('post', '/api/command', data);
    }

    /**
     * Get the list of mail templates.
     * @returns {Promise<Array>} The list of mail templates.
     */
    async getMailTemplates() {
        return this.execute('get', '/api/mailtemplate');
    }

    /**
     * Get a mail template by ID.
     * @param {string} id - The mail template ID.
     * @returns {Promise<Object>} The mail template details.
     */
    async getMailTemplate(id) {
        return this.execute('get', `/api/mailtemplate/${id}`);
    }

    /**
     * Create a new mail template.
     * @param {Object} data - The mail template data.
     * @returns {Promise<Object>} The created mail template details.
     */
    async createMailTemplate(data) {
        return this.execute('post', '/api/mailtemplate', data);
    }

    /**
     * Update an existing mail template.
     * @param {Object} data - The mail template data.
     * @returns {Promise<Object>} The updated mail template details.
     */
    async updateMailTemplate(data) {
        return this.execute('put', '/api/mailtemplate', data);
    }

    /**
     * Delete a mail template by ID.
     * @param {string} id - The mail template ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteMailTemplate(id) {
        return this.execute('delete', '/api/mailtemplate', { id: id });
    }

    /**
     * Add an image to a mail template.
     * @param {string} id - The mail template ID.
     * @param {string} name - The image name.
     * @param {Buffer|File} buffer - The image buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async addMailTemplateImage(id, name, buffer) {
        const formData = this._createFormData(buffer, "image.jpg");
        return this.execute('post', `/api/mailtemplate/image/${id}/${name}`, formData);
    }

    /**
     * Delete an image from a mail template.
     * @param {string} id - The mail template ID.
     * @param {string} name - The image name.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteMailTemplateImage(id, name) {
        return this.execute('delete', `/api/mailtemplate/image/${id}/${name}`);
    }

    /**
     * Get the list of mail template names.
     * @returns {Promise<Array>} The list of mail template names.
     */
    async getMailTemplateNames() {
        return this.execute('get', `/api/mailtemplate/names`);
    }

    /**
     * Get mail query results.
     * @param {string} templateName - The template name.
     * @param {string} dateStart - The start date.
     * @param {string} dateEnd - The end date.
     * @param {boolean} success - Filter by success status.
     * @returns {Promise<Array>} The query results.
     */
    async getMailQuery(templateName, dateStart, dateEnd, success) {
        return this.execute('post', '/api/email/query',
            { templateName, dateStart, dateEnd, success }, { withNext: true });
    }

    /**
     * Get the list of invoice templates.
     * @returns {Promise<Array>} The list of invoice templates.
     */
    async getInvoiceTemplates() {
        return this.execute('get', '/api/invoicetemplate');
    }

    /**
     * Get an invoice template by ID.
     * @param {string} id - The invoice template ID.
     * @returns {Promise<Object>} The invoice template details.
     */
    async getInvoiceTemplate(id) {
        return this.execute('get', `/api/invoicetemplate/${id}`);
    }

    /**
     * Create a new invoice template.
     * @param {Object} data - The invoice template data.
     * @returns {Promise<Object>} The created invoice template details.
     */
    async createInvoiceTemplate(data) {
        return this.execute('post', '/api/invoicetemplate', data);
    }

    /**
     * Update an existing invoice template.
     * @param {Object} data - The invoice template data.
     * @returns {Promise<Object>} The updated invoice template details.
     */
    async updateInvoiceTemplate(data) {
        return this.execute('put', '/api/invoicetemplate', data);
    }

    /**
     * Delete an invoice template by ID.
     * @param {string} id - The invoice template ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteInvoiceTemplate(id) {
        return this.execute('delete', '/api/invoicetemplate', { id: id });
    }

    /**
     * Add an image to an invoice template.
     * @param {string} id - The invoice template ID.
     * @param {string} name - The image name.
     * @param {Buffer|File} buffer - The image buffer or file.
     * @returns {Promise<Object>} The response.
     */
    async addInvoiceTemplateImage(id, name, buffer) {
        const formData = this._createFormData(buffer, "image.jpg");
        return this.execute('post', `/api/invoicetemplate/image/${id}/${name}`, formData);
    }

    /**
     * Delete an image from an invoice template.
     * @param {string} id - The invoice template ID.
     * @param {string} name - The image name.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteInvoiceTemplateImage(id, name) {
        return this.execute('delete', `/api/invoicetemplate/image/${id}/${name}`);
    }

    /**
     * Get the list of item templates.
     * @returns {Promise<Array>} The list of item templates.
     */
    async getItemTemplatesList() {
        return this.execute('get', '/api/itemtemplate/list');
    }

    /**
     * Get the list of item templates.
     * @returns {Promise<Array>} The list of item templates.
     */
    async getItemTemplates() {
        return this.execute('get', '/api/itemtemplate');
    }

    /**
     * Create a new item template.
     * @param {Object} data - The item template data.
     * @returns {Promise<Object>} The created item template details.
     */
    async createItemTemplate(data) {
        return this.execute('post', '/api/itemtemplate', data);
    }

    /**
     * Update an existing item template.
     * @param {Object} data - The item template data.
     * @returns {Promise<Object>} The updated item template details.
     */
    async updateItemTemplate(data) {
        return this.execute('put', '/api/itemtemplate', data);
    }

    /**
     * Delete an item template by ID.
     * @param {string} id - The item template ID.
     * @returns {Promise<Object>} The deletion response.
     */
    async deleteItemTemplate(id) {
        return this.execute('delete', '/api/itemtemplate', { id: id });
    }

    /**
     * Get the list of features.
     * @returns {Promise<Array>} The list of features.
     */
    async getFeatures() {
        return this.execute('get', '/api/feature');
    }

    /**
     * Get the list of features on the client.
     * @returns {Promise<Array>} The list of features.
     */
    async getFeaturesOnClient() {
        return this.execute('get', '/api/feature/onclient');
    }

    /**
     * Get the list of features on the client for all users.
     * @returns {Promise<Array>} The list of features.
     */
    async getFeaturesOnClientForAll() {
        return this.execute('get', '/api/feature/onclientforall');
    }

    /**
     * Get the list of all features.
     * @returns {Promise<Array>} The list of features.
     */
    async getAllFeatures() {
        return this.execute('get', '/api/feature/all');
    }

    // Blog
    // ----------------------------------------------------------------------------
    /**
     * List all blogs from the current client that the requesting user has access
     * to (i.e. blogs the user is an owner or editor of).
     * @returns {Promise<Array>} The list of accessible blogs.
     */
    async getBlogs () {
        return this.execute('get', '/api/blog');
    }

    /**
     * Get a specific blog from the current client that the requesting user has
     * access to (i.e. a blog the user is an owner or editor of).
     * @param {string} id - The blog ID.
     * @returns {Promise<Object>} The requested blog.
     */
    async getBlog (id) {
        return this.execute('get', '/api/blog/' + id);
    }

    /**
     * Get the public information about a public blog.
     * @param {string} id - The blog ID.
     * @returns {Promise<Object>} The requested blog.
     */
    async getPublicBlog (id) {
        return this.execute('get', '/api/blog/' + id + '/public');
    }

    /**
     * Create a new blog.
     * @param {string} name - The blog name.
     * @param {boolean} isPublic - Whether the blog is public.
     * @param {boolean} commentsEnabled - Whether comments are enabled.
     * @param {Array<string>} editors - The list of editor user IDs.
     * @returns {Promise<void>}
     */
    async createBlog (name, isPublic, commentsEnabled, editors) {
        return this.execute('post', '/api/blog', {
            name,
            public: isPublic,
            commentsEnabled,
            editors
        });
    }

    /**
     * Save an update to a blog.
     * @param {string} id - The blog ID.
     * @param {string} name - The blog name.
     * @param {boolean} isPublic - Whether the blog is public.
     * @param {boolean} commentsEnabled - Whether comments are enabled.
     * @param {Array<string>} editors - The list of editor user IDs.
     * @returns {Promise<void>}
     */
    async saveBlog (id, name, isPublic, commentsEnabled, editors) {
        return this.execute('put', '/api/blog', {
            _id: id,
            name,
            public: isPublic,
            commentsEnabled,
            editors
        });
    }

    /**
     * Delete a blog.
     * @param {string} id - The blog ID.
     * @returns {Promise<void>}
     */
    async deleteBlog (id) {
        return this.execute('delete', '/api/blog', {
            _id: id,
        });
    }

    /**
     * Get articles for an overview of a blog.
     * @param {string} id - The blog ID.
     * @returns {Promise}
     */
    async getBlogOverview (id) {
        return this.execute('get', '/api/blog/' + id + '/overview');
    }

    /**
     * Query a blog for articles.
     * @param {string} id - The blog ID.
     * @param {string} tag - Require the articles to include this exact.
     * @param {string} text - Require the articles to contain this text in their content or title.
     * @param {string} limit - Limit the amount of returned articles, min = 2, max = 24, default = 24.
     * @param {string} previousArticle - publishedAt date of the previous article to get the next page of articles.
     * @param {string} searchTag - Find all tags that include this substring.
     * @param {string} sortBy - By default the list is sorted by publishing date, if this field is 'views', they will be sorted by amount of views instead.
     * @returns {Promise} an object with two arrays: "articles" (which includes the articles that match the query) and "tags" (which contains the tags that match the searchTag string, only exists if searchTag was specified)
     */
    async queryBlog (id, tag, text, limit, previousArticle, searchTag, sortBy) {
        return this.execute('post', '/api/blog/' + id + '/query', {
            tag, text, limit, previousArticle, searchTag, sortBy
        });
    }

    // Blog Articles
    // ----------------------------------------------------------------------------
    /**
     * List all accessible articles from a blog (i.e. articles from blogs that the
     * user is an owner or editor of).
     * @param {string} blogID - The blog ID.
     * @returns {Promise<Array>} The list of articles.
     */
    async getArticles (blogID) {
        return this.execute('get', '/api/blog/' + blogID + '/article');
    }

    /**
     * Get a specific accessible article from a blog (i.e. articles from blogs that the
     * user is an owner or editor of).
     * @param {string} blogID - The blog ID.
     * @param {string} id - The article ID.
     * @returns {Promise<Object>} The requested article.
     */
    async getArticle (blogID, id) {
        return this.execute('get', '/api/blog/' + blogID + '/article/' + id);
    }

    /**
     * Get a specific public article from a blog by specifying the unique slug.
     * @param {string} blogID - The blog ID.
     * @param {string} slug - The slug of the article.
     * @returns {Promise<Object>} The requested article.
     */
    async getArticleBySlug (clientID, slug) {
        return this.execute('get', '/api/blog/article/' + clientID + '/' + slug);
    }

    /**
     * Create a new article in an accesible blog.
     * @param {string} blogID - The blog ID.
     * @param {string} title - The article title.
     * @returns {Promise<void>}
     */
    async createArticle (blogID, title) {
        return this.execute('post', '/api/blog/' + blogID + "/article", {
            title
        });
    }

    /**
     * Save an update to an article.
     * @param {string} blogID - The blog ID.
     * @param {string} id - The article ID.
     * @param {string} title - The article title.
     * @param {boolean} isPublic - Whether the article is public.
     * @param {Array<string>} tags - The list of tags.
     * @param {string} author - The author user ID.
     * @param {string} content - The article content.
     * @returns {Promise<void>}
     */
    async saveArticle (blogID, id, title, isPublic, tags, author, content) {
        return this.execute('put', '/api/blog/' + blogID + "/article", {
            _id: id,
            title,
            content,
            tags,
            public: isPublic,
            author
        });
    }

    /**
     * Delete an article.
     * @param {string} blogID - The blog ID.
     * @param {string} id - The article ID.
     * @returns {Promise<void>}
     */
    async deleteArticle (blogID, id) {
        return this.execute('delete', '/api/blog/' + blogID + "/article", {
            _id: id,
        });
    }

    // Newsletters
    // ----------------------------------------------------------------------------
    /**
     * List all accessible newsletters of the current client. Users without the
     * newsletter_admin permission will only receive the newsletters they are an
     * editor of.
     * @returns {Promise<Array>} The list of newsletters.
     */
    async getNewsletters () {
        return this.execute('get', '/api/newsletter');
    }

    /**
     * Create a new newsletter, only available for client admins.
     * @param {string} name - The name of the newsletter.
     * @param {Array<string>} editors - The list of editor user IDs.
     * @returns {Promise<Object>} Object with the id of the created newsletter.
     */
    async createNewsletter (name, editors) {
        return this.execute('post', '/api/newsletter', {
            name,
            editors
        });
    }

    /**
     * Get a specific newsletter
     * @param {string} id  - The newsletter ID.
     * @returns {Promise<Object>} The requested newsletter.
     */
    async getNewsletter (id) {
        return this.execute('get', '/api/newsletter/' + id);
    }

    /**
     * Edit a newsletter, only available for client admins.
     * @param {string} id  - The newsletter ID.
     * @param {string} name - The name of the newsletter.
     * @param {Array<string>} editors - The list of editor user IDs.
     * @returns {Promise<Object>} The new state of the newsletter.
     */
    async updateNewsletter (id, name, editors) {
        return this.execute('put', '/api/newsletter/' + id, {
            name,
            editors
        });
    }

    /**
     * Delete a newsletter, only available for client admins.
     * @param {string} id  - The newsletter ID.
     * @returns {Promise<void>}
     */
    async deleteNewsletter (id) {
        return this.execute('delete', '/api/newsletter/' + id);
    }

    /**
     * Join a newsletter.
     * @param {string} id  - The newsletter ID.
     * @param {string} email  - The email of the user that wants to join the newsletter.
     * @returns {Promise<void>}
     */
    async joinNewsletter (id, email) {
        return this.execute('post', '/api/newsletter/join', {
            id, email
        });
    }

    /**
     * Confirm the email address that wants to receive a newsletter.
     * @param {string} token  - The token from the email.
     * @returns {Promise<void>}
     */
    async confirmNewsletter (token) {
        return this.execute('post', '/api/newsletter/confirm', {
            token
        });
    }

    /**
     * Unsubscribe an email address from a newsletter.
     * @param {string} token  - The token from the email.
     * @returns {Promise<void>}
     */
    async unsubscribeFromNewsletter (token) {
        return this.execute('post', '/api/newsletter/unsubscribe', {
            token
        });
    }

    // Pages
    // ----------------------------------------------------------------------------
    /**
     * List all pages of the current client. Only available for page admins.
     * @returns {Promise<Array>} The list of pages.
     */
    async getPages () {
        return this.execute('get', '/api/page');
    }

    /**
     * Create a new page. only available for page admins.
     * @param {string} title - The title of the page.
     * @param {string} slug - The slug of the page.
     * @returns {Promise<void>}
     */
    async createPage (title, slug) {
        return this.execute('post', '/api/page', {
            title, slug
        });
    }

    /**
     * Get a specific page. Only available for page admins.
     * @param {string} id  - The page ID.
     * @returns {Promise<Object>} The requested page.
     */
    async getPage (id) {
        return this.execute('get', '/api/page/' + id);
    }

    /**
     * Edit a page. Only available for page admins.
     * @param {string} id  - The page ID.
     * @param {string} title - The title of the page.
     * @param {string} slug - The slug of the page.
     * @param {boolean} isPublic - Whether or not the page is public.
     * @param {string} content - The slug of the page.
     * @returns {Promise<void>}
     */
    async updatePage (id, title, slug, isPublic, content) {
        return this.execute('put', '/api/page', {
            _id: id,
            title,
            slug,
            public: isPublic,
            content
        });
    }

    /**
     * Delete a page. Only available for page admins.
     * @param {string} id  - The page ID.
     * @returns {Promise<void>}
     */
    async deletePage (id) {
        return this.execute('delete', '/api/page', {
            _id: id
        });
    }

    /**
     * Get a public page by slug from a client.
     * @param {string} clientID  - The ID of the client.
     * @param {string} slug  - The slug of the page.
     * @returns {Promise<Object>} The requested page.
     */
    async getPublicPage (clientID, slug) {
        return this.execute('get', '/api/page/public/' + clientID + '/' + slug);
    }

    // Other
    // ----------------------------------------------------------------------------
    /**
     * Get the download URL for an item.
     * @param {string} id - The item ID.
     * @returns {string} The download URL.
     */
    getDownloadUrl(id) {
        return `${this.getApiBaseUrl()}/api/item/download/${id}`;
    }

    /**
     * Get the download URL for an item attachment.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @returns {string} The attachment download URL.
     */
    getAttachmentDownloadUrl(id, name, index) {
        return `${this.getApiBaseUrl()}/api/item/attachment/${id}/${name}/${index}`;
    }

    /**
     * Get the public download URL for an item.
     * @param {string} id - The item ID.
     * @returns {string} The public download URL.
     */
    getPublicDownloadUrl(id) {
        return `${this.getApiBaseUrl()}/api/item/publicdownload/${id}`;
    }

    /**
     * Get the public download URL for an item attachment.
     * @param {string} id - The item ID.
     * @param {string} name - The attachment name.
     * @param {number} index - The attachment index.
     * @returns {string} The public attachment download URL.
     */
    getPublicAttachmentDownloadUrl(id, name, index) {
        return `${this.getApiBaseUrl()}/api/item/publicattachment/${id}/${name}/${index}`;
    }


}
