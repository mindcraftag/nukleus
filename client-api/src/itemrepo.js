"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import proxyTools from './proxytools';
import eventBus from './eventbus';
import * as pkgTools from './package';

import NkApiGateway from './repo/apiGateway';
import NkItemCache from './repo/itemCache';
import NkLinkableItemsCache from "./repo/linkableItemsCache";
import NkTemplate from './repo/template';
import NkConnection from './repo/connection';
import NkBlock from './repo/block';
import NkField from './repo/field';
import NkScript from "./repo/script";
import NkScriptField from "./repo/scriptfield";
import NkUndoManager from "./undomanager";

import { LoaderException, InvalidArgumentException, InvalidStateException } from "./exception";
import {verifyAcl} from "./permissions";

export default class NkItemRepo {

  constructor(usePublicApi, nkclient) {
    this.nkclient = nkclient;
    this.activeItem = null;
    this.editedItem = null;
    this.selectedSgItems = []; // this array reflects the selected sg item IDs but needs to be maintained from outside this library. This lib just provides the storage
    this.rootItemId = null; // This id is only set so conditions $isroot can be evaluated in NkField
    this.loadedItems = new Map();
    this.additionalLoadedItems = new Map();
    this.resolvedPaths = new Map();
    this.datatypes = [];
    this.apiGateway = new NkApiGateway(nkclient);
    this.itemCache = new NkItemCache(this.apiGateway);
    this.linkableItemsCache = new NkLinkableItemsCache(this.apiGateway, this.itemCache, usePublicApi);
    this.usePublicApi = !!usePublicApi;
    this.undoManager = new NkUndoManager(this);

    // When jailing is active, item browsers should not list root folder but take
    // the activeItem.folder directory as root. Additionally mountedFolders can contain
    // a list of folder IDs to mount at the same level as the new jailed root, NOT as children
    this.jail = {
      active: false,
      mountedFolders: []
    };
  }

  getUndoManager() {
    return this.undoManager;
  }

  fetchLinkValue(item, linkUsage) {
    if (!item)
      throw new InvalidArgumentException("fetchLinkValue(): Item cannot be null!");

    for (const link of item.links) {
      if (link.usage === linkUsage) {
        return {
          id: link.to,
          linkItem: link.item,
          stopRecursion: link.stopRecursion
        }
      }
    }

    return {id: null, linkItem: null};
  }

  async createFieldsForEditedItem(block, template) {
    return this.createFields(block, this.editedItem, template, undefined, false, this.editedItem.attributes);
  }

  async createFields(block, item, template, blockPath, isGraphBlockField, attributes) {
    let fields = template.instantiate();
    let proxiedFields = [];

    for (const field of fields) {
      if (field.name) {
        const fieldPath = `${blockPath}->${field.name}`;

        switch (field.type) {
          case "Link":
            if (blockPath) {
              let {id, linkItem, stopRecursion} = this.fetchLinkValue(item, fieldPath);

              if (linkItem) {
                field.value = await this.prepareItem(linkItem);
              }
              else {
                // In case we do not recurse into this link when loading, there is most probably no
                // item in the link but we only have the ID. Save this as value and leave it
                // to whoever uses this data to load the item if necessary.
                if (stopRecursion)
                  field.value = id;
                else
                  field.value = null;
              }
            } else {
              field.value = field.defaultValue;
            }
            break;

          case "List": {
            const blocks = await this.readBlocks(item, null, field.templates, fieldPath, attributes, true, true, "List");
            const proxiedBlocks = proxyTools.proxyListArray(blocks, field, item);
            field.setBlocks(proxiedBlocks);
            break;
          }

          case "Attribute": {
            if (blockPath) {
              field.value = item.attributes[fieldPath];
              if (field.value === undefined) {
                field.value = field.defaultValue;
              }
            } else {
              field.value = field.defaultValue;
            }
            break;
          }
        }

        if (isGraphBlockField)
          proxiedFields.push(proxyTools.proxyGraphBlockField(field, block, item));
        else
          proxiedFields.push(proxyTools.proxyBlockField(field, block, item));
      }
    }

    // refresh dependant fields
    for (const field of proxiedFields) {
      field.refreshDependantFields(proxiedFields);
    }

    // refresh condition
    for (const field of proxiedFields) {
      field.calculateCondition();
    }

    return proxiedFields;
  }

  async readScripts(item, parentBlock, treeNamespace, attributes) {
    if (!item)
      throw new InvalidArgumentException("readScripts(): Item cannot be null!");

    const scripts = [];

    let listIndex = 0;
    while (true) {
      const scriptPath = `${treeNamespace}#scripts[${listIndex}]`;
      if (this.existsScriptNamespace(item, attributes, scriptPath)) {
        const idPath = `${scriptPath}#id`;
        const id = attributes[idPath];
        const scriptItemIdPath = `${scriptPath}#item`;
        const fieldPath = `${scriptPath}->`;
        const fieldPathLen = fieldPath.length;

        let {linkItem} = this.fetchLinkValue(item, scriptItemIdPath);
        if (linkItem)
          linkItem = await this.prepareItem(linkItem);

        const script = new NkScript(id, parentBlock, item, linkItem);
        scripts.push(script);

        for (const key in attributes) {
          if (attributes.hasOwnProperty(key)) {
            if (key.startsWith(fieldPath)) {
              const value = attributes[key];
              const fieldName = key.substring(fieldPathLen);
              const field = new NkScriptField(script, fieldName, value);
              script.addField(field);
            }
          }
        }
      } else {
        break;
      }
      listIndex++;
    }

    return scripts;
  }

