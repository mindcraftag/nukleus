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
    path: "/api/email",
    router: router
};

// ############################################################################################################
// Get list of the last emails
// ############################################################################################################
router.route('/last/:count')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {

            const count = parseInt(req.params.count);

            const Mail = mongoose.model('Mail');
            const mails = await Mail.find({}).sort([["createdAt", "desc"]]).limit(count).select().exec();

            const fields = ["_id", "address", "template", "fields", "createdAt", "attachments"];

            const mappedMails = mails.map(function(mail) {
                return nsvc.common.ensureExactFieldsInObject(mail, fields);
            });

            res.json({
                result: "success",
                data: mappedMails
            });
        });
    });

router.route('/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess([], true), function (req, res) {
        nsvc.common.handleError(req, res,async function() {
            let filterTemplateName = nsvc.verify.optionalString(req, "templateName");
            let filterDateStart = nsvc.verify.optionalDate(req, "dateStart", null);
            let filterDateEnd = nsvc.verify.optionalDate(req, "dateEnd", null);
            let filterSuccess = nsvc.verify.optionalBoolean(req, "success");

            const data = await nsvc.mailService.queryMail(filterTemplateName, filterDateStart, filterDateEnd, filterSuccess);

            res.json({
                result: "success",
                data: data
            });
        });
    });
