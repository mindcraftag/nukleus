"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const security            = require("../tools/security");
const folderService       = require("./folderService");
const aclTools            = require("../tools/aclTools");
const mongoose            = require('@mindcraftgmbh/nukleus-model').mongoose;
const clientService       = require("./clientService");
const config              = require('../config');

const {
  QuotaExceededError,
  ValidationError
} = require("../exception");
const { paginateQuery, parseItemsPerPage } = require("../tools/paging");

exports.isNameConflict = async function(name, client) {
  const Group = mongoose.model('Group');
  const existsGroup = await Group.existsByNameAndClient(name, client);
  return existsGroup;
};

exports.getUsersOfGroup = async function(id, fields) {
  const User = mongoose.model('User');
  const userQuery = User.find();
  userQuery.where("deletedAt").exists(false);
  userQuery.where("memberships.groups").equals(id);

  if (fields)
    userQuery.select(fields);

  const users = await userQuery.exec();
  return users;
}

exports.getGroup = async function(id, fields) {
  const Group = mongoose.model('Group');
  const query = Group.findOne({ _id: id, deletedAt: { $exists: false }});
  if (fields) {
    query.select(fields);
  }
  const group = await query.exec();
  return group;
}

exports.existsGroup = async function(groupId, clientId) {
  const Group = mongoose.model('Group');
  const group = await Group.findOne({
    _id: groupId,
    client: clientId,
    deletedAt: { $exists: false }
  }).select("_id").exec();
  return !!group;
}

exports.createGroup = async function(name, clientId, hasFolder, location) {

  // Check for existance of other group with that name
  // -----------------------------------------------------
  const conflict = await exports.isNameConflict(name, clientId);
  if (conflict) {
    throw new ValidationError("Group with that name already exists");
  }

  // Create group
  // -----------------------------------------------------
  const Group = mongoose.model('Group');
  const group = new Group({
    name: name,
    location: location,
    client: clientId,
    hasFolder: hasFolder
  });

  await group.save();

  // Create a folder for the group
  // -----------------------------------------------------
  if (hasFolder) {
    await exports.createGroupFolder(clientId, group._id);
  }

  return group;
}

exports.getGroupFolder = async function(clientId, groupId) {

  const systemUserId = security.getSystemUserId();
  if (!systemUserId)
    throw "Cannot create group home folder. No system user id available.";

  // Ensure that the "Groups" folder exists in the system location.
  const groupsFolderId = await folderService.ensureFolder(clientId, null, "Groups", systemUserId, false, true, true, config.systemLocation);
  if (!groupsFolderId)
    throw "Cannot create groups folder.";

  const Folder = mongoose.model('Folder');
  const folder = await Folder.findOne({
    client: clientId,
    parent: groupsFolderId,
    name: groupId.toString(),
    deletedAt: { $exists: false }
  }).select("_id").exec();

  if (!folder)
    return null;

  return folder._id;
}

exports.createGroupFolder = async function(clientId, groupId) {

  const Group = mongoose.model('Group');
  const group = await Group.findOne({
    _id: groupId,
    client: clientId,
    deletedAt: { $exists: false }
  }).select("hasFolder location").exec();

  if (!group) {
    throw new ValidationError("Group does not exist.");
  }

  if (!group.hasFolder)
    return null;

  // Create user home folder and the parent Users folder if it does not exist yet
  // --------------------------------------------------------------------------------
  const systemUserId = security.getSystemUserId();
  if (!systemUserId)
    throw "Cannot create group home folder. No system user id available.";

  // Ensure that the "Groups" folder exists in the system location.
  const groupsFolderId = await folderService.ensureFolder(clientId, null, "Groups", systemUserId, false, true, true, config.systemLocation);
  if (!groupsFolderId)
    throw "Cannot create groups folder.";

  // Create the groups folder in the location of the group.
  const groupFolderId = await folderService.ensureFolder(clientId, groupsFolderId, groupId.toString(), systemUserId, false, true, false, group.location);
  if (!groupFolderId)
    throw "Cannot create group home folder.";

  const Folder = mongoose.model("Folder");
  const folder = await Folder.findById(groupFolderId).exec();
  if (!folder)
    throw "Group home folder created but cannot find it.";

  // Set permissions on new home folder
  // --------------------------------------------------------------------------------

  // user may read and write
  aclTools.addAcl(folder, {
    user: null,
    group: groupId,
    can: ["read", "write", "publish"]
  });

  // anybody else may do nothing
  aclTools.addAcl(folder, {
    user: null,
    group: null,
    can: []
  });

  folder.__user = systemUserId;
  await folder.save({ __user: systemUserId });

  return folder;
};

/**
 * Return a group by its name and clientId
 * @param name
 * @param clientId
 * @returns {Promise<Document<unknown, any, unknown> & Require_id<unknown>>}
 */
exports.getGroupByName = async function(name, clientId) {
  const Group = mongoose.model('Group');
  const group = await Group.findOne({ name: name, client: clientId }).exec();
  return group;
}

