"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const si = require('systeminformation');

exports.getCpuInfo = async function() {
    const info = await si.currentLoad();
    //console.log(info);
    return info;
}

exports.getMemoryInfo = async function() {
    const info = await si.mem();
    //console.log(info);
    return info;
}

exports.getDiskInfo = async function() {
    const info = await si.fsSize();
    //console.log(info);
    return info;
}
