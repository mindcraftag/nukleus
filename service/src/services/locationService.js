"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const groupService     = require('./groupService');
const clientService    = require('./clientService');
const mongoose         = require('@mindcraftgmbh/nukleus-model').mongoose;

// This function takes in a collection name and a query object
// and returns the non-deleted items from that collection that match the query.
async function findFromCollection(collectionName, query) {
  const Collection = mongoose.model(collectionName);
  const items = await Collection.find({
    ...query,
    deletedAt: { $exists: false }
  }).exec();

  return items;
}

async function findSubFolders(folderId) {
  return await findFromCollection("Folder", { parent: folderId });
}

async function findAllItems(parentFolder) {
  return await findFromCollection("Item", { folder: parentFolder._id });
}

async function findAllConversations(item) {
  return await findFromCollection("Conversation", { parent: item._id, parentType: "item" });
}

// Recursively search through folders to find all subfolders of a folder.
async function findAllFolders(parentFolderId) {
  let folders = await findSubFolders(parentFolderId);
  for (const folder of folders) {
    const subFolders = await findAllFolders(folder._id);
    folders = folders.concat(subFolders);
  }
  return folders;
}

// Set the location of all folders, items and conversations in a folder.
async function setLocation(parentFolder, country, withConversationEntries) {
  const allFolders = await findAllFolders(parentFolder._id);

  parentFolder.location = country;
  await parentFolder.save();

  let items = await findAllItems(parentFolder);
  for (const folder of allFolders) {
    items = items.concat(await findAllItems(folder))
    folder.location = country;
    await folder.save();
  }

  let conversations = [];
  for (const item of items) {
    conversations = conversations.concat(await findAllConversations(item));
    item.location = country;
    await item.save();
  }

  for (const conversation of conversations) {
    conversation.location = country;
    await conversation.save();
  }

  if (withConversationEntries) {
    // Find all conversation entries that belong to the conversations we found earlier.
    const allConversationEntries = await findFromCollection("ConversationEntry", { conversation: { $in: conversations.map(c => c._id) } });
    for (const entry of allConversationEntries) {
        entry.location = country;
        await entry.save();
    }
  }

  return;
}

// Set the location of a group and it's objects to the specified country.
exports.setGroupLocation = async function (groupId, country) {
  const Group = mongoose.model("Group");
  const group = await Group.findOne({
    _id: groupId,
  }).exec();

  if (!group) {
    throw new Error(`Group with id ${groupId} not found.`);
  }

  group.location = country;
  group.lastLocationSwitchAt = new Date();
  await group.save();

  const groupFolder = await groupService.createGroupFolder(group.client, groupId);
  await setLocation(groupFolder, country, false);
}

// Set the location of a user and it's objects to the specified country.
exports.setUserLocation = async function (userId, country) {
  const User = mongoose.model("User");
  const user = await User.findOne({
    _id: userId,
  }).exec();

  if (!user) {
    throw new Error(`User with id ${userId} not found.`);
  }

  user.location = country;
  user.lastLocationSwitchAt = new Date();
  user.nextLocation = undefined;
  await user.save();

  // The user may have multiple memberships in different clients.
  // We need to set the location of all of them.
  for (const membership of user.memberships) {
    const userFolder = await clientService.createUserHomeFolder(membership.client, userId);
    await setLocation(userFolder, country, true);
  }
}

// Set the location of a folder to the specified country.
exports.setFolderLocation = async function (folder, country) {
  await setLocation(folder, country, false);
}

exports.findAllFolders = findAllFolders;
