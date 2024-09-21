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
const router        = express.Router();

module.exports = {
  path: "/api/plugin",
  router: router,
  permissions: [ ]
};

// ############################################################################################################
// Get list of all plugins
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["client_admin"]), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const plugins = await nsvc.pluginService.getPlugins();
      res.json({
        result: "success",
        data: nsvc.common.ensureExactFieldsInArray(plugins, [
          "_id", "name", "alwaysEnabled", "needsSuperadmin", "permissionsRequired", "mounts"
        ])
      });
    });
  });