exports.getAvatar = async function(groupId, size, clientId, omitInfo) {

  let filter = {
    _id: groupId,
    deletedAt: { $exists: false }
  };

  if (clientId) {
    // only return the avatar if the user is member of that client
    filter["client"] = clientId;
  }

  let select = "name";
  if (!omitInfo) {
    select += " avatar";
  }

  const Group = mongoose.model('Group');
  const group = await Group.findOne(filter).select(select).exec();

  if (!group)
    return null;

  let avatar = null;

  if (Array.isArray(group.avatar)) {
    for (const a of group.avatar) {
      if (a.size <= size || avatar === null)
        avatar = a;
    }
  }

  const nameParts = group.name.split(" ").filter(x => x.length > 0);
  const initials = nameParts.map(x => x[0]).join("").toUpperCase();

  let result = {
    avatar: avatar ? avatar.data : null,
    initials: initials
  };

  if (!omitInfo) {
    result.name = group.name;
  }

  return result;
};

/**
 * Checks if the group has enough quota left to add the specified data length
 * @param groupId
 * @param clientId
 * @param dataLength
 * @returns {Promise<void>}
 */
exports.verifyQuota = async function(groupId, clientId, dataLength) {

  const clientDefaultGroupStorageQuotaGb = await clientService.getDefaultGroupStorageQuota(clientId);
  if (!clientDefaultGroupStorageQuotaGb)
    return;

  const Group = mongoose.model('Group');
  const group = await Group.findOne({
    _id: groupId,
    client: clientId,
    deletedAt: { $exists: false }
  }).select("storageQuotaGb usedStorageQuotaGb").exec();

  if (!group) {
    throw new ValidationError('Quota group not found!');
  }

  const storageQuotaGb = group.storageQuotaGb || clientDefaultGroupStorageQuotaGb;
  const GB_TO_BYTES = 1024 * 1024 * 1024;
  const storageQuota = storageQuotaGb * GB_TO_BYTES;
  const storageQuotaUsed = (group.usedStorageQuotaGb * GB_TO_BYTES) || 0;

  if ((storageQuotaUsed + dataLength) > storageQuota)
    throw new QuotaExceededError();
}

exports.getGroupsPaginated = async function (clientId, itemsPerPageStr, nextObjectID) {
  const Group = mongoose.model("Group");
  const query = Group.find();
  const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

  query.where("deletedAt").exists(false);
  query.where("client").equals(clientId);
  query.sort({_id: "descending"});
  query.limit(itemsPerPage + 1);

  if (nextObjectID !== null) {
    query.where("_id").lte(nextObjectID);
  }

  const groups = await query.exec();
  let next = null;
  if (groups.length === itemsPerPage + 1) {
    next = groups[itemsPerPage]._id;
    groups.pop();
  }

  return {
    groups: groups,
    nextObjectID: next
  };
};

/**
 * Queries all groups and filters based on searchQuery and clientID.
 * Pagination is achieved by supplying the cursor of a previous response.
 * @param {*} searchQuery A string that needs to be part of the name of the groups that are returned.
 * @param {*} clientID Only the groups that belong to this client are returned.
 * @param {*} cursor A cursor returned from a previous response to continue on the next page.
 * @param {*} itemsPerPageStr How many items should be included on one page.
 */
exports.queryGroups = async function(searchQuery, clientID, cursor, itemsPerPageStr) {
  const Group = mongoose.model("Group");
  const query = Group.find();

  const data = await paginateQuery(query, clientID, false, searchQuery, cursor, itemsPerPageStr);

  return {
    groups: await data.data,
    next: data.next
  };
}

// Returns the best location for a group based on the location of its members.
// Returns null if there are no members.
exports.determineBestLocation = async function(groupID) {
  const users = await exports.getUsersOfGroup(groupID, "location");
  const countryMap = new Map();

  if (users.length === 0) {
    throw new Error("Can't determine best location of group, because the group has no members.");
  }

  // Build the countryMap. It maps country names to the amount of users in that country.
  for (const user of users) {
    let newValue = 1;
    if (countryMap.has(user.location)) {
      newValue = countryMap.get(user.location) + 1;
    }

    countryMap.set(user.location, newValue);
  }

  // To determine the country (or countries) with the most users, switch that countryMap around:
  // Map the amount of users to the country name.
  const countMap = new Map();

  for (const [country, count] of countryMap.entries()) {
    let newValue = [country];
    if (countMap.has(count)) {
      newValue = newValue.concat(countMap.get(count))
    }

    countMap.set(count, newValue);
  }

  // Find the countries with the most users.
  const maxUsers = Math.max(...countMap.keys());

  // If there are multiple countries with the same amount of users, sort them alphabetically and return the first one.
  // This serves as a reliable tie-breaker to prevent giving random results and switching the location unneccessarily.
  const countries = countMap.get(maxUsers).sort();

  return countries[0];
}