  async readBlocks(item, parentBlock, templates, treeNamespace, attributes, readChildren, readScripts, parentType) {
    if (!item)
      throw new InvalidArgumentException("readBlocks(): Item cannot be null!");

    const blocks = [];

    let listIndex = 0;
    while (true) {
      const blockPath = `${treeNamespace}[${listIndex}]`;
      if (this.existsBlockNamespace(item, attributes, blockPath)) {
        const idPath = `${blockPath}#id`;
        const id = item.attributes[idPath];

        const typePath = `${blockPath}#type`;
        let typeName = item.attributes[typePath];

        let posX;
        let posY;

        switch(parentType) {
          case "NodeGraph": {
            const posXPath = `${blockPath}#posx`;
            const posYPath = `${blockPath}#posy`;

            posX = item.attributes[posXPath] || 0;
            posY = item.attributes[posYPath] || 0;
            break;
          }
          case "List": {
            readChildren = false;
            typeName = "Entry";
            break;
          }
          default:
            break;
        }

        for (const templateEntry of templates) {
          if (templateEntry.typeName === typeName) {

            // Create block
            // --------------------------------------------------------------------
            const blockName = templateEntry.typeName;
            const displayName = templateEntry.displayName;
            const block = new NkBlock(id, parentBlock, blockName, blockName, displayName, item);

            // extract fields from data
            // --------------------------------------------------------------------
            const proxiedFields = await this.createFields(block, item, templateEntry.template, blockPath, parentType === "NodeGraph", attributes);
            block.setFields(proxiedFields);
            if (parentType === "NodeGraph") {
              block.setPosition(posX, posY);
              block.setInputs(templateEntry.inputs);
              block.setOutputs(templateEntry.outputs);
            }

            // create child blocks
            // --------------------------------------------------------------------
            if (readChildren) {
              const childBlocks = await this.readBlocks(item, block, templates, blockPath, attributes, readChildren, readScripts, parentType);
              block.blocks = proxyTools.proxyBlockArray(childBlocks, block, item);
            }

            // create child scripts
            // --------------------------------------------------------------------
            if (readScripts) {
              const childScripts = await this.readScripts(item, block, blockPath, attributes);
              block.scripts = proxyTools.proxyScriptArray(childScripts, block, item);
            }

            // Proxy and push to result
            // --------------------------------------------------------------------
            if (parentType === "NodeGraph")
              blocks.push(proxyTools.proxyGraphBlock(block, item));
            else
              blocks.push(proxyTools.proxyBlock(block, item));

            break;
          }
        }
      } else {
        break;
      }
      listIndex++;
    }

    return blocks;
  }

  readConnections(item, graphNamespace, attributes) {
    const connections = [];

    let listIndex = 0;
    while (true) {
      const connectionPath = `${graphNamespace}#connection[${listIndex++}]`;
      const connection = attributes[connectionPath];

      if (connection) {
        connections.push(new NkConnection(null, item, connection));
      } else {
        break;
      }
    }

    return connections;
  }

  existsBlockNamespace(item, attributes, namespace) {
    if (!item)
      throw new InvalidArgumentException("existsBlockNamespace(): Item cannot be null!");

    const usage = attributes[`${namespace}#usage`];
    if (usage) {
      return usage === 'Block';
    }

    // We do not have a usage attribute. This means this is an old item prior to the addition of the usage attribute.
    // Check if we have any attribute or link with the namespace, then it must be a block.

    for (const attributeName in attributes) {
      if (attributes.hasOwnProperty(attributeName)) {
        if (attributeName.startsWith(namespace))
          return true;
      }
    }

    for (const link of item.links) {
      if (link.usage.startsWith(namespace))
        return true;
    }

    return false;
  }

  existsScriptNamespace(item, attributes, namespace) {
    if (!item)
      throw new InvalidArgumentException("existsScriptNamespace(): Item cannot be null!");

    const usage = attributes[`${namespace}#usage`];
    return usage === 'Script';
  }

  getFieldSet(item, name) {
    if (Array.isArray(item.fieldSets)) {
      for (const fieldSet of item.fieldSets) {
        if (fieldSet.name === name)
          return fieldSet;
      }
    }

    return null;
  }

