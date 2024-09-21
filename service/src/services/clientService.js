"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const folderService     = require('./folderService');
const userService       = require('./userService');
const security          = require('../tools/security');
const aclTools          = require('../tools/aclTools');
const paymentService    = require('./paymentService');
const config            = require('../config');
const { Type }          = require("@sinclair/typebox");
const { Value }         = require("@sinclair/typebox/value");

const {
    ValidationError
} = require("../exception");
const { ensureExactFieldsInObject } = require('../common');
const { paginateQuery, parseItemsPerPage } = require('../tools/paging');

exports.isNameConflict = async function(name) {
    const Client = mongoose.model('Client');
    const existsClient = await Client.existsByName(name);
    return existsClient;
};

exports.publicDownloadAllowed = async function(clientId) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: clientId }).select("publicDownloadAllowed currentPlan").exec();

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("publicDownloadAllowed").exec();

    if (client) {
        return client.publicDownloadAllowed || plan.publicDownloadAllowed;
    }

    return false;
};

exports.getEnabledFeatures = async function(clientId, filterForAll, additionalFeatures, returnNullIfNoUserGroupFeaturesEnabled) {
    const Client = mongoose.model('Client');
    const client = await Client.findById(clientId, {
        featuresEnabled: 1, currentPlan: 1, featuresEnabledForAll: 1, enabledUserAndGroupFeatures: 1
    }).exec();

    if (!client) {
        throw "User has no client!";
    }

    if (returnNullIfNoUserGroupFeaturesEnabled && !client.enabledUserAndGroupFeatures)
        return null;

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("featuresEnabled").exec();
    if (!plan) {
        throw "Client has no plan!";
    }

    const Feature = mongoose.model("Feature");
    const features = await Feature.find().exec();

    const result = [];

    additionalFeatures = additionalFeatures || [];
    const clientFeaturesEnabled = client.featuresEnabled || [];
    const planFeaturesEnabled = plan.featuresEnabled || [];
    const clientFeaturesEnabledForAll = client.featuresEnabledForAll || [];
    const filter = filterForAll && client.enabledUserAndGroupFeatures;

    for (const feature of features) {
        if (clientFeaturesEnabled.includes(feature.name) || planFeaturesEnabled.includes(feature.name)) {
            if (!filter || clientFeaturesEnabledForAll.includes(feature.name) || additionalFeatures.includes(feature.name))
                result.push(feature);
        }
    }

    return result;
}

exports.isDatatypeEnabled = async function(clientId, typeName) {
    const Client = mongoose.model('Client');
    const client = await Client.findById(clientId, {
        datatypesEnabled: 1, currentPlan: 1
    }).exec();

    if (!client) {
        throw "Client not found!";
    }

    if (client.datatypesEnabled.includes(typeName))
        return true;

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("datatypesEnabled").exec();
    if (!plan) {
        throw "Client has no plan!";
    }

    return plan.datatypesEnabled.includes(typeName);
}

exports.getEnabledDatatypes = async function(clientId, filterForAll, additionalDatatypes, returnNullIfNoUserGroupDatatypesEnabled) {
    const Client = mongoose.model('Client');
    const client = await Client.findById(clientId, {
        datatypesEnabled: 1, currentPlan: 1, datatypesEnabledForAll: 1, enabledUserAndGroupDatatypes: 1
    }).exec();

    if (!client) {
        throw "Client not found!";
    }

    if (returnNullIfNoUserGroupDatatypesEnabled && !client.enabledUserAndGroupDatatypes)
        return null;

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("datatypesEnabled").exec();
    if (!plan) {
        throw "Client has no plan!";
    }

    const DataType = mongoose.model("DataType");
    const dataTypes = await DataType.find().exec();

    const result = [];

    additionalDatatypes = additionalDatatypes || [];
    const clientDatatypesEnabled = client.datatypesEnabled || [];
    const planDatatypesEnabled = plan.datatypesEnabled || [];
    const clientDatatypesEnabledForAll = client.datatypesEnabledForAll || [];
    const filter = filterForAll && client.enabledUserAndGroupDatatypes;

    for (const dataType of dataTypes) {
        if (clientDatatypesEnabled.includes(dataType.name) || planDatatypesEnabled.includes(dataType.name)) {
            if (!filter || clientDatatypesEnabledForAll.includes(dataType.name) || additionalDatatypes.includes(dataType.name))
                result.push(dataType);
        }
    }

    return result;
};

