"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs            = require('fs');
const WebSocket     = require('ws');
const axios         = require('axios');
const sysinfo       = require('../tools/sysinfo');
const logger        = require('../tools/logger');
const EventEmitter  = require('../tools/eventEmitter').EventEmitter;
const config        = require('../config');
const common        = require('../common');

// A JobAgent can throw a RejectionError to indicate that it refused to process
// a job and threw this error on purpose.
class RejectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "RejectionError";
  }
}

class JobAgent extends EventEmitter {

    constructor(jobs, options) {
        super();

        this.jobs = jobs;
        this.plugins = null;
        this.pluginsMap = null;
        this.options = options || {};
        this.registerInfo = null;
        this.agentId = null;

        this.options.agentPrefix = this.options.agentPrefix || "";
        this.options.agentType = this.options.agentType || "JobAgent";
        this.options.agentVersion = this.options.agentVersion || "?";
        this.options.nukleusToken = this.options.nukleusToken || (config.jobsystem ? config.jobsystem.nukleus_token : "");

        if (!this.options.jobSystemUrl) {
            if (config.jobsystem && config.jobsystem.nukleus_jobs_register_url)
                this.options.jobSystemUrl = config.jobsystem.nukleus_jobs_register_url;
            else
                this.options.jobSystemUrl = "https://jobs.nukleus.cloud/api/register";
        }

        if (!this.options.jobSystemWsUrl) {
            if (config.jobsystem && config.jobsystem.nukleus_jobs_ws_url)
                this.options.jobSystemWsUrl = config.jobsystem.nukleus_jobs_ws_url;
            else
                this.options.jobSystemWsUrl = "wss://jobs.nukleus.cloud/api/ws";
        }

        if (this.options.agentIdFile) {
            if (fs.existsSync(this.options.agentIdFile)) {
                this.agentId = fs.readFileSync(this.options.agentIdFile, 'utf8');
            }
        }
    }

    _init() {

        // Create plugin information to send to the jobsystem
        // ----------------------------------------------------------------------------------
        const prefix = this.options.agentPrefix.length ? this.options.agentPrefix + ":" : "";

        this.plugins = this.jobs.map(x => { return {
            name: prefix + x.name.camelize(),
            displayName: x.name,
            manualStart: x.manualStart,
            interval: x.interval,
            cronExp: x.cronExp,
            query: x.query,
            timeOffset: x.timeOffset,
            watch: x.watch,
            parameters: x.parameters,
            contentTypes: x.contentTypes,
            types: x.types,
            timeout: x.timeout,
            elementMode: x.elementMode
        }});

        this.pluginsMap = new Map();
        for (const plugin of this.plugins) {
            for (const job of this.jobs) {
                if (plugin.displayName === job.name) {
                    this.pluginsMap.set(plugin.name, job);
                }
            }
        }

        logger.info(`Found ${this.plugins.length} job plugins`);

        this.registerInfo = {
            id: this.agentId,
            jobs: this.plugins,
            name: this.options.agentName,
            type: this.options.agentType,
            version: this.options.agentVersion,
            capabilities: {
                restart: true,
                sysinfo: true
            }
        };
    }

    /**
     * Register at Nukleus Job System
     * @returns {Promise<boolean>}
     * @private
     */
    async _register() {
        try {
            logger.info("Trying to register at job system...");
            const regResult = await axios({
                method: "post",
                url: this.options.jobSystemUrl,
                data: this.registerInfo,
                headers: {
                    "x-access-token": this.options.nukleusToken
                }
            });

            this.agentId = null;
            if (regResult.data) {
                if (regResult.data.result === "failed")
                    throw regResult.data.error;
                else
                    this.agentId = regResult.data.data;
            } else {
                throw "No data received after registration!";
            }

            if (this.options.agentIdFile) {
                fs.writeFileSync(this.options.agentIdFile, this.agentId);
            }

            console.info("Registered successfully with Id: " + this.agentId);
            return true;
        }
        catch(err) {
            logger.error("Error registering: " + err);
            if (err.response) {
                logger.error(err.response.data);
            }
        }

        return false;
    }