  async createFieldInstances(item, fields, attributes, path, attributeSrc, doNotFillValues) {
    if (!item)
      throw new InvalidArgumentException("createFieldInstances(): Item cannot be null!");

    if (!fields)
      throw new InvalidArgumentException("createFieldInstances(): Fields cannot be null!");

    const result = [];
    const pathWithArrow = path.length ? `${path}->` : path;

    // Replace field set entries with their fields first
    // ---------------------------------------------------------------
    for (let i=0; i<fields.length; i++) {
      const field = fields[i];
      if (field.type === "FieldSet") {
        const fieldSet = this.getFieldSet(item, field.name);
        if (fieldSet) {
          fields.splice(i, 1, ...structuredClone(fieldSet.fields));
          i+=fieldSet.fields.length-1;
        } else {
          console.error("Fieldset not found: " + field.name);
        }
      }
    }

    for (const field of fields) {
      switch (field.type) {

        case "Separator": {
          const fieldObj = new NkField("Separator", field.label, "Separator", null, item, this);
          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setCollapsed(field.collapsed);
          result.push(fieldObj);
          break;
        }

        case "Link": {
          let linkItemFinal;

          if (!doNotFillValues) {
            let {id, linkItem, stopRecursion} = this.fetchLinkValue(item, field.usageAs);

            if (linkItem) {
              linkItemFinal = await this.prepareItem(linkItem);
            }
            else {
              // In case we do not recurse into this link when loading, there is most probably no
              // item in the link but we only have the ID. Save this as value and leave it
              // to whoever uses this data to load the item if necessary.
              if (stopRecursion)
                linkItemFinal = id;
            }
          }

          let fieldObj = new NkField(field.usageAs, field.displayName, field.type, linkItemFinal, item, this, this.linkableItemsCache);
          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setLinkableTypes(field.linkableTypes);

          if (field.preload !== undefined)
            fieldObj.setPreload(field.preload);

          if (field.loadingManager !== undefined)
            fieldObj.setLoadingManagerRule(field.loadingManager);

          result.push(proxyTools.proxyItemField(fieldObj, item));
          break;
        }

        case "Tree": {
          const treePath = `${pathWithArrow}${field.name}`;

          // Create templates for each possible type
          // ---------------------------------------------------------
          const templates = [];
          for (const childType of field.childTypes) {
            const template = new NkTemplate(await this.createFieldInstances(item, childType.fields, attributes, treePath, attributeSrc, true));
            templates.push({
              typeName: childType.typeName,
              displayName: childType.displayName || childType.typeName,
              template: template
            });
          }

          templates.sort(function (t1, t2) {
            return t1.displayName.localeCompare(t2.displayName);
          });

          const rootBlock = new NkBlock(null, null, "", "Root", undefined, item);

          // Read blocks from links and attributes
          // ---------------------------------------------------------
          const childBlocks = await this.readBlocks(item, rootBlock, templates, treePath, attributes, true, true, "Tree");
          rootBlock.blocks = proxyTools.proxyBlockArray(childBlocks, rootBlock, item);

          let fieldObj = new NkField(field.name, field.displayName, field.type, null, item, this);
          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setBlocks([rootBlock]);
          fieldObj.setTemplates(templates);
          result.push(fieldObj);

          break;
        }

        case "List": {
          const listPath = `${pathWithArrow}${field.name}`;

          // Create templates array. Lists only have a single possible template
          // ---------------------------------------------------------
          const template = new NkTemplate(await this.createFieldInstances(item, field.fields, attributes, listPath, attributeSrc, true));
          const templates = [{
            typeName: "Entry",
            displayName: field.elementName,
            template: template
          }];

          // Read blocks from links and attributes
          // ---------------------------------------------------------
          let fieldObj = new NkField(field.name, field.displayName, field.type, null, item, this);

          const blocks = await this.readBlocks(item, null, templates, listPath, attributes, true, true, "List");
          const proxiedBlocks = proxyTools.proxyListArray(blocks, fieldObj, item);

          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setBlocks(proxiedBlocks);
          fieldObj.setTemplates(templates);
          result.push(fieldObj);
          break;
        }

        case "NodeGraph": {
          const graphPath = `${pathWithArrow}${field.name}`;

          // Create templates for each possible type
          // ---------------------------------------------------------
          const templates = [];
          for (const childType of field.childTypes) {
            const template = new NkTemplate(await this.createFieldInstances(item, childType.fields, attributes, graphPath, attributeSrc, true));
            templates.push({
              typeName: childType.typeName,
              displayName: childType.displayName || childType.typeName,
              template: template,
              inputs: childType.inputs || [],
              outputs: childType.outputs || []
            });
          }

          templates.sort(function (t1, t2) {
            return t1.displayName.localeCompare(t2.displayName);
          });

          // Read blocks from links and attributes
          // ---------------------------------------------------------
          let blocks = await this.readBlocks(item, null, templates, graphPath, attributes, false, false, "NodeGraph");

          // Read graph connections
          // ---------------------------------------------------------
          let connections = this.readConnections(item, graphPath, attributes);

          let fieldObj = new NkField(field.name, field.displayName, field.type, null, item, this);
          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setBlocks(proxyTools.proxyGraphBlockArray(blocks, item));
          fieldObj.setConnections(proxyTools.proxyConnectionArray(connections, item));
          fieldObj.setTemplates(templates);
          result.push(fieldObj);

          break;
        }

        case "Attribute": {
          let value;

          if (!doNotFillValues) {
            value = item[attributeSrc] ? item[attributeSrc][field.name] : undefined;
            if (value === undefined) {
              value = field.defaultValue;
            }
          }

          let fieldObj = new NkField(field.name, field.displayName, field.type, value, item, this);
          fieldObj.setInfo(field.info);
          fieldObj.setCondition(field.if);
          fieldObj.setDefaultValue(field.defaultValue);
          fieldObj.setMinValue(field.minValue);
          fieldObj.setMaxValue(field.maxValue);
          fieldObj.setOptions(field.options);
          fieldObj.setDatatype(field.datatype);
          fieldObj.setLanguage(field.language);
          fieldObj.setWidget(field.widget);
          fieldObj.setLength(field.length);
          result.push(proxyTools.proxyItemField(fieldObj, item));
          break;
        }
      }
    }

    // refresh dependant fields
    for (const field of result) {
      field.refreshDependantFields(result);
    }

    // refresh condition
    for (const field of result) {
      field.calculateCondition();
    }

    return result;
  }

  existsAttributeInFields(item, name) {
    if (!item)
      throw new InvalidArgumentException("existsAttributeInFields(): Item cannot be null!");

    // if the name contains an arrow, this is most certainly a field attribute
    if (name.includes("->") || name.includes("#type"))
      return true;

    // ...otherwise check through the fields definition
    for (const field of item.fields) {
      if (field.type === "Attribute" && field.name === name)
        return true;
    }

    return false;
  }

  createUserAttributes(item) {
    if (!item)
      throw new InvalidArgumentException("fillUserAttributes(): Item cannot be null!");

    const attributes = item.attributes || {};
    let userAttributes = {};

    for (const att in attributes) {
      if (attributes.hasOwnProperty(att)) {
        if (!this.existsAttributeInFields(item, att))
          userAttributes[att] = attributes[att];
      }
    }

    return userAttributes;
  }

  processScripts(scripts, links, attributes, path, includeLinkItems) {
    let index = 0;
    for (const script of scripts) {

      const scriptPath = `${path}#scripts[${index}]`;
      const scriptUsagePath = scriptPath + "#usage";
      const scriptIdPath = scriptPath + "#id";
      const itemIdPath = scriptPath + "#item";

      if (attributes) {
        attributes[scriptUsagePath] = "Script";
        attributes[scriptIdPath] = script.id;
      }

      if (links && script.item.value) {
        if (includeLinkItems) {
          links.push({
            usage: itemIdPath,
            to: script.item.value._id,
            item: script.item.value
          });
        } else {
          links.push({
            usage: itemIdPath,
            to: script.item.value._id,
          });
        }
      }

      for (const field of script.fields) {
        const fieldPath = `${scriptPath}->${field.name}`;

        switch (field.type) {
          case "Link": {
            if (field.value && links) {
              if (includeLinkItems) {
                links.push({
                  usage: fieldPath,
                  to: field.value._id,
                  item: field.value
                });
              } else {
                links.push({
                  usage: fieldPath,
                  to: field.value._id
                });
              }
            }
            break;
          }

          default: {
            if (attributes) {
              attributes[fieldPath] = field.value;
            }
            break;
          }
        }
      }

      index++;
    }
  }

