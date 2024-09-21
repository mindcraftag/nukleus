"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import NkStorage, {NkStorageTypeFileSystem} from "./storage";

export default class NkThumbCache extends NkStorage {

    constructor(nkclient) {
        super("nukleus", "thumbs", NkStorageTypeFileSystem);

        if (!nkclient)
            throw "A nukleus client needs to be passed.";

        this.nkclient = nkclient;

        this.init().then(function() {
            console.log("Thumbcache ready.");
        })
    }

    async get(id, size, hash, timestamp) {
        if (!size)
            throw "Cannot retrieve item thumbnail from cache without knowing size!";

        //console.log("Getting thumb for ", id, size, hash, timestamp);

        let entry = await this._get(id, "application/json");
        if (entry && entry.hash === hash && entry.timestamp === timestamp) {
            for (const thumbnail of entry.thumbnails) {
                if (thumbnail.size === size) {
                    return thumbnail.data;
                }
            }

            const data = await this.nkclient.getThumbnail(size, id);
            entry.thumbnails.push({
                size: size,
                data: data
            });
            await this._set(id, entry);
            return data;
        }

        let data;
        try {
            data = await this.nkclient.getThumbnail(size, id);
        } catch(err) {
            // thumbnail does not exist. We'll still create the empty entry below or we will keep
            // trying to fetch the icon. Once hash or timestamp change, we can try again
        }

        if (hash || timestamp) {
            entry = {
                id: id,
                hash: hash,
                timestamp: timestamp,
                thumbnails: [{
                    size: size,
                    data: data
                }]
            };
            await this._set(id, entry);
        }
        return data;
    }

}

