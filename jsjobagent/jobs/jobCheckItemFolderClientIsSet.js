"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const mailService = nsvc.mailService;

module.exports = {

  type: "Job",
  name: "Check item and folder has client set",
  manualStart: false,
  interval: 'hourly',

  process: async function(tools, log) {

    log("Getting all items from database");
    const Item = mongoose.model('Item');
    const items = await Item.find({
      $or: [
        { client: { $exists: false } },
        { client: null }
      ]
    }).select("name client").exec();

    console.log(`Found ${items.length} items without client:`);
    for (const item of items) {
      console.log(item);
    }

    log("Getting all folders from database");
    const Folder = mongoose.model('Folder');
    const folders = await Folder.find({
      $or: [
        { client: { $exists: false } },
        { client: null }
      ]
    }).select("name client").exec();

    console.log(`Found ${folders.length} folders without client:`);
    for (const folder of folders) {
      console.log(folder);
    }
  }
};