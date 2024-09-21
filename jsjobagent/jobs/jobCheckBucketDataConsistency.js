"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const moment      = require("moment");
const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const fileStorage = nsvc.fileStorage;
const mailService = nsvc.mailService;

module.exports = {

  type: "Job",
  name: "Check bucket data consistency",
  manualStart: false,
  interval: 'daily',

  process: async function(tools, log) {

    log("Getting all clients from database");
    const Client = mongoose.model('Client');
    const clients = await Client.find().select("_id name storages currentPlan").populate('currentPlan').exec();
    const clientsMap = new Map();
    for (const client of clients) {
      clientsMap.set(client._id.toString(), client.name);
    }

    // Get all items from all buckets
    // ----------------------------------------------------------------------
    const storages = await fileStorage.getStorages();
    const buckets = [];

    for (const storage of storages) {
      const bucket = await fileStorage.enumerate(storage._id);
      const keyMap = new Map();
      const additionalKeyMap = new Map();
      const tempKeyMap = new Map();

      for (const entry of bucket) {
        // Temporary files need to be treated differently than normal files,
        // because they are not expected to be available on all storages.
        if (entry.startsWith("temp_")) {
          tempKeyMap.set(entry, true);
        } else {
          keyMap.set(entry, true);
          additionalKeyMap.set(entry, true);
        }
      }

      buckets.push({
        id: storage._id.toString(),
        name: storage.name,
        keyMap: keyMap,
        tempKeyMap: tempKeyMap,
        missingItems: [],
        additionalKeys: additionalKeyMap
      });
    }

    // Do the checks per client, since every client has a different storages configuration
    // not all clients will store their files in all buckets, some might only store in one for example.
    for (const client of clients) {

      // Create a map of buckets for the client. Those buckets are the ones, we should store
      // its items in.
      // ----------------------------------------------------------------------
      const clientBuckets = new Map();
      for (const storage of client.storages) {
        clientBuckets.set(storage.toString(), true);
      }
      for (const storage of client.currentPlan.storages) {
        clientBuckets.set(storage.toString(), true);
      }

      // Get all items from database
      // ----------------------------------------------------------------------
      log("Getting all items from database");
      const Item = mongoose.model('Item');
      const items = await Item.find({
        client: client,
        $or: [
          { filesize: { $exists: true } },
          { "attachments.0": { $exists: true } }
        ]
      }).select("_id name client createdAt attachments filesize deletedAt").exec();

      log(` - Found ${items.length} items for client ${client.name}`);
      const itemMap = new Map();
      const itemMapNonDeleted = new Map();
      for (const item of items) {
        const id = item._id.toString();
        const itemIsDeleted = item.deletedAt !== undefined && item.deletedAt !== null;

        if (item.filesize) {
          const value = {
            key: id,
            item: item
          };

          itemMap.set(id, value);
          if (!itemIsDeleted) {
            itemMapNonDeleted.set(id, value);
          }
        }

        if (Array.isArray(item.attachments)) {
          for (const attachment of item.attachments) {
            const key = `${id}_${attachment.name}_${attachment.index}`;
            const value = {
              key: key,
              item: item,
              attachment: attachment
            };

            itemMap.set(key, value);
            if (!itemIsDeleted) {
              itemMapNonDeleted.set(key, value);
            }
          }
        }
      }

      // Check what files might be missing from bucket
      // ----------------------------------------------------------------------
      for (const entry of itemMapNonDeleted.values()) {
        for (const bucket of buckets) {
          if (clientBuckets.has(bucket.id)) {
            if (!bucket.keyMap.has(entry.key)) {
              let name = entry.item.name;

              if (entry.attachment) {
                name += ` Attachment ${entry.attachment.name}/${entry.attachment.index}`;
              }

              bucket.missingItems.push({
                key: entry.key,
                name: name,
                client: clientsMap.get(entry.item.client.toString()),
                createdAt: moment(entry.item.createdAt).format()
              });
            } else {
              bucket.additionalKeys.delete(entry.key);
            }
          }
        }
      }
    }

    // Check if temporary files exist that should have been removed
    // ----------------------------------------------------------------------
    for (const bucket of buckets) {
      for (const key of bucket.tempKeyMap.keys()) {
        const id = key.substring("temp_".length);
        // check if the item with this id has a running upload
        const item = await Item.findOne({
          _id: id,
          deletedAt: { $exists: false },
        }).exec();

        if (!item || !item.uploadHeartbeat) {
          // Item does not exist anymore or has no running upload.
          bucket.additionalKeys.set(key, true);
          continue;
        }

        const cutoff = 10 * 60 * 1000; // 10 minutes
        const lastHeartbeat = item.uploadHeartbeat.getTime();
        const diff = Date.now() - lastHeartbeat;
        if (diff > cutoff) {
          // Item has not been updated for 10 minutes.
          bucket.additionalKeys.set(key, true);
        }
      }
    }

    // Log findings
    // ----------------------------------------------------------------------
    const results = [];
    for (const bucket of buckets) {
      log(`Bucket ${bucket.name} has ${bucket.missingItems.length} missing files and ${bucket.additionalKeys.size} additional files.`);

      for (const item of bucket.missingItems) {
        log(` - ${item.name} [${item.key}] from client: ${item.client}`);
      }

      results.push({
        name: bucket.name,
        missingItems: bucket.missingItems,
        additionalKeys: Array.from(bucket.additionalKeys.keys())
      })
    }

    // Write to key/value store
    // ----------------------------------------------------------------------
    const KeyValuePair = mongoose.model('KeyValuePair');
    await KeyValuePair.findOneAndUpdate({ key: 'dataconsistencyreport' }, { value: results }, { upsert: true });

    // Create mail
    // ----------------------------------------------------------------------
    mailService.createAdminMail("dataconsistencyreport", {
      title: `Nukleus data consistency report`,
      results: results
    });
  }
};
