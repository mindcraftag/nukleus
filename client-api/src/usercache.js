"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default class NkUserCache {

    constructor(nkclient) {
        this.nkclient = nkclient;
        this.cache = new Map();
    }

    async resolve(id) {
        let promise = this.cache.get(id);
        if (!promise) {
            try {
                promise = this.nkclient.getUserPublicInfo(id, this.nkclient.requestClientId, 32);
                this.cache.set(id, promise);
            }
            catch(err) {
                console.error(err);
            }
        }
        return promise;
    }

}