exports.getClient = async function(clientId, fields, withPlan) {
    const Client = mongoose.model('Client');
    const query = Client.findOne({ _id: clientId });

    if (withPlan) {
        query.populate("currentPlan");
    }

    if (fields) {
        query.select(fields);
    }

    const client = await query.exec();
    return client;
}

exports.existsClient = async function(clientId) {
    const Client = mongoose.model('Client');
    const client = Client.findOne({ _id: clientId }).select("_id").exec();
    return !!client;
}

exports.getEnabledJobtypes = async function(clientId, filterForAll, additionalJobtypes, returnNullIfNoUserGroupJobtypesEnabled) {
    const Client = mongoose.model('Client');
    const client = await Client.findById(clientId, {
        jobtypesEnabled: 1, currentPlan: 1, jobtypesEnabledForAll: 1, enabledUserAndGroupJobtypes: 1
    }).exec();

    if (!client) {
        throw "User has no client!";
    }

    if (returnNullIfNoUserGroupJobtypesEnabled && !client.enabledUserAndGroupJobtypes)
        return null;

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("jobtypesEnabled").exec();
    if (!plan) {
        throw "Client has no plan!";
    }

    const JobType = mongoose.model('JobType');
    const allJobTypes = await JobType.find({
        manualStart: true,
        $or: [
            { client: clientId },
            { client: null },
            { client: { $exists: false } },
        ]
    }).sort({ displayName: "asc" }).exec();

    const result = [];

    additionalJobtypes = additionalJobtypes || [];
    const clientJobtypesEnabled = client.jobtypesEnabled || [];
    const planJobtypesEnabled = plan.jobtypesEnabled || [];
    const clientJobtypesEnabledForAll = client.jobtypesEnabledForAll || [];
    const filter = filterForAll && client.enabledUserAndGroupJobtypes;

    for (const jobtype of allJobTypes) {
        if (clientJobtypesEnabled.includes(jobtype.name) || planJobtypesEnabled.includes(jobtype.name)) {
            if (!filter || clientJobtypesEnabledForAll.includes(jobtype.name) || additionalJobtypes.includes(jobtype.name))
                result.push(jobtype);
        }
    }

    return result;
}

exports.isItemTypeAllowed = async function(clientId, type, user, groupId) {
    if (!type)
        return false;

    // Fetch client
    // ------------------------------------------------------------------
    const Client = mongoose.model("Client");
    const client = await Client.findById(clientId).select(
        "datatypesEnabled currentPlan datatypesEnabledForAll enabledUserAndGroupDatatypes"
    ).exec();
    if (!client)
        return false;

    // In case user and group defined datatypes are not enabled, just check if the datatype is enabled in
    // the client and if so, the item type is allowex
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupDatatypes && client.datatypesEnabled.includes(type))
        return true;

    // Also fetch the plan to check in its datatypes
    // ------------------------------------------------------------------
    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("datatypesEnabled").exec();
    if (!plan)
        return false;

    // Again, if user and group defined types are not enabled, whatever is set in the plan will now decide
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupDatatypes)
        return plan.datatypesEnabled.includes(type);

    // User and group defined types ARE enabled, so we now need to look into types that are allowed of all users
    // Special case is if the user is administrator. Then the type is allowed of course
    // ------------------------------------------------------------------
    if (user.isAdmin())
        return true;

    if (client.datatypesEnabledForAll.includes(type))
        return true;

    // It is not enabled for all users so now we need to fetch the information for the asking user and its assigned groups
    // ------------------------------------------------------------------
    let userDatatypes = await userService.getUserDatatypes(user, groupId);
    return userDatatypes.includes(type);
}

