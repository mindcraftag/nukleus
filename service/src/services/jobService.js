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
const folderService     = require("./folderService");
const clientService     = require("./clientService");
const ValidationError   = require('../exception').ValidationError;
const aclTools          = require('../tools/aclTools');
const { parseItemsPerPage } = require('../tools/paging');

exports.verifyElements = async function(type, elements, clientId, user) {
    let results = [];

    const JobType = mongoose.model('JobType');
    const jobType = await JobType.findOne({ name: type }).select("elementMode").exec();
    if (!jobType)
        throw new ValidationError(`Job Type not found: ${type}`);

    switch(jobType.elementMode) {
        case "items": {
            for (const element of elements) {
                if (typeof element !== "object")
                    throw new ValidationError('Elements need to be an array of objects with _id and optional isFolder property');

                if (!element._id)
                    throw new ValidationError('At least one element does not have an _id property');

                if (element.isFolder === true) {
                    await folderService.getFolderItemsRecursive(element._id, results, clientId);
                } else if (element.isFolder === false || element.isFolder === undefined) {
                    results.push(new mongoose.Types.ObjectId(element._id));
                } else {
                    throw new ValidationError('isFolder flag of at least one element is not a boolean.')
                }
            }
            results = await aclTools.filterItemIds(results, user, clientId, "read");
            break;
        }

        case "folders": {
            for (const element of elements) {
                if (typeof element !== "object")
                    throw new ValidationError('Elements need to be an array of objects with _id and optional isFolder property');

                if (!element._id)
                    throw new ValidationError('At least one element does not have an _id property');

                if (element.isFolder === true) {
                    results.push(new mongoose.Types.ObjectId(element._id));
                } else {
                    throw new ValidationError('This job only runs on folders. Please submit folder Ids and set isFolder property to true');
                }
            }
            results = await aclTools.filterFolderIds(results, user, clientId, "read");
            break;
        }

        case "itemsAndFolders": {
            let folders = [];
            let items = [];

            for (const element of elements) {
                if (typeof element !== "object")
                    throw new ValidationError('Elements need to be an array of objects with _id and optional isFolder property');

                if (!element._id)
                    throw new ValidationError('At least one element does not have an _id property');

                if (element.isFolder === true) {
                    folders.push(new mongoose.Types.ObjectId(element._id));
                } else if (element.isFolder === false || element.isFolder === undefined) {
                    items.push(new mongoose.Types.ObjectId(element._id));
                } else {
                    throw new ValidationError('isFolder flag of at least one element is not a boolean.')
                }
            }

            items = await aclTools.filterItemIds(items, user, clientId, "read");
            folders = await aclTools.filterFolderIds(folders, user, clientId, "read");

            for (const item of items) {
                results.push({
                    isFolder: false,
                    _id: item
                });
            }

            for (const folder of folders) {
                results.push({
                    isFolder: true,
                    _id: folder
                });
            }
            break;
        }
    }

    return results;
};

exports.verifyParameters = async function(type, params) {
    let result = {};

    for (const param of params) {
        if (typeof param !== "object")
            throw new ValidationError('Parameters need to be an array of objects with name and value properties.');

        if (typeof param.name !== "string")
            throw new ValidationError('At least one of the parameters has no name or it is not a string');

        if (param.value === undefined)
            throw new ValidationError('At least one of the parameters has no value');
    }

    const JobType = mongoose.model('JobType');
    const jobType = await JobType.findOne({ name: type }).select("parameters").exec();
    if (!jobType)
        throw new ValidationError(`Job Type not found: ${type}`);

    // If we have parameters, verify them against the plugins specified types
    if (Array.isArray(jobType.parameters)) {
        for (const typeParam of jobType.parameters) {
            for (const param of params) {
                if (param.name === typeParam.name) {

                    // Do validations on values
                    switch(typeParam.type) {
                        case 'String':
                            if (typeof param.value !== 'string' && !(param.value instanceof String)) {
                                throw new ValidationError(`Parameter '${typeParam.name}' of type string has a non-string value`);
                            }
                            if (param.value.length > 1024) {
                                throw new ValidationError(`Parameter '${typeParam.name}' of type string is too long. 1024 characters max allowed`);
                            }
                            break;

                        case 'Boolean':
                            param.value = Boolean(param.value);
                            break;

                        case 'Number':
                            param.value = Number(param.value);
                            if (isNaN(param.value)) {
                                throw new ValidationError(`Parameter '${typeParam.name}' of type number has non-number value!`);
                            }
                            if (typeParam.min) {
                                if (param.value < typeParam.min) {
                                    throw new ValidationError(`Parameter '${typeParam.name}' of type number has invalid value '${param.value}' that is below minimum of '${typeParam.min}'`);
                                }
                            }
                            if (typeParam.max) {
                                if (param.value > typeParam.max) {
                                    throw new ValidationError(`Parameter '${typeParam.name}' of type number has invalid value '${param.value}' that is above maximum of '${typeParam.max}'`);
                                }
                            }
                            break;

                        case 'Enum':
                            if (typeof param.value !== 'string' && !(param.value instanceof String)) {
                                throw new ValidationError(`Parameter '${typeParam.name}' of type enum has an invalid value`);
                            }

                            let found = false;
                            for (const option of typeParam.options) {
                                if (param.value === option) {
                                    found = true;
                                    break;
                                }
                            }

                            if (!found)
                                throw new ValidationError(`Parameter '${typeParam.name}' of type enum has an invalid value '${param.value}'`);

                            break;

                        default:
                            break;
                    }

                    result[param.name] = param.value;
                }
            }
        }
    }

    return result;
};

