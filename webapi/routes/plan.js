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
  path: "/api/plan",
  router: router,
  permissions: [
    { name: 'plan_admin', group: 'plan', description: 'Administrate plans' }
  ]
};

// ############################################################################################################
// Get list of all plans
// ############################################################################################################
router.route('/')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["plan_admin"], { needsSuperAdmin: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const Plan = mongoose.model('Plan');

      if (req.user.superadmin) {
        const plans = await Plan.find().exec();
        res.json({
          result: "success",
          data: plans
        });
      } else {
        const plans = await Plan.find({ visible: true }).exec();
        res.json({
          result: "success",
          data: plans
        });
      }
    });
  })

// ############################################################################################################
// Create plan
// ############################################################################################################
  .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['plan_admin'], { needsSuperAdmin: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const name = nsvc.verify.string(req, "name");

      // Check for existence of other clients with that name
      // -----------------------------------------------------
      if (await nsvc.planService.isNameConflict(name)) {
        res.json({
          result: "failed",
          error: "Plan with that name already exists"
        });
        return;
      }

      // Create new plan
      // -----------------------------------------------------
      const Plan = mongoose.model('Plan');
      const plan = new Plan({
        name: name,
        jobtypesEnabled: [],
        datatypesEnabled: [],
        featuresEnabled: [],
        pluginsEnabled: [],
        storages: [],
        storageQuotaGb: 0.0,
        trafficQuotaGb: 0.0,
        visible: false,
        defaultPlan: false,
        pricing: {
          monthlyBasePrice: 0.0,
          storagePricePerGb: 0.0,
          trafficPricePerGb: 0.0,
          jobInvocationPrices: {}
        },
        publicDownloadAllowed: false,
        brandingAllowed: false,
        conversationsAllowed: false,
        attributeTemplatesAllowed: false,
        mailingEnabled: false,
        paymentEnabled: false,
        draftMode: "FOREVER",
        draftGracePeriodDays: 30
      });

      await plan.save();

      res.status(201).json({
        result: "success",
        data: plan._id
      });
    });
  })

