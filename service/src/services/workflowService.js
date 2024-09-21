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
const xml2js            = require("xml2js");
const ValidationError   = require('../exception').ValidationError;

exports.isNameConflict = async function(name, client) {
    const Workflow = mongoose.model('Workflow');
    const exists = await Workflow.existsByNameAndClient(name, client);
    return exists;
};

exports.findWorkflow = async function(id, client, isSuperadmin, fields) {

    const Workflow = mongoose.model('Workflow');
    const query = Workflow.findOne({
        _id: id,
        deletedAt: { $exists: false }
    });

    if (!isSuperadmin) {
        query.where({ client: client });
    } else {
        query.or([
            { client: client },
            { client: { $exists: false }},
            { client: null }
        ]);
    }

    if (fields)
        query.select(fields);

    const workflow = await query.exec();
    return workflow;
};

exports.listWorkflows = async function(client, isSuperadmin, fields) {

    const Workflow = mongoose.model('Workflow');
    const query = Workflow.find({
        deletedAt: { $exists: false }
    });

    if (!isSuperadmin) {
        query.where({ client: client });

        //TODO: also list global workflows that are activated for this client through
        // their client.workflows or client.currentPlan.workflows

    } else {
        query.or([
            { client: client },
            { client: { $exists: false }},
            { client: null }
        ]);
    }

    fields = fields || "-bpmnXml";
    const workflows = await query.select(fields).exec();

    return workflows;
};

function addBpmnElementsToMap(map, elements, type) {
    if (Array.isArray(elements)) {
        for (const element of elements) {
            element.type = type;
            map.set(element["$"].id, element);
        }
    }
}

function getElementAttributes(element) {
    const result = {};
    const attrs = element["$"];
    for (const prop in attrs) {
        if (attrs.hasOwnProperty(prop) && prop.startsWith("nk")) {
            result[prop] = attrs[prop];
        }
    }
    return result;
}

function traverseBpmnElements(map, element, graph) {

    if (!graph)
        graph = { steps: [] };

    if (!element.visited) {
        const node = {
            type: element.type,
            id: element["$"].id,
            name: element["$"].name,
            attributes: getElementAttributes(element),
            out: []
        };

        graph.steps.push(node);
        element.visited = true;

        const outList = element["bpmn:outgoing"];
        if (outList && outList.length) {
            for (const out of outList) {
                if (!map.has(out)) {
                    throw new ValidationError("Missing outgoing element: " + out);
                }

                const outElement = map.get(out);
                if (outElement.type !== "SequenceFlow") {
                    throw new ValidationError("Outgoing element from " + node.id + " must be a SequenceFlow element.");
                }

                const targetRef = outElement["$"].targetRef;
                if (!map.has(targetRef)) {
                    throw new ValidationError("Missing target element: " + targetRef);
                }

                const targetElement = map.get(targetRef);
                node.out.push(traverseBpmnElements(map, targetElement, graph));
            }
        }
    }

    if (element.type === "StartEvent")
        return graph;
    else
        return element["$"].id;
}

exports.parseAndVerifyBpmnXml = async function(workflow) {

    const bpmnJs = await xml2js.parseStringPromise(workflow.bpmnXml);

    const definitions = bpmnJs["bpmn:definitions"];
    const process = definitions["bpmn:process"][0];

    const startEvents = process["bpmn:startEvent"];
    const tasks = process["bpmn:task"];
    const endEvents = process["bpmn:endEvent"];
    const sequenceFlows = process["bpmn:sequenceFlow"];
    const exclusiveGateways = process["bpmn:exclusiveGateway"];

    console.log(JSON.stringify(process,null, 2));

    if (startEvents.length !== 1) {
        throw new ValidationError("Workflows must have exactly one start event.");
    }

    const elementsMap = new Map();
    addBpmnElementsToMap(elementsMap, startEvents, "StartEvent");
    addBpmnElementsToMap(elementsMap, tasks, "Task");
    addBpmnElementsToMap(elementsMap, endEvents, "EndEvent");
    addBpmnElementsToMap(elementsMap, sequenceFlows, "SequenceFlow");
    addBpmnElementsToMap(elementsMap, exclusiveGateways, "ExclusiveGateway");

    const graph = traverseBpmnElements(elementsMap, startEvents[0]);

    console.log(graph);

    workflow.graph = graph;
};

exports.createWorkflowInstance = async function(workflow, attachToItems, attachToFolders, user) {
    let filteredItemIdArray;
    let filteredFolderIdArray;

    // read all items and check if user has access to them (same client)
    // --------------------------------------------------------------------------------------
    if (attachToItems && attachToItems.length > 0) {
        const Item = mongoose.model('Item');
        const items = await Item.find({
            _id: attachToItems,
            client: user.client,
            deletedAt: { $exists: false }
        }).select("_id acl").exec();

        if (items.length === 0) {
            throw new ValidationError("One or more items to attach to not found.");
        }

        const filteredItems = await nsvc.aclTools.filterElements(items, user, "read");
        filteredItemIdArray = filteredItems.map(x => x._id);
    }

    // read all folders and check if user has access to them (same client)
    // --------------------------------------------------------------------------------------
    if (attachToFolders && attachToFolders.length > 0) {
        const Folder = mongoose.model('Folder');
        const folders = await Folder.find({
            _id: attachToFolders,
            client: user.client,
            deletedAt: { $exists: false }
        }).select("_id acl").exec();

        if (folders.length === 0) {
            throw new ValidationError("One or more folders to attach to not found.");
        }

        const filteredFolders = await nsvc.aclTools.filterElements(folders, user, "read");
        filteredFolderIdArray = filteredFolders.map(x => x._id);
    }

    // Create new workflow instance
    // -----------------------------------------------------
    const WorkflowInstance = mongoose.model('WorkflowInstance');
    const workflowInstance = new WorkflowInstance({
        workflow: workflow,
        client: user.client,
        graph: workflow.graph,
        attachedToItems: filteredItemIdArray,
        attachedToFolders: filteredFolderIdArray
    });

    await workflowInstance.save();

    return workflowInstance;
}