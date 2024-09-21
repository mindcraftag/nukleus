"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs        = require("fs");
const path      = require("path");

module.exports = {

    plugins: [],

    scan: function(dirPath, log) {
        if (!dirPath)
            dirPath = __dirname + "/plugins";

        if (log) log.info(`Scanning for plugins in directory ${dirPath}`);
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filepath = path.join(dirPath, file);
            const stat = fs.lstatSync(filepath);
            if (stat.isDirectory()) {
                this.scan(filepath);
            } else {
                const pluginModule = require(filepath);
                if (pluginModule.ignore === true) {
                    if (log) log.info("Ignoring plugin: '" + pluginModule.name + "' of type '" + pluginModule.type + "'");
                } else {
                    if (log) log.info("Found plugin: '" + pluginModule.name + "' of type '" + pluginModule.type + "'");
                    this.addPlugin(pluginModule);
                }
            }
        }
    },

    getPluginTypeContainer: function(typeName) {
        for (const typeContainer of this.plugins) {
            if (typeContainer.name === typeName) {
                return typeContainer;
            }
        }

        return null;
    },

    getOrCreatePluginTypeContainer: function(typeName) {
        var typeContainer = this.getPluginTypeContainer(typeName);
        if (typeContainer)
            return typeContainer;

        typeContainer = {
          name: typeName,
          plugins: []
        };

        this.plugins.push(typeContainer);
        return typeContainer;
    },

    addPlugin: function(plugin) {
        const typeArray = this.getOrCreatePluginTypeContainer(plugin.type);
        typeArray.plugins.push(plugin);
    },

    getStoragePluginByName: function(name) {
        const container = this.getPluginTypeContainer("Storage");
        if (container) {
            for (const plugin of container.plugins) {
                if (plugin.name === name) {
                    return plugin;
                }
            }
        }

        return null;
    },

    getJobPluginByName: function(name) {
        const container = this.getPluginTypeContainer("Job");
        if (container) {
            for (const plugin of container.plugins) {
                if (plugin.name === name) {
                    return plugin;
                }
            }
        }

        return null;
    }
};