// ############################################################################################################
// Modify plan
// ############################################################################################################
  .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['plan_admin'], { needsSuperAdmin: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const id = nsvc.verify.objectId(req, "_id");
      const name = nsvc.verify.string(req, "name");
      const description = nsvc.verify.string(req, "description");
      const features = nsvc.verify.stringArray(req, "features");
      const jobtypesEnabled = nsvc.verify.stringArray(req, "jobtypesEnabled");
      const datatypesEnabled = nsvc.verify.stringArray(req, "datatypesEnabled");
      const featuresEnabled = nsvc.verify.stringArray(req, "featuresEnabled");
      const pluginsEnabled = nsvc.verify.stringArray(req, "pluginsEnabled");
      const storages = nsvc.verify.stringArray(req, "storages");
      const storageQuotaGb = nsvc.verify.integerNumber(req, "storageQuotaGb");
      const trafficQuotaGb = nsvc.verify.integerNumber(req, "trafficQuotaGb");
      const visible = nsvc.verify.boolean(req, "visible");
      const defaultPlan = nsvc.verify.boolean(req, "defaultPlan");
      const publicDownloadAllowed = nsvc.verify.boolean(req, "publicDownloadAllowed");
      const brandingAllowed = nsvc.verify.boolean(req, "brandingAllowed");
      const conversationsAllowed = nsvc.verify.boolean(req, "conversationsAllowed");
      const attributeTemplatesAllowed = nsvc.verify.boolean(req, "attributeTemplatesAllowed");
      const mailingEnabled = nsvc.verify.optionalBoolean(req, "mailingEnabled");
      const paymentEnabled = nsvc.verify.optionalBoolean(req, "paymentEnabled");
      const userPurchasesEnabled = nsvc.verify.optionalBoolean(req, "userPurchasesEnabled");
      const userPurchaseProvisionPercent = nsvc.verify.optionalIntegerNumberRange(req, "userPurchaseProvisionPercent", 0, 100);
      const maxUserCount = nsvc.verify.optionalIntegerNumberRange(req, "maxUserCount", 1, 100000000000);
      const monthlyBasePrice = nsvc.verify.integerNumber(req, "pricing.monthlyBasePrice");
      const storagePricePerGb = nsvc.verify.integerNumber(req, "pricing.storagePricePerGb");
      const trafficPricePerGb = nsvc.verify.integerNumber(req, "pricing.trafficPricePerGb");
      const jobInvocationPrices = nsvc.verify.object(req, "pricing.jobInvocationPrices")
      const draftMode = nsvc.verify.optionalString(req, "draftMode");
      const draftGracePeriodDays = nsvc.verify.optionalIntegerNumber(req, "draftGracePeriodDays");

      const Plan = mongoose.model('Plan');
      const plan = await Plan.findOne({ _id: id }).exec();

      if (!plan) {
        res.json({
          result: "failed",
          error: "Plan not found"
        });
      }
      else {
        // Check for existence of other plan with that name
        // -----------------------------------------------------
        if (plan.name !== name && await nsvc.planService.isNameConflict(name)) {
          res.json({
            result: "failed",
            error: "Plan with that name already exists"
          });
          return;
        }

        // Check validity of job invocation prices
        // -----------------------------------------------------
        const JobType = mongoose.model('JobType');
        const jobTypes = await JobType.find().exec();
        const jobTypeNames = jobTypes.map(t => t.name);
        const filteredJobInvocationPrices = {};

        for (const jobType in jobInvocationPrices) {
          if (jobInvocationPrices.hasOwnProperty(jobType)) {
            if (jobTypeNames.includes(jobType)) {
              const jobTypeEntry = jobInvocationPrices[jobType];

              const executionPrice = parseInt(jobTypeEntry.executionPrice);
              const timePrice = parseInt(jobTypeEntry.timePrice);

              if (isNaN(executionPrice) || isNaN(timePrice)) {
                res.json({
                  result: "failed",
                  error: "jobInvocationPrices has wrong format. At least one executionPrice or timePrice is not an integer number."
                });
                return;
              }

              filteredJobInvocationPrices[jobType] = {
                executionPrice: executionPrice,
                timePrice: timePrice
              };
            }
            else {
              res.json({
                result: "failed",
                error: "jobInvocationPrices includes unknown job: " + jobType
              });
              return;
            }
          }
        }

        if (plan.defaultPlan !== defaultPlan) {
          if (!defaultPlan) {
            // Cannot remove the default marker. Another needs to be made default
            // -----------------------------------------------------
            res.json({
              result: "failed",
              error: "Default marker cannot be removed. Another plan needs to be marked default instead."
            });
            return;
          }
          else {
            // Remove default marker from the other plan that currently has it.
            // -----------------------------------------------------
            let oldDefaultPlan = await Plan.findOne({ defaultPlan: true }).exec();
            if (oldDefaultPlan) {
              oldDefaultPlan.defaultPlan = false;
              await oldDefaultPlan.save();
            }
          }
        }

        // Modify plan
        // -----------------------------------------------------
        plan.name = name;
        plan.description = description;
        plan.features = features;
        plan.publicDownloadAllowed = publicDownloadAllowed;
        plan.brandingAllowed = brandingAllowed;
        plan.conversationsAllowed = conversationsAllowed;
        plan.attributeTemplatesAllowed = attributeTemplatesAllowed;
        plan.jobtypesEnabled = jobtypesEnabled;
        plan.datatypesEnabled = datatypesEnabled;
        plan.pluginsEnabled = pluginsEnabled;
        plan.featuresEnabled = featuresEnabled;
        plan.storages = storages;
        plan.storageQuotaGb = storageQuotaGb;
        plan.trafficQuotaGb = trafficQuotaGb;
        plan.visible = visible;
        plan.defaultPlan = defaultPlan;

        if (draftGracePeriodDays !== undefined) {
            if (draftGracePeriodDays < 0) {
                throw new ValidationError("Draft grace period must be a positive number of days.");
            }

            plan.draftGracePeriodDays = draftGracePeriodDays;
        }

        if (draftMode !== undefined) {
            const validDraftModes = Object.keys(nsvc.model.DraftMode)
            if (!validDraftModes.includes(draftMode)) {
                throw new ValidationError(`Draft mode must be one of: ${validDraftModes.join(", ")}.`);
            }
            plan.draftMode = draftMode;
        }

        if (mailingEnabled !== undefined) {
          plan.mailingEnabled = mailingEnabled;
        }

        if (paymentEnabled !== undefined) {
          plan.paymentEnabled = paymentEnabled;
        }

        if (userPurchasesEnabled !== undefined) {
          plan.userPurchasesEnabled = userPurchasesEnabled;
        }

        if (userPurchaseProvisionPercent !== undefined) {
          plan.userPurchaseProvisionPercent = userPurchaseProvisionPercent;
        }

        if (maxUserCount !== undefined) {
          plan.maxUserCount = maxUserCount;
        }

        plan.pricing.monthlyBasePrice = monthlyBasePrice;
        plan.pricing.storagePricePerGb = storagePricePerGb;
        plan.pricing.trafficPricePerGb = trafficPricePerGb;
        plan.pricing.jobInvocationPrices = filteredJobInvocationPrices;

        await plan.save();

        res.json({
          result: "success"
        });
      }
    });
  })

// ############################################################################################################
// Delete plan
// ############################################################################################################
  .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['plan_admin'], { needsSuperAdmin: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {

      const id = nsvc.verify.objectId(req, "id");

      // Check if that plan is currently in use
      // ----------------------------------------------------------------------------------
      const Client = mongoose.model('Client');
      const client = await Client.findOne({ currentPlan: id }).select("_id").exec();
      if (client) {
        res.json({
          result: "failed",
          error: "Plan is currently in use. Cannot delete it!"
        });
      }
      else {
        // Check if the plan is the default plan
        // ----------------------------------------------------------------------------------
        const Plan = mongoose.model('Plan');
        const plan = await Plan.findOne({ _id: id, defaultPlan: true }).exec();

        if (plan) {
          res.json({
            result: "failed",
            error: "Plan is the default plan. Cannot delete it!"
          });
        }
        else {
          // All okay, delete the plan
          // ----------------------------------------------------------------------------------
          await Plan.deleteOne({ _id: id }).exec();

          res.json({
            result: "success"
          });
        }
      }
    });
  });

// ############################################################################################################
// Get specific plan
// ############################################################################################################
router.route('/:id')
  .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(["plan_admin"], { needsSuperAdmin: true }), function (req, res) {
    nsvc.common.handleError(req, res,async function() {
      const id = nsvc.verify.toObjectId(req.params.id);
      const Plan = mongoose.model('Plan');
      const plan = await Plan.findOne({ _id: id }).exec();
      res.json({
        result: "success",
        data: plan
      });
    });
  });
