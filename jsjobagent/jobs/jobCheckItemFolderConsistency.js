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

const LOST_AND_FOUND_NAME = "Lost+found";

let clientMap = new Map();
let userMap = new Map();

async function getClientName(clientId) {
  const clientIdString = clientId.toString();
  if (clientMap.has(clientIdString)) {
    return clientMap.get(clientIdString);
  }

  const Client = mongoose.model('Client');
  const client = await Client.findOne({ _id: clientId }).select("name").exec();
  clientMap.set(clientIdString, client.name);
  return client.name;
}

async function getUserName(userId) {
  const userIdString = userId.toString();
  if (userMap.has(userIdString)) {
    return userMap.get(userIdString);
  }

  const User = mongoose.model('User');
  const user = await User.findOne({ _id: userId }).select("name").exec();
  userMap.set(userIdString, user.name);
  return user.name;
}

/**
 * Create a lost and found folder for the client
 * @param client
 * @returns {Promise<*>}
 */
async function getLostAndFoundFolderId(client, systemUserId, log) {
  const Folder = mongoose.model('Folder');
  const folder = await Folder.findOne({
    client: client,
    name: LOST_AND_FOUND_NAME,
    deletedAt: { $exists: false }
  }).select("_id").exec();

  if (folder) {
    return folder._id;
  }

  const clientName = await getClientName(client._id);
  log(` - Creating Lost+Found for client ${clientName} (${client})`);

  const newFolder = new Folder({
    client: client,
    parent: null,
    name: LOST_AND_FOUND_NAME,
    __user: systemUserId
  });

  await newFolder.save({ __user: systemUserId });
  return newFolder._id;
}

async function fixItem(entry, systemUserId, log) {
  const item = entry.item;

  switch(entry.action) {
    case "move to lost+found": {
      log(` - Missing parent folder for item ${item.name}`);
      const lostAndFoundId = await getLostAndFoundFolderId(item.client, systemUserId, log);
      const clientName = await getClientName(item.client._id);
      const userName = await getUserName(item.createdBy);

      entry.client = clientName;
      entry.createdBy = userName;

      let { conflict, finalName } = await nsvc.folderService.isNameConflict(item.name, lostAndFoundId, item.client._id, true);
      if (conflict) {
        log({ severity: "error"}, "Name collision could not be fixed: " + item.name);
      } else {
        item.name = finalName;
        item.folder = lostAndFoundId;
        item.__user = systemUserId;
        await item.save({__user: systemUserId});
        log(`   -> moved to lost+found`);
      }
      break;
    }

    case "correct client": {
      const parentFolder = entry.parent;
      const clientName = await getClientName(item.client._id);
      const parentClientName = await getClientName(parentFolder.client._id);
      const userName = await getUserName(item.createdBy);
      const lostAndFoundId = await getLostAndFoundFolderId(parentFolder.client, systemUserId, log);

      entry.client = parentClientName + " (was in " + clientName + ")";
      entry.createdBy = userName;

      log(` - Item '${item.name}' in client '${clientName}(${item.client})' has parent folder '${parentFolder.name}' in different client: '${parentClientName}(${parentFolder.client})'. Was created by ${userName} at ${item.createdAt}`);

      item.folder = lostAndFoundId;
      item.client = parentFolder.client;
      item.__user = systemUserId;
      await item.save({ __user: systemUserId });
      break;
    }

    default:
      log(" - Unimplemented action: " + JSON.stringify(entry, null, 2));
      break;
  }
}

async function fixFolder(entry, systemUserId, log) {
  const folder = entry.folder;

  switch(entry.action) {
    case "move to lost+found": {
      log(` - Missing parent folder for folder ${folder.name}`);
      const lostAndFoundId = await getLostAndFoundFolderId(folder.client, systemUserId, log);
      const clientName = await getClientName(folder.client._id);
      const userName = await getUserName(folder.createdBy);

      entry.client = clientName;
      entry.createdBy = userName;

      folder.parent = lostAndFoundId;
      folder.__user = systemUserId;
      await folder.save({ __user: systemUserId });
      log(`   -> moved to lost+found`);
      break;
    }

    case "correct client": {
      const parentFolder = entry.parent;
      const clientName = await getClientName(folder.client._id);
      const parentClientName = await getClientName(parentFolder.client._id);
      const userName = await getUserName(folder.createdBy);
      const lostAndFoundId = await getLostAndFoundFolderId(parentFolder.client, systemUserId, log);

      entry.client = parentClientName + " (was in " + clientName + ")";
      entry.createdBy = userName;

      log(` - Folder '${folder.name}' in client '${clientName}(${folder.client})' has parent folder '${parentFolder.name}' in different client: '${parentClientName}(${parentFolder.client})'. Was created by ${userName} at ${folder.createdAt}`);

      folder.client = parentFolder.client;
      folder.parent = lostAndFoundId;
      folder.__user = systemUserId;
      await folder.save({ __user: systemUserId });
      break;
    }

    default:
      log(" - Unimplemented action: " + JSON.stringify(entry, null, 2));
      break;
  }
}