  traverseTreeFieldInstance(blocks, links, attributes, path, includeLinkItems) {
    let index = 0;
    for (const block of blocks) {

      const blockPath = `${path}[${index}]`;
      const blockUsage = blockPath + "#usage";
      const blockType = blockPath + "#type";
      const blockId = blockPath + "#id";
      const blockPosX = blockPath + "#posx";
      const blockPosY = blockPath + "#posy";

      if (attributes) {
        attributes[blockUsage] = "Block";
        attributes[blockType] = block.type;
        attributes[blockId] = block.id;

        if (block.posX !== undefined)
          attributes[blockPosX] = block.posX || 0;

        if (block.posY !== undefined)
          attributes[blockPosY] = block.posY || 0;
      }

      for (const field of block.fields) {
        const fieldPath = `${blockPath}->${field.name}`;

        switch (field.type) {
          case "Link": {
            if (field.value && links) {
              if (includeLinkItems) {
                links.push({
                  usage: fieldPath,
                  to: field.value._id,
                  item: field.value
                });
              } else {
                links.push({
                  usage: fieldPath,
                  to: field.value._id
                });
              }
            }
            break;
          }

          case "List": {
            if (field.blocks) {
              this.traverseListFieldInstances(field.blocks, links, attributes, fieldPath, includeLinkItems);
            }
            break;
          }

          case "Attribute": {
            if (attributes) {
              attributes[fieldPath] = field.value;
            }
            break;
          }
        }
      }

      if (block.scripts) {
        this.processScripts(block.scripts, links, attributes, blockPath, includeLinkItems);
      }

      if (block.blocks) {
        this.traverseTreeFieldInstance(block.blocks, links, attributes, blockPath, includeLinkItems);
      }

      index++;
    }
  }

  traverseListFieldInstances(blocks, links, attributes, path, includeLinkItems) {
    let index = 0;
    for (const block of blocks) {
      const blockPath = `${path}[${index}]`;

      for (const field of block.fields) {
        const fieldPath = `${blockPath}->${field.name}`;

        switch (field.type) {
          case "Link": {
            if (field.value && links) {
              const entry = {
                usage: fieldPath,
                to: typeof field.value === 'object' ? field.value._id : field.value
              };

              if (includeLinkItems) {
                entry.item = typeof field.value === 'object' ? field.value : null;
              }

              links.push(entry);
            }
            break;
          }

          case "Attribute": {
            if (attributes) {
              attributes[fieldPath] = field.value;
            }
            break;
          }
        }
      }

      index++;
    }
  }

  retrieveLinksAndAttributesFromFieldInstances(fieldInstances, links, attributes, includeLinkItems) {
    for (const fieldInstance of fieldInstances) {

      switch (fieldInstance.type) {
        case "Link": {
          if (fieldInstance.value && links) {
            if (includeLinkItems) {
              links.push({
                usage: fieldInstance.name,
                to: fieldInstance.value._id,
                item: fieldInstance.value
              });
            } else {
              links.push({
                usage: fieldInstance.name,
                to: fieldInstance.value._id
              });
            }
          }
          break;
        }

        case "Attribute": {
          if (attributes) {
            attributes[fieldInstance.name] = fieldInstance.value;
          }
          break;
        }

        case "List": {
          if (fieldInstance.blocks) {
            this.traverseListFieldInstances(fieldInstance.blocks, links, attributes, fieldInstance.name, includeLinkItems);
          }
          break;
        }

        case "Tree": {
          if (fieldInstance.blocks) {
            const root = fieldInstance.blocks[0];
            if (root.blocks) {
              this.traverseTreeFieldInstance(root.blocks, links, attributes, fieldInstance.name, includeLinkItems);
            }
          }
          break;
        }

        case "NodeGraph": {
          if (fieldInstance.blocks) {
            this.traverseTreeFieldInstance(fieldInstance.blocks, links, attributes, fieldInstance.name, includeLinkItems);
          }
          if (attributes && Array.isArray(fieldInstance.connections)) {
            let index = 0;
            for (const connection of fieldInstance.connections) {
              const path = `${fieldInstance.name}#connection[${index++}]`;
              attributes[path] = {
                srcNode: connection.srcNode,
                srcSlot: connection.srcSlot,
                destNode: connection.destNode,
                destSlot: connection.destSlot,
              };
            }
          }
          break;
        }
      }
    }
  }

  async prepareItem(item) {
    const _this = this;

    let arr = [];
    if (this.loadedItems.has(item._id)) {
      arr = this.loadedItems.get(item._id);
    }

    arr.push(item);

    this.loadedItems.set(item._id, arr);

    return this.undoManager.ignore(async function () {
      item.links = item.links || [];
      item.attributes = item.attributes || {};
      item.userFields = item.userFields || []; // public interface does not provide this so let's initialize it empty in that case
      item.fieldInstances = await _this.createFieldInstances(item, item.fields, item.attributes, "", "attributes", false);
      item.userFieldInstances = await _this.createFieldInstances(item, item.userFields, item.userAttributes, "", "userAttributes", false);
      item.additionalUserAttributes = {};

      // ensure some variables exist
      // --------------------------------------------------------------------------------------------------------
      item.allowConversation = !!item.allowConversation;

      // Create a separate dictionary of all additional user attributes that are not used with user fields
      // --------------------------------------------------------------------------------------------------------
      for (const key in item.userAttributes) {
        if (item.userAttributes.hasOwnProperty(key)) {
          let searchKey = key;

          // If the key follows the syntax "name[index]->childname" then we need to extract "name" from it
          const matches = searchKey.match(/(\w+)\[\d+\]->\w+/g);
          if (matches) {
            searchKey = searchKey.substr(0, searchKey.indexOf("["));
          }

          let found = false;
          for (const field of item.userFields) {
            if (field.name === searchKey) {
              found = true;
              break;
            }
          }

          if (!found) {
            item.additionalUserAttributes[key] = item.userAttributes[key];
          }
        }
      }

      // In case this item is a package, mark all children as packaged and readonly.
      // ---------------------------------------------------------------------------
      if (item.packageContent) {
        await _this.traverseItems(function (item) {
          item.readOnly = true;
          item.isPackaged = true;
        }, item.packageContent);

        item.readOnly = true;
        item.isPackaged = true;
      } else {
        if (item.resultingAcl)
          item.readOnly = !verifyAcl(await _this.nkclient.me(true), item.resultingAcl, "write");
        else
          item.readOnly = true;
      }

      return item;
    });
  }