exports.isJobTypeAllowed = async function(clientId, type, user, groupId) {
    if (!type)
        return false;

    // Fetch client
    // ------------------------------------------------------------------
    const Client = mongoose.model("Client");
    const client = await Client.findById(clientId).select(
        "jobtypesEnabled currentPlan jobtypesEnabledForAll enabledUserAndGroupJobtypes"
    ).exec();
    if (!client)
        return false;

    // In case user and group defined jobtypes are not enabled, just check if the jobtype is enabled in
    // the client and if so, the type is allowex
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupJobtypes && client.jobtypesEnabled.includes(type))
        return true;

    // Also fetch the plan to check in its jobtypes
    // ------------------------------------------------------------------
    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("jobtypesEnabled").exec();
    if (!plan)
        return false;

    // Again, if user and group defined types are not enabled, whatever is set in the plan will now decide
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupJobtypes)
        return plan.jobtypesEnabled.includes(type);

    // User and group defined types ARE enabled, so we now need to look into types that are allowed of all users
    // Special case is if the user is administrator. Then the type is allowed of course
    // ------------------------------------------------------------------
    if (user.isAdmin())
        return true;

    if (client.jobtypesEnabledForAll.includes(type))
        return true;

    // It is not enabled for all users so now we need to fetch the information for the asking user and its assigned groups
    // ------------------------------------------------------------------
    let userJobtypes = await userService.getUserJobtypes(user, groupId);
    return userJobtypes.includes(type);
}

// Check if the client has access to the specified feature.
// This differs from "isFeatureAllowed" in that it checks for features that are enabled on the client itself.
exports.hasFeature = async function(clientId, feature) {
    const Client = mongoose.model("Client");
    const client = await Client.findOne({ _id: clientId }).select("featuresEnabled").exec();

    if (!client) return false;

    return client.featuresEnabled.includes(feature);
}

exports.isFeatureAllowed = async function(clientId, feature, user, groupId) {
    if (!feature)
        return false;

    // Fetch client
    // ------------------------------------------------------------------
    const Client = mongoose.model("Client");
    const client = await Client.findById(clientId).select(
        "featuresEnabled currentPlan featuresEnabledForAll enabledUserAndGroupFeatures"
    ).exec();
    if (!client)
        return false;

    // In case user and group defined features are not enabled, just check if the feature is enabled in
    // the client and if so, it is allowed
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupFeatures && client.featuresEnabled.includes(feature))
        return true;

    // Also fetch the plan to check in its features
    // ------------------------------------------------------------------
    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("featuresEnabled").exec();
    if (!plan)
        return false;

    // Again, if user and group defined features are not enabled, whatever is set in the plan will now decide
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupFeatures)
        return plan.featuresEnabled.includes(feature);

    // User and group defined features ARE enabled, so we now need to look into features that are allowed for all users
    // Special case is if the user is administrator. Then the feature is allowed of course
    // ------------------------------------------------------------------
    if (user.isAdmin())
        return true;

    if (client.featuresEnabledForAll.includes(feature))
        return true;

    // It is not enabled for all users so now we need to fetch the information for the asking user and its assigned groups
    // ------------------------------------------------------------------
    let userFeatures = await userService.getUserFeatures(user, groupId);
    return userFeatures.includes(feature);
}

