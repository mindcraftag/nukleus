"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fileType  = require('file-type');
const mmm       = require('mmmagic');
const path      = require('path');
const Magic     = mmm.Magic;

const MAGIC_RADIANCE_HDR = Buffer.from("#?RADIANCE");
const MAGIC_DRACO = Buffer.from("DRACO");
const MAGIC_KIWI = Buffer.from("KIWI");
const MAGIC_NUKLEUS_PACKAGE = Buffer.from("LUMIPACK");
const MAGIC_PLY = Buffer.from("ply\n");
const MAGIC_FBX = Buffer.from('Kaydara FBX Binary  \0');

exports.MAGIC_NUKLEUS_PACKAGE = MAGIC_NUKLEUS_PACKAGE;

function bufferCompare(source, search) {
    for (let i=0; i<search.length; i++) {
        if (source[i] !== search[i])
            return false;
    }
    return true;
}

function refineContentType(contentType, filename) {
    // we might have a content type already, but it might be misleading.
    // also take filename into account.
    const fileExt = path.extname(filename).toLowerCase();

    if (contentType === "application/zip" && fileExt === ".usdz") {
        return "model/vnd.usdz+zip";
    }

    if (contentType && contentType.startsWith("text/")) {
        switch(fileExt) {
            case ".obj":
                return "model/obj";
            case ".lua":
                return "text/x-lua";
            case ".glsl":
                return "text/x-glsl";
            case ".anim":
                return "text/x-animation";
        }
    }

    if (contentType === "application/octet-stream") {
        switch(fileExt) {
            case ".splat":
                return "model/splat";
            case ".lua":
                return "text/x-lua";
        }
    }

    return contentType;
}

exports.getContentType = async function(buffer, filename) {
    return new Promise((resolve, reject) => {

        // try File Type library to check mime type
        // ---------------------------------------------------------------------------
        const type = fileType(buffer);
        if (type) {
            resolve(refineContentType(type.mime, filename));
            return;
        }

        // File Type library did not get the type, let's do some checks of our own.
        // ---------------------------------------------------------------------------
        if (bufferCompare(buffer, MAGIC_RADIANCE_HDR)) {
            resolve("image/vnd.radiance");
            return;
        } else if (bufferCompare(buffer, MAGIC_DRACO)) {
            resolve("model/draco");
            return;
        } else if (bufferCompare(buffer, MAGIC_KIWI)) {
            resolve("application/vnd.mindcraft.kiwi");
            return;
        } else if (bufferCompare(buffer, MAGIC_NUKLEUS_PACKAGE)) {
            resolve("application/vnd.nukleus.npackage");
            return;
        } else if (bufferCompare(buffer, MAGIC_PLY)) {
            resolve("model/ply");
            return;
        } else if (bufferCompare(buffer, MAGIC_FBX)) {
            resolve("model/fbx");
            return;
        }

        // We still fail, let's try mmmagic
        // ---------------------------------------------------------------------------
        const magic = new Magic(mmm.MAGIC_MIME_TYPE);
        magic.detect(buffer, function(err, result) {
           if (err)
               reject(err);
           else
               resolve(refineContentType(result, filename));
        });
    });
};