/**
 * Verifies that all elements are allowed for the specified JobType, by checking if
 * the `mimeType` of the elements matche the `types` and `contentTypes` of the JobType.
 * Throws a `ValidationError` if not.
 *
 * @param jobTypeName Name of the JobType to check
 * @param elements Array of element objects, including a _id key
 */
async function areElementsAllowed(jobTypeName, elements) {
    const JobType = mongoose.model('JobType');
    const Item = mongoose.model('Item');
    const jobType = await JobType.findOne({ name: jobTypeName });

    // Check if the value is part of the array. No checks are performed if the value passed in
    // as `array` is falsy or an empty array.
    const checkInArray = (array, value) => {
        if (Array.isArray(array) && array.length) {
            if (array.includes(value)) {
                return true;
            } else {
                return false;
            }
        }

        return true;
    };

    // Because different jobTypes have different elementModes, we need to check the elements differently.
    for (const elem of elements) {
        let checkFailed = false;

        // The element type must match the elementMode of the jobType.
        if (jobType.elementMode === "items" && elem.isFolder) {
            checkFailed = true;
        }

        if (jobType.elementMode === "folders" && !elem.isFolder) {
            checkFailed = true;
        }

        // The type / contentType needs to be checked if the element is an item.
        if (jobType.elementMode === "items" || (jobType.elementMode === "itemsAndFolders" && !elem.isFolder)) {
            const item = await Item.findOne({ _id: elem._id });

            if (!item || !checkInArray(jobType.contentTypes, item.mimeType) || !checkInArray(jobType.types, item.type)) {
                checkFailed = true;
            }
        }

        if (checkFailed) {
            throw new ValidationError(`Item ${elem._id} can't be processed by ${jobTypeName}`);
        }
    }

}

exports.createJob = async function(type, elements, parameters, user, clientId) {

    await areElementsAllowed(type, elements);

    elements = await exports.verifyElements(type, elements, clientId, user);
    parameters = await exports.verifyParameters(type, parameters);

    const JobType = mongoose.model('JobType');
    const jobType = await JobType.findOne({ name: type }).exec();

    if (jobType.manualStart !== true) {
        throw new ValidationError(`JobType ${type} is not allowed to be started manually`);
    }

    // If this job type runs on items and/or folders, we need to check if the groups that own these items/folders
    // have this job type enabled or not. Otherwise we only check if the user has the job type enabled.
    if (jobType.elementMode === 'items' || jobType.elementMode === 'itemsAndFolders') {
        const Item = mongoose.model("Item");

        // Find the groups that own the items/folders the job is supposed to run on.
        const quotaGroups = [];
        for (const element of elements) {
            if (element.isFolder) {
                quotaGroups.push(await folderService.getFolderQuotaGroup(element._id, clientId));
            } else {
                quotaGroups.push((await Item.findOne({_id: element._id})).quotaGroup)
            }
        }

        // Remove duplicates.
        const uniqueQuotaGroups = [...new Set(quotaGroups)];

        // Verify that the job type is enabled for every group.
        for (const group of uniqueQuotaGroups) {
            if (!await clientService.isJobTypeAllowed(clientId, type, user, group)) {
                throw new ValidationError("The job type " + type + " can't be run on some elements.");
            }
        }
    } else {
        const isAllowed = await clientService.isJobTypeAllowed(clientId, type, user, []);
        if (!isAllowed) {
            throw new ValidationError("The job type " + type + " is not allowed.");
        }
    }

    if (!Array.isArray(elements) || elements.length === 0)
        throw new ValidationError('Job could not be created because no elements are submitted or they were filtered due to missing permissions to access them.');

    const Job = mongoose.model('Job');
    const job = new Job({
        type: type,
        state: 0,
        message: '',
        log: '',
        progress: 0,
        elements: elements,
        parameters: parameters,
        createdBy: user._id,
        client: clientId
    });

    await job.save();
    return job;
}

