"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express       = require('express');
const nsvc          = require('@mindcraftgmbh/nukleus-service');
const mongoose      = nsvc.model.mongoose;
const router        = express.Router();

module.exports = {
  path: "/api/group",
  router: router,
  permissions: [
    { name: 'group_admin', group:"group", description: 'Administrate groups' }
  ]
};

// ############################################################################################################
// Get list of groups
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      let nextItem = null;

      if (req.query.nextItem !== undefined) {
        nextItem = nsvc.verify.toObjectId(req.query.nextItem);
      }

      const groupsPages = await nsvc.groupService.getGroupsPaginated(req.user.client, req.query.pageSize, nextItem);

      res.json({
        result: "success",
        data: nsvc.common.ensureExactFieldsInArray(groupsPages.groups, [
            "_id", "name", "updatedAt", "createdAt"
        ]),
        next: groupsPages.nextObjectID
      });
    });
  })

// ############################################################################################################
// Create group
// ############################################################################################################
  .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['group_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const name = nsvc.verify.string(req, "name");
      const hasFolder = nsvc.verify.optionalBoolean(req, "hasFolder", false);

      // Create the group in the location of the user by default.
      const group = await nsvc.groupService.createGroup(name, req.user.client, hasFolder, req.user.location);

      res.status(201).json({
        result: "success",
        data: group._id
      });
    });
  })

// ############################################################################################################
// Modify a group
// ############################################################################################################
  .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['group_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const id = nsvc.verify.toObjectId(req.body._id);
      const name = nsvc.verify.string(req, "name");
      const description = nsvc.verify.optionalString(req, "description");
      const storageQuotaGb = nsvc.verify.optionalIntegerNumberOrNull(req, "storageQuotaGb");
      const trafficQuotaGb = nsvc.verify.optionalIntegerNumberOrNull(req, "trafficQuotaGb");
      const allowedDatatypes = nsvc.verify.optionalStringArray(req, "allowedDatatypes");
      const allowedJobtypes = nsvc.verify.optionalStringArray(req, "allowedJobtypes");
      const allowedFeatures = nsvc.verify.optionalStringArray(req, "allowedFeatures");
      const hasFolder = nsvc.verify.optionalBoolean(req, "hasFolder", undefined);

      const Group = mongoose.model('Group');
      const query = Group.findOne();

      if (!req.isSystemUser)
        query.where("client").equals(req.user.client);

      query.where("deletedAt").exists(false);
      query.where("_id").equals(id);
      const group = await query.exec();

      if (!group) {
        res.json({
          result: "failed",
          error: "Group not found"
        });
      }
      else {

        if (name !== undefined && name !== group.name) {

          // Check for existance of other group with that name
          // -----------------------------------------------------
          const conflict = await nsvc.groupService.isNameConflict(name, req.user.client);
          if (conflict) {
            res.json({
              result: "failed",
              error: "Group with that name already exists"
            });
            return;
          }

          group.name = name;
        }

        // Modify group
        // -----------------------------------------------------
        if (description !== undefined)
          group.description = description;

        if (storageQuotaGb !== undefined)
          group.storageQuotaGb = storageQuotaGb;

        if (trafficQuotaGb !== undefined)
          group.trafficQuotaGb = trafficQuotaGb;

        if (allowedJobtypes !== undefined)
          group.allowedJobtypes = allowedJobtypes;

        if (allowedDatatypes !== undefined)
          group.allowedDatatypes = allowedDatatypes;

        if (allowedFeatures !== undefined)
          group.allowedFeatures = allowedFeatures;

        if (hasFolder !== undefined)
          group.hasFolder = hasFolder;

        await group.save();

        // Create group folder if necessary
        // -----------------------------------------------------
        if (hasFolder) {
          await nsvc.groupService.createGroupFolder(group.client, group._id);
        }

        // Get all users in that group
        // -----------------------------------------------------
        if (Array.isArray(req.body.users)) {
          const User = mongoose.model('User');
          const users = await nsvc.groupService.getUsersOfGroup(id, "name");

          const usersToAdd = [];
          const usersToRemove = [];

          // Check which users to add
          // ----------------------------------------------------
          for (const userId of req.body.users) {
            if (!users.some((e) => e._id.toString() === userId))
              usersToAdd.push(nsvc.verify.toObjectId(userId));
          }

          // Check which users to remove
          // ----------------------------------------------------
          for (const user of users) {
            const userId = user._id.toString();
            if (!req.body.users.some((e) => e === userId))
              usersToRemove.push(user._id);
          }

          // Do the changes
          // ----------------------------------------------------
          if (usersToAdd.length) {
            await User.updateMany({
              _id: usersToAdd,
              "memberships.client": req.user.client
            }, {
              $addToSet: {"memberships.$.groups": id}
            }, {__user: req.userObjectId}).exec();
          }

          if (usersToRemove.length) {
            await User.updateMany({
              _id: usersToRemove,
              "memberships.client": req.user.client
            }, {
              $pull: {"memberships.$.groups": id}
            }, {__user: req.userObjectId}).exec();
          }
        }

        res.json({
          result: "success"
        });
      }
    });
  })

// ############################################################################################################
// Delete a group
// ############################################################################################################
  .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['group_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const idArray = nsvc.verify.objectIdOrObjectIdArray(req, "id");

      // read all files and check if user has access to them (same client)
      const Group = mongoose.model('Group');
      const groups = await Group.find({
        _id: idArray,
        client: req.user.client,
        deletedAt: { $exists: false }
      }).select("_id").exec();

      if (groups.length === 0) {
        res.json({
          result: "failed",
          error: "Group not found"
        });
      }

      const filteredIdArray = groups.map(x => x._id);

      // mark all groups as deleted
      await Group.updateMany({
        _id: filteredIdArray,
        client: req.user.client
      }, {
        $set: { deletedAt: new Date() }
      }).exec();

      res.json({
        result: "success"
      });
    });
  });

