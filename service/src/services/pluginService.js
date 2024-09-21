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

exports.getPlugins = async function() {
    const Plugin = mongoose.model('Plugin');
    const plugins = await Plugin.find().select("name alwaysEnabled needsSuperadmin permissionsRequired mounts").exec();
    return plugins;
};
