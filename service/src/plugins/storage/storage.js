"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

class Storage {

    async storeData(name, bufferOrStream) {}
    async retrieveData(name, start, end) {}
    async deleteData(name) {}
    async copyData(name, destName) {}
    async enumerate() {}
}

module.exports = Storage;