// Check if a feature is allowed for the specified group.
exports.isGroupFeatureAllowed = async function(clientId, feature, group) {
    if (!feature)
        return false;

    // Fetch client
    // ------------------------------------------------------------------
    const Client = mongoose.model("Client");
    const client = await Client.findById(clientId).select(
        "featuresEnabled currentPlan featuresEnabledForAll enabledUserAndGroupFeatures"
    ).exec();
    if (!client)
        return false;

    // In case user and group defined features are not enabled, just check if the feature is enabled in
    // the client and if so, it is allowed
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupFeatures && client.featuresEnabled.includes(feature))
        return true;

    // Also fetch the plan to check in its features
    // ------------------------------------------------------------------
    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("featuresEnabled").exec();
    if (!plan)
        return false;

    // Again, if user and group defined features are not enabled, whatever is set in the plan will now decide
    // ------------------------------------------------------------------
    if (!client.enabledUserAndGroupFeatures)
        return plan.featuresEnabled.includes(feature);

    // User and group defined features ARE enabled, so we now need to look into features that are allowed for all groups.
    // ------------------------------------------------------------------
    if (client.featuresEnabledForAll.includes(feature))
        return true;

    // It is not enabled for all groups so now we need to fetch the information for the requested group.
    // ------------------------------------------------------------------
    return group.allowedFeatures.includes(feature);
}

exports.getClientByInvitationToken = async function(token) {
    const Client = mongoose.model("Client");
    const client = await Client.findOne({ invitationToken: token, invitationTokenEnabled: true }).exec();
    return client;
};

exports.createClient = async function(name, emailAddress, fixNameCollision) {

    // Check for existence of other clients with that name and fix if requested
    // -----------------------------------------------------
    if (fixNameCollision) {
        let foundName = name;
        let index = 1;

        while (await exports.isNameConflict(foundName)) {
            foundName = `${name} ${index}`;
            index++;
        }
    } else {
        if (await exports.isNameConflict(name)) {
            return false;
        }
    }

    // Create client with default plan
    // -----------------------------------------------------
    const Plan = mongoose.model('Plan');
    const defaultPlan = await Plan.findOne({ defaultPlan: true }).exec();

    const paymentSetup = await paymentService.createPaymentSetup(emailAddress);

    const Client = mongoose.model('Client');
    const client = new Client({
        name: name,
        currentPlan: defaultPlan,
        paymentSetup: paymentSetup,
        draftMode: "FOREVER",
        draftGracePeriodDays: 14,
    });

    await client.save();

    const ClientMetrics = mongoose.model('ClientMetrics');
    const clientMetrics = new ClientMetrics({
        client: client._id
    });

    await clientMetrics.save();

    return client;
};