  clear() {
    this.activeItem = null;
    this.editedItem = null;
    this.linkableItemsCache.clear();
    this.loadedItems.clear();
    this.additionalLoadedItems.clear();
    this.resolvedPaths.clear();
  }

  removeBlock(block, parent) {
    parent.blocks.removeObject(block);
    block.parent = null;
  }

  moveItems(itemsToMove, newParentItem, newIndex) {
    // we will move multiple items to the same index. this causes latter nodes to be
    // inserted before earlier ones. reverse the array to keep the original order
    const reversedItems = itemsToMove.toReversed();

    newIndex = newIndex ?? newParentItem.block.blocks.length;

    for (const itemToMove of reversedItems) {
      this.moveItem(itemToMove, newParentItem, newIndex);
    }
  }

  moveItem(itemToMove, newParentItem, newIndex) {
    const oldParentBlock = itemToMove.parent.block;
    const newParentBlock = newParentItem.block;
    const movingBlock = itemToMove.block;
    const oldIndex = oldParentBlock.blocks.indexOf(movingBlock);

    newIndex = newIndex ?? newParentItem.block.blocks.length;

    if (oldIndex === -1) return;

    movingBlock.parent = null;
    oldParentBlock.blocks.splice(oldIndex, 1);

    // if the removal of the item altered the newIndex in the same array, reduce newIndex
    let skippedNewIndex = newIndex;
    if (oldParentBlock === newParentBlock && oldIndex < newIndex) {
      skippedNewIndex--;
    }

    newParentBlock.blocks.splice(skippedNewIndex, 0, movingBlock);
    movingBlock.parent = newParentBlock;
  }

  cloneBlock(block, parent) {
    if (!this.activeItem) {
      throw new InvalidStateException("No active item to clone block in!");
    }

    const clonedBlock = block.clone(this.activeItem);

    if (parent)
      clonedBlock.parent = parent;

    const proxiedBlock = proxyTools.proxyBlock(clonedBlock, this.activeItem);
    parent.blocks.push(proxiedBlock);
    return proxiedBlock;
  }

  async createNewBlock(templateEntry, parent) {
    const newBlock = new NkBlock(null, parent, templateEntry.typeName, undefined, undefined, this.editedItem);
    let fields = await this.createFieldsForEditedItem(newBlock, templateEntry.template);
    newBlock.setFields(fields);
    newBlock.blocks = proxyTools.proxyBlockArray(newBlock.blocks, newBlock, this.editedItem);
    return this.addBlockToParent(newBlock, parent, this.editedItem);
  }

  addBlockToParent(block, parent, item) {
    block.parent = parent;
    const proxy = proxyTools.proxyBlock(block, item);
    parent.blocks.push(proxy);
    return proxy;
  }

  async createNewListEntry(templateEntry, field) {
    const newBlock = new NkBlock(null, null, templateEntry.typeName, undefined, undefined, this.editedItem);
    let fields = await this.createFieldsForEditedItem(newBlock, templateEntry.template);
    newBlock.setFields(fields);
    newBlock.blocks = proxyTools.proxyListArray(newBlock.blocks, field, this.editedItem);
    return proxyTools.proxyBlock(newBlock, this.editedItem);
  }

  async createNewGraphNode(templateEntry, graph, x, y) {
    const newBlock = new NkBlock(null, null, templateEntry.typeName, undefined, templateEntry.displayName, graph);
    let fields = await this.createFields(newBlock, graph, templateEntry.template, undefined, true, this.editedItem.attributes);
    newBlock.setFields(fields);
    newBlock.setInputs(templateEntry.inputs);
    newBlock.setOutputs(templateEntry.outputs);
    newBlock.setPosition(x, y);
    newBlock.blocks = proxyTools.proxyGraphBlockArray(newBlock.blocks, graph);
    this.addNodeToGraph(newBlock, graph, this.editedItem);
    return newBlock;
  }

  addNodeToGraph(block, graph, item) {
    const proxy = proxyTools.proxyGraphBlock(block, graph, item);
    graph.blocks.push(proxy);
  }

  removeGraphNode(graph, node) {
    // Check if there are any connections that need removal
    const connectionsToRemove = [];
    for (const connection of graph.connections) {
      if (connection.srcNode === node.id || connection.destNode === node.id)
        connectionsToRemove.push(connection);
    }

    // remove the identified connections
    for (const connection of connectionsToRemove) {
      graph.connections.removeObject(connection);
    }

    // remove the node itself
    graph.blocks.removeObject(node);
  }

  addGraphLink(graph, srcNode, srcSlot, destNode, destSlot) {
    graph.connections.push(new NkConnection(null, this.editedItem, {
      srcNode: srcNode,
      srcSlot: srcSlot,
      destNode: destNode,
      destSlot: destSlot
    }));
  }

  removeGraphLink(graph, srcNode, srcSlot, destNode, destSlot) {
    for (const connection of graph.connections) {
      if (connection.srcNode === srcNode && connection.srcSlot === srcSlot &&
          connection.destNode === destNode && connection.destSlot === destSlot) {
        graph.connections.removeObject(connection);
        return;
      }
    }
  }

