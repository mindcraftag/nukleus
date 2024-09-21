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
const moment      = require('moment');

module.exports = {

  type: "Job",
  name: "Deleted folders cleanup",
  manualStart: false,
  interval: 'hourly',

  process: async function(tools, log) {
    const threshold = moment().subtract(1, 'days');

    const Folder = mongoose.model('Folder');
    const folders = await Folder.find({ deletedAt: { $lt: threshold }}).exec();
    const promises = [];

    for (const folder of folders) {
      log(`Deleting folder after grace period: ${folder.name} (${folder._id})`);
      promises.push(new Promise((resolve, reject) => {
        return Folder.deleteOne({
          _id: folder._id
        }).exec().then(function() {
          resolve();
        });
      }));
    }

    await Promise.all(promises);
  }
};