exports.createUserHomeFolder = async function(clientId, userId) {

    const Folder = mongoose.model("Folder");

    // Create user home folder and the parent Users folder if it does not exist yet
    // --------------------------------------------------------------------------------
    const systemUserId = security.getSystemUserId();
    if (!systemUserId)
        throw "Cannot create user home folder. No system user id available.";

    // Ensure that the "Users" folder exists in the system location.
    const usersFolderId = await folderService.ensureFolder(clientId, null, "Users", systemUserId, false, true, true, config.systemLocation);
    if (!usersFolderId)
        throw "Cannot create users folder.";

    // Does the user folder exist already?
    const existingFolder = await Folder.findOne({
        client: clientId,
        parent: usersFolderId,
        name: userId.toString(),
        deletedAt: { $exists: false }
    });

    // If it already exists and has the correct ACLs, then return now instead of creating it again.
    if (existingFolder) {
        const aclCheckUser = existingFolder.acl.some(acl =>
             acl.user && acl.user.equals(userId)
          && acl.group === null
          && Array.isArray(acl.can)
          && acl.can.includes("read")
          && acl.can.includes("write")
          && acl.can.includes("publish")
        );
        const aclCheckEveryone = existingFolder.acl.some(acl =>
             acl.user === null
          && acl.group === null
          && Array.isArray(acl.can)
          && acl.can.length === 0
        );

        if (aclCheckUser && aclCheckEveryone) return existingFolder;
    }

    const User = mongoose.model("User");
    const user = await User.findOne({
        _id: userId
    }).exec();

    // Ensure that the home folder exists with the location of the user.
    const userFolderId = await folderService.ensureFolder(clientId, usersFolderId, userId.toString(), systemUserId, false, true, false, user.location);
    if (!userFolderId)
        throw "Cannot create user home folder.";

    const folder = await Folder.findById(userFolderId).exec();
    if (!folder)
        throw "User home folder created but cannot find it.";

    // Set permissions on new home folder
    // --------------------------------------------------------------------------------

    // user may read and write
    aclTools.addAcl(folder, {
        user: userId,
        group: null,
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

exports.getDefaultUserStorageQuota = async function(clientId) {
    const Client = mongoose.model("Client");
    const client = await Client.findOne({
        _id: clientId,
        deletedAt: { $exists: false }
    }).select("defaultUserStorageQuotaGb").exec();

    if (!client)
        throw new ValidationError("Client to get user storage quota not found!");

    return client.defaultUserStorageQuotaGb;
}

exports.getDefaultGroupStorageQuota = async function(clientId) {
    const Client = mongoose.model("Client");
    const client = await Client.findOne({
        _id: clientId,
        deletedAt: { $exists: false }
    }).select("defaultGroupStorageQuotaGb").exec();

    if (!client)
        throw new ValidationError("Client to get group storage quota not found!");

    return client.defaultGroupStorageQuotaGb;
}

exports.getClientsPaginated = async function(itemsPerPageStr, nextObjectID) {
    const Client = mongoose.model("Client");
    const ClientMetrics = mongoose.model("ClientMetrics");
    const query = Client.find();
    const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

    query.where("deletedAt", {$exists: false});
    query.sort({_id: "descending"});
    query.limit(itemsPerPage + 1);

    if (nextObjectID !== null) {
        query.where("_id").lte(nextObjectID);
    }

    query.populate("paymentSetup");

    const fields = [
        "_id", "name", "metrics", "refMetrics", "address", "invoiceGeneration", "storages", "featuresEnabled",
        "jobtypesEnabled", "datatypesEnabled", "workflowsEnabled", "pluginsEnabled", "brandingAllowed", "paymentSetup",
        "invitationTokenEnabled", "createdAt", "updatedAt", "currentPlan", "vatNo", "publicDownloadAllowed",
        "publicQueryAllowed", "acl", "conversationMode", "publicLikes", "publicConversations", "publicCategories",
        "publicLicenses", "draftMode", "draftGracePeriodDays"
    ];

    const clients = await query.exec();
    // Map the clients to a Promise that adds additional data and ensures that the client has all required fields.
    const mappedClients = await Promise.all(clients.map(async (obj) => {
        const metricsData = await ClientMetrics.findOne({ client: obj._id }).exec();
        obj.metrics = metricsData.metrics;
        obj.refMetrics = metricsData.refMetrics;
        return ensureExactFieldsInObject(obj, fields);
    }));

    let next = null;
    if (mappedClients.length === itemsPerPage + 1) {
        next = mappedClients[itemsPerPage]._id;
        mappedClients.pop();
    }

    return {
        clients: mappedClients,
        nextObjectID: next
    };
}

/**
 * Queries all clients and filters based on searchQuery and clientID.
 * Pagination is achieved by supplying the cursor of a previous response.
 * @param {*} searchQuery A string that needs to be part of the name of the clients that are returned.
 * @param {*} cursor A cursor returned from a previous response to continue on the next page.
 * @param {*} itemsPerPageStr How many items should be included on one page.
 */
exports.queryClients = async function(searchQuery, cursor, itemsPerPageStr) {
    const Client = mongoose.model("Client");
    const query = Client.find();

    const data = await paginateQuery(query, null, false, searchQuery, cursor, itemsPerPageStr);

    return {
        clients: await data.data,
        next: data.next
    };
}

exports.getNukleusClient = async function() {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ name: "Nukleus" });

    if (client)
        return client._id;
    else
        return null;
}

/**
 * Check if the given data is a valid client property template.
 * @param {object} data the object that contains the property template to be checked
 * @returns true if the data is valid
 */
exports.isValidClientTemplate = function(data) {
    const res = Value.Check(ClientTemplateType, data);
    return res;
}

/**
 * Check if the data is valid for the client properties template of the given client.
 * @param {string} clientID id of the client
 * @param {object} data the object that contains the properties to be checked
 * @param {boolean} usedByAdmin when an admin is changing the properties, we also allow access to system and immutable fields
 * @returns true if the data is valid
 */
exports.isValidClientProperties = async function(clientID, data, usedByAdmin) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: clientID });
    if (!client) return false;

    const template = client.userPropertiesTemplate;
    if (!template) {
        // If the client has no user properties and none are given, the data is valid.
        if (JSON.stringify(data) === "{}") {
            return true;
        } else {
            return false;
        }
    }

    const checks = Object.entries(data).map(([key, value]) => {
        // Check if the field is in the template
        if (!template[key]) return false;

        // Check if the type of the value is correct
        if (template[key].type === "string" && typeof value !== "string") return false;
        if (template[key].type === "boolean" && typeof value !== "boolean") return false;
        if (template[key].type === "string_enum" && typeof value !== "string") return false;

        // Check if the enum value is valid
        if (template[key].type === "string_enum" && !template[key].options.includes(value)) return false;

        // If the data is used by an admin, we don't need to check the visibility and mutability.
        if (!usedByAdmin) {
            // Check if the field is not limited to access by the system
            if (template[key].visibility === "system") return false;

            // Check if the field is mutable by the user
            if (!template[key].userMutable) return false;
        }

        return true;
    });

    // If any check failed, the data is invalid
    return !checks.some(x => x === false);
}