    /**
     * Connect to jobsystem websocket and run the event loop
     * @returns {Promise<unknown>}
     * @private
     */
    _connectAndRun() {
        const _this = this;
        return new Promise((resolve, reject) => {

            // Connect to jobsystem websocket
            // ----------------------------------------------------------------------------------
            logger.info("Connecting to job system websocket.");
            _this.ws = new WebSocket(this.options.jobSystemWsUrl);

            _this.ws.on('open', function() {
                _this.ws.send(JSON.stringify({
                    type: "login",
                    id: _this.agentId
                }));
            });

            _this.ws.on('close', function() {
                logger.warn("Socket closed!");
                _this.ws.terminate();
                resolve();
            });

            _this.ws.on('message', async function(data) {
                console.log("RECEIVED: " + data);
                const msg = JSON.parse(data);

                if (msg.command) {
                    switch (msg.command) {
                        case "exec": {
                            _this._commandExec(msg).catch(function(err) {
                                logger.error(err);
                                _this.sendFailed(err.toString());
                            });
                            break;
                        }

                        case "sysinfo": {
                            _this._commandSysInfo().catch(function(err) {
                                logger.error(err);
                            });
                            break;
                        }

                        case "restart": {
                            _this._commandRestart();
                            break;
                        }

                        default: {
                            logger.warn("Unknown command received: " + msg.command);
                            break;
                        }
                    }
                }
            });
        });
    }

    sendSuccess(log) {
        this.ws.send(JSON.stringify({
            type: "result",
            result: "success",
            log: log
        }));
    }

    sendProgress(percentage) {
        this.ws.send(JSON.stringify({
            type: "progress",
            progress: percentage
        }));
    }

    sendData(type, data) {
        this.ws.send(JSON.stringify({
            type: type,
            data: data
        }));
    }

    sendFailed(error) {
        this.ws.send(JSON.stringify({
            type: "result",
            result: "failed",
            error: error
        }));
    }

    async _commandExec(msg) {
        const jobType = msg.type;
        if (this.pluginsMap.has(jobType)) {
            const plugin = this.pluginsMap.get(jobType);
            logger.debug("Executing job: " + jobType);

            try {
                const result = this.$emitNoCatch('exec', msg, plugin);
                if (result !== false && result.then) {
                    await result;
                }
            } catch(err) {
                const errorString = err ? err.toString() : "";
                if (err instanceof RejectionError) {
                    // RejectionErrors indicate that the JobAgent refused to process the job and rejected on purpose.
                    // Since this is expected, we won't log it to Mezmo.
                    this.sendFailed(errorString);
                } else {
                    // The logger can't stringify an Error object, but we can pass
                    // the errorString instead so we still get a readable eror in Mezmo.
                    logger.error(errorString, err ? err.stack : "");
                    this.sendFailed(errorString);
                }
            }

            logger.debug("Done with job: " + jobType);
        } else {
            this.sendFailed("job type not found: " + jobType);
        }
    }

    async _commandSysInfo() {
        if (!this.$emitNoCatch('sysinfo')) {

            const cpuInfo = await sysinfo.getCpuInfo();
            const memoryInfo = await sysinfo.getMemoryInfo();
            const diskInfo = await sysinfo.getDiskInfo();

            // remove individual CPU information
            cpuInfo.cpus = undefined;

            this.sendData("sysinfo", {
                cpuInfo: cpuInfo,
                memoryInfo: memoryInfo,
                diskInfo: diskInfo
            });
        }
    }

    _commandRestart() {
        if (!this.$emitNoCatch('restart')) {
            logger.info("Agent was instructed to restart. Quitting...");
            process.exit(0);
        }
    }

    async run() {
        this._init();
        while(true) {
            if (await this._register()) {
                await this._connectAndRun();
            }
            await common.sleep(5000);
        }
    }

    disconnect() {
        this.ws.terminate();
    }
}

exports.RejectionError = RejectionError;
exports.createJobAgent = function(jobs, options) {
    return new JobAgent(jobs, options);
}