  createNewScript(parent, index) {
    index = index || parent.scripts.length;
    const newScript = new NkScript(null, parent, this.editedItem);
    parent.scripts.splice(index, 0, newScript);
    return newScript;
  }

  removeScript(script, parent) {
    parent.scripts.removeObject(script);
  }

  async loadItem(id, returnOnly, dontPrepare) {
    try {
      if (!returnOnly) {
        this.clear();
        this.apiGateway.start();
      }

      let item;
      if (this.usePublicApi) {
        item = await this.apiGateway.call('loadItem', 'getItemPublicRecursive', id);
        item.public = true;
      } else {
        item = await this.apiGateway.call('loadItem', 'getItemAggregated', id);
      }

      if (!dontPrepare)
        item = await this.prepareItem(item);

      if (returnOnly)
        return item;

      this.rootItemId = id;
      this.activeItem = item;
      this.editedItem = item;
      eventBus.$emit('nk:itemRepo:itemLoaded');
      this.apiGateway.end();
      return item;
    }
    catch(err) {
      console.log(err);
      throw new LoaderException("ItemRepo: Unable to load item!");
    }
  }

  async loadItemRecursive(id, returnOnly, dontPrepare, parentId) {
    try {
      if (!returnOnly) {
        this.clear();
        this.apiGateway.start();
      }

      let item;
      if (this.usePublicApi) {
        item = await this.apiGateway.call('loadItemRecursive', 'getItemPublicRecursive', id, true);
        item.public = true;
      } else {
        item = await this.apiGateway.call('loadItemRecursive', 'getItemAggregatedRecursive', id, { withAttachmentInfo: true });
      }

      const _this = this;

      // Packaged need to be loaded recursively, because this function is called in two different situations:
      // - when the user selected a Package, in that case id is the package id
      // - when the user loaded a Scene that contains a package, in that case we need to find the packages first
      const loadPackageContentRecursively = async (item) => {
        if (item.type === "Package") {
          const existingItem = pkgTools.getItemFromCache(item._id)
          if (existingItem) {
            item.packageContent = structuredClone(existingItem);
            return;
          }

          const cachedItem = await _this.nkclient.itemCache.addItemToCache(item._id, undefined, item.hash);
          const rawPackage = await (await fetch(cachedItem.objectUrl)).blob();

          const pkgData = await pkgTools.parsePackage(rawPackage, item._id);
          const packageContent = pkgData.rootItem;
          pkgTools.addPackageToCache(item._id, structuredClone(pkgData));

          // By preparing and adding all items from the package as additional loaded items,
          // we can make sure that they won't try to be loaded from the API later on.
          for (const [id, item] of Object.entries(pkgData.metadata)) {
            this.additionalLoadedItems.set(id, await this.prepareItem(item));
          }

          item.packageContent = packageContent;
        } else {
          // Go over all links and check if one of them is a package
          for (const link of item.links) {
            if (!link.item) {
              if (!link.stopRecursion)
                console.error("Missing link item found in item", item);
            } else {
              await loadPackageContentRecursively(link.item);
            }
          }
        }
      };

      await loadPackageContentRecursively(item);

      if (!dontPrepare) {
        // Go over all IDs in the scenegraph and make them unique by adding the path as a prefix to them.
        const makeIDsUnique = (itemToProcess, path) => {
          // If the item has a packageContent, we will process it instead of the
          // item because the item will later be replaced with the packageContent.
          itemToProcess = itemToProcess.packageContent ?? itemToProcess;

          for (const key of Object.keys(itemToProcess.attributes || {})) {
            const val = itemToProcess.attributes[key];
            if (typeof val === "string" && val.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
              itemToProcess.attributes[key] = [path, itemToProcess.attributes[key]].join("/");
            }

            if (val && typeof val === "object") {
              for (const subKey of Object.keys(val)) {
                const subVal = val[subKey];
                if (typeof subVal === "string" && subVal.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
                  val[subKey] = [path, val[subKey]].join("/");
                }
              }
            }
          }

          // If a Scene is linked, we need to process it as well because it will
          // contain a different scenegraph.
          for (const link of itemToProcess.links) {
            if (!link.stopRecursion && link.usage.endsWith("->Scene")) {
              regex.lastIndex = 0;
              const regexResult = regex.exec(link.usage);
              const sceneGraphIndex = regexResult[1];
              const id = itemToProcess.attributes[`Scenegraph[${sceneGraphIndex}]#id`];
              makeIDsUnique(link.item, id || path);
            }
          }
        }

        const regex = /\[([0-9]*)\]->Scene/g;

        if (returnOnly) {
          // returnOnly is set when the loaded item is not the root item. So we need to use the existing rootItemId.
          makeIDsUnique(item, parentId || this.rootItemId);
        } else {
          // Otherwise process the links directly without using the rootItemId.

          this.rootItemId = id;
          const itemToProcess = item.type === "Package" ? item.packageContent : item;
          makeIDsUnique(item, id);

          for (const link of itemToProcess.links) {
            if (link.item && link.usage.endsWith("->Scene")) {
              regex.lastIndex = 0;
              const res = regex.exec(link.usage);
              const num = res[1];
              const id = itemToProcess.attributes[`Scenegraph[${num}]#id`];
              makeIDsUnique(link.item, id);
            }
          }
        }

        // Items need to be prepared recursively, because the same item might be
        // used in multiple places and will therefore have different and unique
        // instance ids.
        const prepareItems = async (item) => {
          for (const link of item.links) {
            if (link.item) {
              // For package items prepare the packageContent instead of the package itself
              if (link.item.type === "Package") {
                link.item.packageContent = await prepareItems(link.item.packageContent);
              } else {
                link.item = await prepareItems(link.item);
              }
            }
          }

          return await this.prepareItem(item);
        }

        if (item.type === "Package") {
          item.packageContent = await prepareItems(item.packageContent);
          item = await this.prepareItem(item);
        } else {
          item = await prepareItems(item);
        }
      }

      if (returnOnly)
        return item;

      this.rootItemId = id;
      this.activeItem = item;
      this.editedItem = item;
      eventBus.$emit('nk:itemRepo:itemLoaded');
      this.apiGateway.end();
      return item;
    }
    catch(err) {
      console.error(err);
      throw new LoaderException("ItemRepo: Unable to load item!");
    }
  }