// ############################################################################################################
// Get specific group
// ############################################################################################################
router.route('/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['group_admin']), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const id = nsvc.verify.toObjectId(req.params.id);
      const Group = mongoose.model('Group');
      const groupQuery = Group.findOne();
      groupQuery.where("deletedAt").exists(false);
      groupQuery.where("client").equals(req.user.client);
      groupQuery.where("_id").equals(id);
      const group = await groupQuery.exec();

      if (!group) {
        res.json({
          result: "failed",
          error: "Group not found"
        });
      } else {
        const users = await nsvc.groupService.getUsersOfGroup(id, "name");

        res.json({
          result: "success",
          data: {
            _id: group._id,
            name: group.name,
            description: group.description || "",
            hasFolder: group.hasFolder,
            storageQuotaGb: group.storageQuotaGb || 0,
            trafficQuotaGb: group.trafficQuotaGb || 0,
            allowedDatatypes: group.allowedDatatypes,
            allowedJobtypes: group.allowedJobtypes,
            allowedFeatures: group.allowedFeatures,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            users: users,
            location: req.user.superadmin ? group.location : undefined
          }
        });
      }
    });
  })

// ############################################################################################################
// Return a group's folder id and create it if it does not exist. The requesting user must be member of this group
// ############################################################################################################
router.route('/folder/:groupId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

        const groupId = nsvc.verify.toObjectId(req.params.groupId);

        let found = false;
        for (const group of req.user.activeMembership.groups) {
          if (group.equals(groupId)) {
            found = true;
            break;
          }
        }

        if (!found) {
          res.status(404).json({
            result: "failed",
            error: "Group not found"
          });
        } else {
          const folder = await nsvc.groupService.createGroupFolder(req.user.client, groupId);
          if (folder) {
            res.json({
              result: 'success',
              data: folder._id
            });
          } else {
            res.json({
              result: 'success',
              data: null
            });
          }
        }
      });
    });

// ############################################################################################################
// Return a group's quota information. The requesting user must be member of this group
// ############################################################################################################
router.route('/quota/:groupId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
      nsvc.common.handleError(req, res,async function() {

        const groupId = nsvc.verify.toObjectId(req.params.groupId);

        let found = false;
        for (const group of req.user.activeMembership.groups) {
          if (group.equals(groupId)) {
            found = true;
            break;
          }
        }

        if (!found) {
          res.status(404).json({
            result: "failed",
            error: "Group not found"
          });
        } else {
          const group = await nsvc.groupService.getGroup(groupId, "storageQuotaGb trafficQuotaGb usedStorageQuotaGb usedTrafficQuotaBytes");
          const usedTrafficQuotaBytes = group.usedTrafficQuotaBytes || 0;
          const usedTrafficQuotaGb = usedTrafficQuotaBytes / 1024 / 1024 / 1024;

          res.json({
            result: 'success',
            data: {
              storageQuotaGb: group.storageQuotaGb || 0,
              usedStorageQuotaGb: group.usedStorageQuotaGb || 0,
              trafficQuotaGb: group.trafficQuotaGb || 0,
              usedTrafficQuotaGb: usedTrafficQuotaGb
            }
          });
        }
      });
    });

// ############################################################################################################
// Get public info (name & avatar)
// ############################################################################################################
router.route('/publicinfo/:id/:clientId/:avatarSize')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function(req, res) {
      nsvc.common.handleError(req, res,async function() {

        const groupId = nsvc.verify.toObjectId(req.params.id);
        const clientId = nsvc.verify.toObjectId(req.params.clientId);
        const size = parseInt(req.params.avatarSize);

        const client = await nsvc.clientService.getClient(clientId, "publicUserInfo");
        if (!client) {
          res.status(404).json({
            result: "failed",
            error: "client not found"
          });
          return;
        }

        if (!client.publicUserInfo) {
          res.status(403).json({
            result: "failed",
            error: "forbidden"
          });
          return;
        }

        const avatar = await nsvc.groupService.getAvatar(groupId, size, clientId, !client.publicUserInfo);
        if (!avatar) {
          res.status(404).json({
            result: "failed",
            error: "group not found"
          });
        } else {
          res.json({
            result: "success",
            data: avatar
          });
        }
      });
    });

/**
 * This endpoint accepts a body describing a query and returns a page of data.
 * The body may contain the following fields:
 * - searchQuery: if supplied, only users whose name includes the search query
 *                are returned
 * - cursor: if supplied, the response will contain a specific page
 * 
 * This endpoint returns an object containing the list of groups as an array and
 * a proprty "next", that is either null if this was the last page or a cursor
 * to continue searching. Supply this string as "cursor" in the following
 * request to get the next page.
 * 
 * If the query parameter pageSize is set, then it will be used to determine
 * how many items should be included on a page.
 */
router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['group_admin']), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            if (!req.body)
                throw new ValidationError("Body is undefined.");

            let searchQuery = nsvc.verify.optionalString(req, "searchQuery");
            let cursor = nsvc.verify.optionalString(req, "cursor", 1000);

            const data = await nsvc.groupService.queryGroups(searchQuery, req.user.client, cursor, req.query.pageSize);

            res.json({
                result: "success",
                data: data.groups,
                next: data.next
            });
        });
    });