exports.getJobPaginated = async function(clientID, createdBy, itemsPerPageStr, firstObjectID) {
    const Job = mongoose.model("Job");
    const query = Job.find();
    const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

    query.where({client: clientID});
    query.sort({_id: "descending"});
    query.limit(itemsPerPage + 1);

    if (firstObjectID !== null) {
        query.where("_id").lte(firstObjectID);
    }

    if (createdBy !== null) {
        query.where({ createdBy: createdBy });
    }

    const jobs = await query.exec();

    let nextObjectID = null;
    if (jobs.length >= itemsPerPage + 1) {
        nextObjectID = jobs[itemsPerPage]._id;
        jobs.length = itemsPerPage;
    }

    return {
        jobs: jobs,
        nextObjectID: nextObjectID
    }
}

exports.getJobsAggregated = async function(clientID, createdBy, itemsPerPageStr, firstObjectID) {
    const Job = mongoose.model("Job");
    const aggregate = Job.aggregate();
    const itemsPerPage = parseItemsPerPage(itemsPerPageStr);

    aggregate.match({ client: clientID });
    aggregate.sort({ _id: "descending" });

    if (createdBy !== null) {
        aggregate.match({ createdBy: createdBy })
    }

    if (firstObjectID !== null) {
        aggregate.match({
            _id: {
                $lte: firstObjectID
            }
        });
    }

    aggregate.lookup({
        from: 'users', localField: 'createdBy', foreignField: '_id', as: 'createdByUser'
    });
    aggregate.unwind("createdByUser");
    aggregate.project({ type: 1, message: 1, state: 1, createdAt: 1, error: 1, log: 1, parameters: 1,
                        "createdByUser.name": 1, itemCount: { $size: '$elements'}, startedAt : 1, stoppedAt: 1 })
    aggregate.limit(itemsPerPage + 1);

    const jobs = await aggregate.exec();

    let nextObjectID = null;
    if (jobs.length >= itemsPerPage + 1) {
        nextObjectID = jobs[itemsPerPage]._id;
        jobs.length = itemsPerPage;
    }

    return {
        jobs: jobs,
        nextObjectID: nextObjectID
    }
}

// Return a list of all job types that belong to this client.
exports.getClientJobTypes = async function(clientID) {
    const JobType = mongoose.model("JobType");
    const jobTypes = await JobType.find({ client: clientID }).sort({ name: "ascending" }).exec();
    return jobTypes;
}

// Return a list of all enabled job types that also belong to this client.
exports.getEnabledClientJobTypes = async function(clientID) {
    const Client = mongoose.model("Client");
    const client = await Client.findOne({ _id: clientID }).exec();
    const clientJobTypes = (await exports.getClientJobTypes(clientID)).map(jobType => jobType.name);

    let jobTypes = client.jobtypesEnabled || [];
    jobTypes = jobTypes.filter(type => clientJobTypes.includes(type));
    return jobTypes;
}

// Enable and disable JobTypes for a client, but only for JobTypes that belong to the client.
// JobTypes that are not provided by the JobAgents of the client are not modified.
exports.setEnabledClientJobTypes = async function(client, enabledClientJobTypes) {
    const clientJobTypes = (await exports.getClientJobTypes(client._id)).map(jobType => jobType.name);

    // Make sure that all job types in enabledClientJobTypes actually belong to the client.
    for (const jobType of enabledClientJobTypes) {
        if (!clientJobTypes.includes(jobType)) {
            throw new ValidationError(`JobType ${jobType} does not belong to client ${clientID}`);
        }
    }

    // Get all enabled job types that don't belong to the client.
    let newEnabledJobTypes = client.jobtypesEnabled.filter(type => !clientJobTypes.includes(type));
    newEnabledJobTypes = newEnabledJobTypes.concat(enabledClientJobTypes);

    client.jobtypesEnabled = newEnabledJobTypes;
}