  async loadDataTypes() {
    this.datatypes = await this.nkclient.getDatatypesList();
  }

  getLinksAndAttributes(item, links, attributes, userAttributes, includeItems) {
    if (item.fieldInstances.length) {
      this.retrieveLinksAndAttributesFromFieldInstances(item.fieldInstances, links, attributes, includeItems);
    }
    if (item.userFieldInstances.length) {
      this.retrieveLinksAndAttributesFromFieldInstances(item.userFieldInstances, links, userAttributes, includeItems);
    }
  }

  updateItemLinksAndAttributes(item, includeLinkItems) {
    try {
      item = item || this.activeItem;

      // Fill links array and attributes
      // -----------------------------------------------------------
      const links = [];
      const attributes = {};
      const userAttributes = {};
      this.getLinksAndAttributes(item, links, attributes, userAttributes, includeLinkItems);

      for (const key in item.additionalUserAttributes) {
        if (item.additionalUserAttributes.hasOwnProperty(key)) {
          userAttributes[key] = item.additionalUserAttributes[key];
        }
      }

      item.attributes = attributes;
      item.userAttributes = userAttributes;
      item.links = links;
    }
    catch(err) {
      console.error(err);
      throw new LoaderException(err);
    }
  }

  setEditedItemById(itemId, itemNode) {
    itemNode = itemNode || this.activeItem;

    if (itemNode) {
      if (itemNode._id === itemId) {
        if (itemNode.packageContent)
          this.editedItem = itemNode.packageContent;
        else
          this.editedItem = itemNode;

        return true;
      }

      const links = [];
      this.getLinksAndAttributes(itemNode, links, null, null, true);

      for (const link of links) {
        if (link.item) {
          if (this.setEditedItemById(itemId, link.item))
            return true;
        }
      }

      if (itemNode.packageContent) {
        if (this.setEditedItemById(itemId, itemNode.packageContent))
          return true;
      }
    }

    return false;
  }

  async loadAdditionalItemByRelativePath(itemId, path) {
    try {
      const cachedItem = pkgTools.getItemFromCache(itemId);
      let resolvedItemId;

      if (cachedItem) {
        // If the item is from a package, we need to resolve the path inside the package.
        const parts = path.split('/');
        const itemName = parts.pop()

        let currentFolder = pkgTools.getFolder(cachedItem.folder._id);

        for (const part of parts) {
          if (part === "..") {
            currentFolder = pkgTools.getFolder(currentFolder.parent);
          } else {
            currentFolder = pkgTools.findFolder(part, currentFolder._id);
          }

          if (!currentFolder) {
            return undefined;
          }
        }

        const item =  pkgTools.findItem(itemName, currentFolder._id)
        resolvedItemId = item._id;
      } else {
        const key = `${itemId}#${path}`;
        if (this.resolvedPaths.has(key)) {
          resolvedItemId = this.resolvedPaths.get(key);
        } else {
          if (this.usePublicApi)
            resolvedItemId = await this.nkclient.publicResolveRelativeItem(itemId, path);
          else
            resolvedItemId = await this.nkclient.resolveRelativeItem(itemId, path);
        }
      }

      return this.loadAdditionalItem(resolvedItemId);
    }
    catch(err) {
      console.log(err);
      throw new LoaderException("ItemRepo: Unable to load additional item!");
    }
  }

  async traverseItems(func, rootItem) {

    if (typeof func !== 'function')
      return;

    const _this = this;
    const map = new Map();

    async function _traverse(item) {

      if (map.has(item._id))
        return;

      map.set(item._id, true);

      const result = func(item);
      if (result && result.then)
        await result;

      if (Array.isArray(item.links)) {
        for (const link of item.links) {
          if (link.item) {
            await _traverse(link.item);
          } else if (link.to) {
            const child = await _this.loadAdditionalItem(link.to);
            await _traverse(child);
          }
        }
      }
    }

    await _traverse(rootItem || this.activeItem);
  }

  async traverseBlocks(func, blocks) {
    for (const block of blocks) {
      const ret = func(block);
      if (ret.then)
        await ret;

      if (Array.isArray(block.blocks) && block.blocks.length) {
        await this.traverseBlocks(func, block.blocks);
      }
    }
  }

  async traverseFieldInstances(func, fieldInstances) {
    const _this = this;
    fieldInstances = fieldInstances || this.activeItem.fieldInstances;

    for (const fieldInstance of fieldInstances) {
      const ret = func(fieldInstance);
      if (ret.then)
        await ret;

      if (Array.isArray(fieldInstance.blocks)) {
        await this.traverseBlocks(async function (block) {
          if (Array.isArray(block.fields) && block.fields.length) {
            await _this.traverseFieldInstances(func, block.fields);
          }
        }, fieldInstance.blocks);
      }
    }
  }

  async replaceLink(oldId, newId) {
    const _this = this;
    const newItem = await _this.loadItemRecursive(newId, true);

    await this.traverseItems(async function(item) {
      //console.log("Traversing item ", item.name, item.type, item._id);
      if (Array.isArray(item.fieldInstances) && item.fieldInstances.length) {
        await _this.traverseFieldInstances(async function(fieldInstance) {
          //console.log("Traversing field instance: ", fieldInstance.type, fieldInstance.name);
          if (fieldInstance.type === "Link" && fieldInstance.value && fieldInstance.value._id === oldId) {
            //console.log(" - replacing ", fieldInstance);
            fieldInstance.value = newItem;
          }
        }, item.fieldInstances);
      }

      for (const link of item.links) {
        //console.log(" - checking link ", link.usage);
        if (link.to === oldId) {
          //console.log(" - replacing link", link);
          link.to = newId;
          link.item = newItem;
        }
      }
    });
  }

