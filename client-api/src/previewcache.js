"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default class NkPreviewCache {

    constructor(nkclient) {
        this.nkclient = nkclient;
        this.cache = new Map();
    }

    async get(itemId, index) {
        const key = `${itemId}_${index}`;
        const _this = this;

        let promise = this.cache.get(key);
        if (!promise) {
            try {
                promise = new Promise(async (resolve) => {
                    try {
                        const attachment = await _this.nkclient.downloadAttachmentPOP(itemId, "preview", index);
                        const objectUrl = URL.createObjectURL(attachment.blob);
                        resolve(objectUrl);
                    }
                    catch(err) {
                        console.error(err);
                        resolve(null);
                    }
                })
                this.cache.set(key, promise);
            }
            catch(err) {
                console.error(err);
            }
        }
        return promise;
    }

}