async function validateFolder(folder, results, log, foldersMap) {

  if (!foldersMap.has(folder.parent.toString())) {
    // If the parent folder is null, it is completely missing. We need to move the folder
    // to the client's lost and found folder.
    // -----------------------------------------------------------------------------------
    if (folder.client) {
      results.push({
        folder: folder,
        parent: folder.parent,
        action: "move to lost+found"
      });
    } else {

      log(`   -> client is null. skipping!`);

      results.push({
        folder: folder,
        parent: folder.parent,
        action: "none. parent folder is missing and client is null"
      });
    }
  }
  else {
    const parentFolder = foldersMap.get(folder.parent.toString());

    // The parent folder was found
    // -----------------------------------------------------------------------------------
    if (!parentFolder.client.equals(folder.client)) {
      results.push({
        folder: folder,
        parent: parentFolder,
        action: "correct client"
      });
    }

    if (parentFolder.parent) {
      await validateFolder(parentFolder, results, log, foldersMap);
    }
  }
}

async function validateItem(item, results, log, foldersMap) {

  // if the item has no folder set, it is in the root folder.
  // -----------------------------------------------------------------------------------
  if (!item.folder)
    return;

  if (!foldersMap.has(item.folder.toString())) {
    // If the parent folder is null, it is completely missing. We need to move the item
    // to the client's lost and found folder.
    // -----------------------------------------------------------------------------------
    if (item.client) {
      results.push({
        item: item,
        parent: item.folder,
        action: "move to lost+found"
      });
    }
    else {
      results.push({
        item: item,
        parent: item.folder,
        action: "none. parent folder is missing and client is null"
      });
    }
  }
  else {
    const parentFolder = foldersMap.get(item.folder.toString());

    if (!parentFolder.client.equals(item.client)) {
      results.push({
        item: item,
        parent: parentFolder,
        action: "correct client"
      });
    }

    if (parentFolder.parent) {
      await validateFolder(parentFolder, results, log, foldersMap);
    }
  }
}

module.exports = {

  type: "Job",
  name: "Check item and folder consistency",
  manualStart: false,
  interval: 'hourly',

  process: async function(tools, log) {

    log("Getting all items from database");
    const Item = mongoose.model('Item');
    const items = await Item.find({ deletedAt: { $exists: false }}).select("name folder client createdBy createdAt").exec();

    log("Getting all folders from database");
    const Folder = mongoose.model('Folder');
    const folders = await Folder.find({ deletedAt: { $exists: false }}).select("name parent client createdBy createdAt").exec();

    const foldersMap = new Map();
    for (const folder of folders) {
      foldersMap.set(folder._id.toString(), folder);
    }

    log("Checking for inconsistencies in clients");
    const results = [];
    const promises = [];
    for (const item of items) {
      promises.push(validateItem(item, results, log, foldersMap));
    }

    await Promise.all(promises);

    log(`Found ${results.length} client inconsistencies. Trying to fix...`);
    clientMap = new Map();
    userMap = new Map();

    const movedElements = [];

    for (const result of results) {
      if (result.item) {
        await fixItem(result, tools.getSystemUserId(), log);
        movedElements.push({
          _id: result.item._id,
          name: result.item.name,
          createdAt: result.item.createdAt,
          createdBy: result.createdBy,
          client: result.client
        });
      } else {
        await fixFolder(result, tools.getSystemUserId(), log);
        movedElements.push({
          _id: result.folder._id,
          name: result.folder.name,
          createdAt: result.folder.createdAt,
          createdBy: result.createdBy,
          client: result.client
        });
      }
    }

    if (movedElements.length) {
      mailService.createAdminMail("itemfolderclientconsistencyreport", {
        title: `Nukleus item/folder/client consistency report`,
        movedElements: movedElements
      });
    }

    log("Done.");
  }
};