  async loadAdditionalItem(id) {
    try {
      if (this.additionalLoadedItems.has(id)) {
        return this.additionalLoadedItems.get(id);
      }

      const item = await this.loadItem(id, true);
      this.additionalLoadedItems.set(id, item);
      return item;
    }
    catch(err) {
      console.log(err);
      throw new LoaderException("ItemRepo: Unable to load additional item!");
    }
  }
  addAdditionalItemRecursive(item) {
    this.additionalLoadedItems.set(item._id, item);
    for (const link of item.links) {
      if (link.item)
        this.addAdditionalItemRecursive(link.item);
    }
  }
  async loadAdditionalItemRecursive(id, dontPrepare, parentId) {
    try {
      let item;
      if (this.additionalLoadedItems.has(id)) {
        item = this.additionalLoadedItems.get(id);

        // We have the item, but we need to check if this item also has all links loaded.
        for (const link of item.links) {
          try {
            if (!link.item) {
              link.item = await this.loadAdditionalItemRecursive(link.to, true);
            }
          }
          catch(err) {
            console.log(err);
          }
        }
      }
      else {
        item = await this.loadItemRecursive(id, true, true);
        this.addAdditionalItemRecursive(item);
      }

      // For package items we will use the loadItemRecursive function to load the package content.
      if (item.type === "Package") {
        const ret = await this.loadItemRecursive(id, true, parentId);
        return ret;
      }

      // Items need to be prepared recursively, because the same item might be
      // used in multiple places and will therefore have different and unique
      // instance ids.
      const prepareItems = async (item) => {
        for (const link of item.links) {
          if (!link.stopRecursion && link.item) {
            // For package items prepare the packageContent instead of the package itself
            if (link.item.type === "Package") {
              link.item.packageContent = await prepareItems(link.item.packageContent);
            } else {
              link.item = await prepareItems(link.item);
            }
          }
        }

        return await this.prepareItem(item);
      }

      if (!dontPrepare)
        item = await prepareItems(item);

      return item;
    }
    catch(err) {
      console.log(err);
      throw new LoaderException("ItemRepo: Unable to load additional item!");
    }
  }

  saveItem(item, recursive, itemMap) {
    const promises = [];

    if (itemMap) {
      if (itemMap.has(item._id))
        return promises;

      itemMap.set(item._id, true);
    }

    if (item.isDirty) {
      this.updateItemLinksAndAttributes(item, false);

      if (!item.version) {
        item.version = { major: 0, minor: 0, revision: 1 };
      }

      // Send data to server
      // -----------------------------------------------------------
      promises.push(this.nkclient.updateItem({
        _id: item._id,
        name: item.name,
        public: item.public,
        type: item.type,
        attributes: item.attributes,
        userAttributes: item.userAttributes,
        links: item.links,
        tags: item.tags,
        contributors: item.contributors,
        description: item.description,
        shortDescription: item.shortDescription,
        categories: item.categories,
        license: item.license,
        version: item.version
      }).then(function(result) {

        console.log(`Saved item ${item.name}. Version ${item.version.major}.${item.version.minor}.${item.version.revision} -> ${result.version.major}.${result.version.minor}.${result.version.revision}`);

        if (result && result.version)
          item.version = result.version;

        item.isDirty = false;
        return item;
      }).catch(function(error) {
        console.error(`Error saving item ${item.name}`, error, item);
        throw error;
      }));

      this.updateItemLinksAndAttributes(item, true);
    }

    // Go to sub-items recursively if requested
    // -----------------------------------------------------------
    if (recursive) {
      const links = [];
      this.getLinksAndAttributes(item, links, null, null, true);

      for (const subItem of links) {
        if (subItem.item) {
          promises.pushAll(this.saveItem(subItem.item, true, itemMap))
        }
      }
    }

    return promises;
  }

  setEditedItemDirty() {
    if (this.editedItem && !this.editedItem.isDirty) {
      this.editedItem.isDirty = true;
      eventBus.$emit('nk:itemRepo:itemBecameDirty', this.editedItem._id);
    }
  }

  saveAdditionalItemChanges(itemMap) {
    let promises = [];

    for (const item of this.additionalLoadedItems.values()) {
      if (item.isDirty) {
        promises = [
            ...promises,
            ...this.saveItem(item, true, itemMap)
        ];
      }
    }

    return promises;
  }

  async save() {
    console.log("Saving changes...");

    const itemMap = new Map();

    const promises = [
        ...this.saveItem(this.activeItem, true, itemMap),
        ...this.saveAdditionalItemChanges(itemMap)
    ];

    if (promises.length === 0) {
      console.log("No changes detected.");
    } else {

      let progress = 0;
      for (const promise of promises) {
        promise.then(function(item) {
          eventBus.$emit('nk:itemRepo:itemSaved', {
            item: item,
            progress: ++progress,
            total: promises.length
          });
        });
      }

      return Promise.all(promises).then(function() {
        console.log("Saved successfully");
        eventBus.$emit('nk:itemRepo:itemsSaved');
      }).catch(function(err) {
        console.error("Error saving:", err);
      });
    }
  }

  existsUnsavedChangesInItem(item, recursive, itemMap) {
    if (itemMap && itemMap.has(item._id))
      return false;

    if (item.isDirty) {
      return true;
    }

    // Go to sub-items recursively if requested
    // -----------------------------------------------------------
    if (recursive) {
      const links = [];
      this.getLinksAndAttributes(item, links, null, null, true);

      for (const subItem of links) {
        if (subItem.item) {
          if (this.existsUnsavedChangesInItem(subItem.item, true, itemMap))
            return true;
        }
      }
    }

    return false;
  }

  existsUnsavedChanges() {
    const itemMap = new Map();

    if (this.existsUnsavedChangesInItem(this.activeItem, true, itemMap))
      return true;

    for (const item of this.additionalLoadedItems.values()) {
      if (this.existsUnsavedChangesInItem(item, true, itemMap))
        return true;
    }

    return false;
  }
}