/**
 * Extract the client properties from the given properties object with the given access level.
 * @param {string | ObjectId} clientID id of the client
 * @param {object} properties the object that contains the properties
 * @param {"public" | "private" | "system"} access for what access level the properties should be extracted
 * @returns a subset of the properties attribute that only contains the properties that are allowed for the specified access level
 */
exports.getClientProperties = async function(clientID, properties, access) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: clientID });

    const obj = {};

    if (!properties || !client) {
        return obj;
    }

    const template = client.userPropertiesTemplate;
    Object.entries(properties).forEach(([key, value]) => {
        // If the field is not in the template, we ignore it.
        if (template[key] === undefined) {
            return;
        }

        if (template[key].visibility === "public") {
            obj[key] = value;
        } else if (template[key].visibility === "private" && access !== "public") {
            obj[key] = value;
        } else if (template[key].visibility === "system" && access === "system") {
            obj[key] = value;
        }
    });

    return obj;
}

// The type definition for the client properties template.
// Example:
// {
//     "myField1": {
//         "visibility": "public",
//         "userMutable": true,
//         "type": "string"
//     },
//     "myField2": {
//         "visibility": "private",
//         "userMutable": true,
//         "type": "string_enum",
//         "options": ["option1", "option2"]
//     },
// }
const ClientTemplateType = Type.Record(
    Type.String(),
    Type.Intersect([
        Type.Object({
            visibility: Type.Union([
                // public = everyone can see this field
                Type.Literal("public"),
                // private = only the user can see this field
                Type.Literal("private"),
                // system = no user will see this field, only accessible for the system and superadmins
                Type.Literal("system"),
            ]),
            userMutable: Type.Boolean()
        }),
        Type.Union([
            Type.Object({
                type: Type.Literal("string")
            }),
            Type.Object({
                type: Type.Literal("boolean")
            }),
            Type.Object({
                type: Type.Literal("string_enum"),
                options: Type.Array(Type.String(), {
                    minItems: 1
                })
            }),
        ])
    ])
);
