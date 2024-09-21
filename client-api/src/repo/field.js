"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import proxyTools from '../proxytools.js';
import tools from '../tools';
import eventBus from '../eventbus';
import NkSnapshot from "./snapshot";
import NkSnapshotable from "./snapshotable";
import NkBlock from "./block";
import NkConnection from "./connection";

export default class NkField extends NkSnapshotable {

  constructor(name, displayName, type, value, item, itemRepo, linkableItemsCache) {
    super(item);

    if (name instanceof NkSnapshot) {
      this.restoreFromSnapshot(name);
    } else {

      tools.assert(name, "Field has no name!");
      tools.assert(type, "Field has no type!");

      this.id = tools.createGUID();
      this.name = name;
      this.displayName = displayName;

      if (this.displayName === null || this.displayName === undefined)
        this.displayName = name;

      this.type = type;
      this.internalValue = value;
      this.info = null;
      this.preload = true;
      this.loadingManagerRule = "load";
      this.item = item;
      this.itemRepo = itemRepo;

      // conditions
      this.condition = null;
      this.conditionFields = [];
      this.conditionFieldNames = [];
      this.dependantFields = [];
      this.hidden = false;
      this.dependenciesInitialized = false;

      // for links
      this.linkableTypes = [];
      this.linkableItemsCache = linkableItemsCache;

      // for separators
      this.collapsed = false;

      // for attributes
      this.datatype = null;
      this.defaultValue = null;
      this.minValue = null;
      this.maxValue = null;
      this.language = null;
      this.widget = null;
      this.length = null;

      // for lists, trees and graphs
      this.blocks = [];
      this.connections = [];
      this.templates = [];
      this.elementName = null;
    }

    const _this = this;

    //  Add options property
    // ------------------------------------------------------------
    let _internalOptions = null;
    Object.defineProperty(this, 'options', {
      get: function() {
        return _internalOptions;
      },
      set: function(value) {
        _internalOptions = value;
        _this.calculateCondition();
      },
      enumerable: false,
      configurable: true
    });

    //  Add linkable items property
    // ------------------------------------------------------------
    Object.defineProperty(this, 'linkableItems', {
      get: async function() {
        if (_this.linkableItemsCache) {
          return await _this.linkableItemsCache.loadLinkableItems(_this.item, _this);
        }
        return [];
      },
      enumerable: false,
      configurable: true
    });

    //  Add Value property
    // ------------------------------------------------------------
    Object.defineProperty(this, 'value', {
      get: function() {
        if (_this.animatedValue !== undefined)
          return _this.animatedValue;

        return _this.internalValue;
      },
      set: function(value) {
        _this.internalValue = value;
        _this._processDependencies();
      },
      enumerable: true,
      configurable: true
    });

    //  Add Animated Value property
    // ------------------------------------------------------------
    let _animatedValue = undefined;
    Object.defineProperty(this, 'animatedValue', {
      get: function() {
        return _animatedValue;
      },
      set: function(value) {
        _animatedValue = value;
        _this._processDependencies();
      },
      enumerable: true,
      configurable: true
    });
  }

  getId() {
    return this.id;
  }

  clone(proxyItem) {
    let clonedField = new NkField(this.name, this.displayName, this.type);

    if(this.internalValue === undefined) {
      clonedField.internalValue = undefined;
    }
    else if (this.type === "Link" ) {
      clonedField.internalValue = this.internalValue;
    }
    else {
      clonedField.internalValue = JSON.parse(JSON.stringify(this.internalValue));
    }

    clonedField.info = this.info;
    clonedField.preload = this.preload;
    clonedField.loadingManagerRule = this.loadingManagerRule;
    clonedField.item = this.item;
    clonedField.ownerItem = this.ownerItem;
    clonedField.itemRepo = this.itemRepo;

    // conditions
    clonedField.condition = this.condition;
    clonedField.conditionFields = this.conditionFields;
    clonedField.conditionFieldNames = this.conditionFieldNames;
    clonedField.dependantFields = this.dependantFields;
    clonedField.hidden = this.hidden;

    // for separators
    clonedField.collapsed = this.collapsed;

    // for links
    clonedField.linkableTypes = this.linkableTypes;
    clonedField.linkableItemsCache = this.linkableItemsCache;

    // for attributes
    clonedField.datatype = this.datatype;
    clonedField.defaultValue = this.defaultValue;
    clonedField.minValue = this.minValue;
    clonedField.maxValue = this.maxValue;
    clonedField.options = this.options;
    clonedField.language = this.language;
    clonedField.widget = this.widget;
    clonedField.length = this.length;

    // for lists and trees
    for (const block of this.blocks) {
      let clonedBlock = block.clone(proxyItem);

      if (proxyItem)
        clonedBlock = proxyTools.proxyBlock(clonedBlock, proxyItem);

      clonedField.blocks.push(clonedBlock);
    }

    // for graphs
    for (const connection of this.connections) {
      let clonedConnection = connection.clone(proxyItem);

      if (proxyItem)
        clonedConnection = proxyTools.proxyConnection(clonedConnection, proxyItem);

      clonedField.connections.push(clonedConnection);
    }

    clonedField.templates = this.templates;
    clonedField.elementName = this.elementName;

    return clonedField;
  }

  _processDependencies() {
    for (const field of this.dependantFields) {
      field.calculateCondition();
    }
  }

  _getConditionField(name) {
    for (const field of this.conditionFields) {
      if (field && field.name === name)
        return field;
    }
    return null;
  }

  _calculateConditionField(name, value) {
    if (name.startsWith("$")) {
      // Any fields starting with $ mean we are not looking for an actual field but a computed value.
      // ----------------------------------------------------------------------------------------------
      switch(name) {
        case "$isroot":
          const isroot = this.item._id === this.itemRepo.rootItemId;
          return isroot === value;

        case "$parenttype":
          console.log("$parenttype is not yet implemented!");
          break;

        case "$optionsexist":
          const optionsexist = Array.isArray(this.options) && this.options.length > 0;
          return optionsexist === value;

        case "$featureenabled":
          return this.itemRepo.nkclient.isFeatureEnabled(value);

        default:
          console.error("Computed value unknown: " + name);
          return false;
      }
    } else {
      // We're looking for an actual field
      // ----------------------------------------------------------------------------------------------
      const field = this._getConditionField(name);
      if (!field) {
        console.error("Field to resolve condition not found: " + name);
        return false;
      }

      if (typeof value === 'object') {

        // The fields value is an object. So must be some kind of operator. Check which
        if (value['$isset'] !== undefined) {
          return value['$isset'] === !!field.value;
        } else if (value['$not'] !== undefined) {
          return value['$not'] !== field.value;
        } else {
          console.error("Condition value cannot be interpreted: ", value);
          return false;
        }

      } else {

        // Compare the condition value with the field's value
        return field.value == value;
      }
    }
  }

  _calculateConditionBlock(condition) {
    for (const name in condition) {
      if (condition.hasOwnProperty(name)) {
        const conditionValue = condition[name];

        if (name === "$or") {
          if (Array.isArray(conditionValue)) {
            let oneIsTrue = false;
            for (const entry of conditionValue) {
              if (this._calculateConditionBlock(entry)) {
                oneIsTrue = true;
                break;
              }
            }

            if (!oneIsTrue)
              return false;

          } else {
            console.error("Condition contains $or but its value is not an array!");
          }
        } else if (name === "$not") {
          if (typeof conditionValue !== 'object') {
            console.error("When using the $not operator, the value needs to be an object");
          } else {
            if (this._calculateConditionBlock(conditionValue))
              return false;
          }
        } else {
          if (!this._calculateConditionField(name, conditionValue))
            return false;
        }
      }
    }

    return true;
  }

  calculateCondition() {
    if (!this.condition || !this.dependenciesInitialized)
      return;

    const hidden = !this._calculateConditionBlock(this.condition);
    if (hidden !== this.hidden) {
      this.hidden = hidden;
      eventBus.$emit('nk:field:hiddenChanged', this.id, this.hidden);
    }
  }

  refreshDependantFields(fields) {

    // First build a list of all fields, that depend on this fields value
    // ---------------------------------------------------------------------
    this.dependantFields = [];
    for (const field of fields) {
      if (Array.isArray(field.conditionFieldNames)) {
        if (field.conditionFieldNames.includes(this.name))
          this.dependantFields.push(field);
      }
    }

    // Now if we also have a condition, build the reverse list of all fields that
    // this field is dependant on
    // ---------------------------------------------------------------------
    if (this.condition) {
      this.conditionFields = [];
      for (const name of this.conditionFieldNames) {
        let found = false;
        for (const field of fields) {
          if (field.name === name) {
            this.conditionFields.push(field);
            found = true;
            break;
          }
        }
        if (!found) {
          console.warn("Condition field not found: " + name);
          this.conditionFields.push(null);
        }
      }
    }

    this.dependenciesInitialized = true;
  }

  setCondition(condition) {
    if (!condition) {
      this.condition = null;
    }
    else if (typeof condition === 'object')
      this.condition = condition;
    else {
      console.error("Condition must be an object if set", condition);
      this.condition = null;
    }

    this.conditionFieldNames = [];
    if (this.condition) {
      this._scanConditions(this.condition)
    }
  }

  _scanConditions(condition) {
    for (const key in condition) {
      if (condition.hasOwnProperty(key)) {
        const value = condition[key];
        if (Array.isArray(value)) {
          for (const childCondition of value) {
            this._scanConditions(childCondition);
          }
        } else {
          if (!this.conditionFieldNames.includes(key) && !key.startsWith("$"))
            this.conditionFieldNames.push(key);
        }
      }
    }
  }

  setInfo(info) {
    this.info = info;
  }

  setPreload(preload) {
    this.preload = preload;
  }

  setLoadingManagerRule(rule) {
    this.loadingManagerRule = rule;
  }

  setLinkableTypes(types) {
    this.linkableTypes = types;
  }

  setDefaultValue(value) {
    this.defaultValue = value;

    if (this.internalValue === undefined || this.internalValue === null)
      this.internalValue = value;
  }

  setMinValue(value) {
    this.minValue = value;
  }

  setMaxValue(value) {
    this.maxValue = value;
  }

  setOptions(options) {
    this.options = options;
  }

  setDatatype(datatype) {
    this.datatype = datatype;
  }

  setLanguage(language) {
    this.language = language;
  }

  setLength(length) {
    this.length = length;
  }

  setWidget(widget) {
    this.widget = widget;
  }

  setBlocks(blocks) {
    this.blocks = blocks;
  }

  setConnections(connections) {
    this.connections = connections;
  }

  setTemplates(templates) {
    this.templates = templates;
  }

  setElementName(name) {
    this.elementName = name;
  }

  setCollapsed(value) {
    this.collapsed = !!value;
  }

  createSnapshot(dontRecurseIntoBlocks, fromAnimatedValue) {
    tools.assert(this.id, "Field has no ID. Cannot create snapshot");

    const blocks = [];
    for (const block of this.blocks) {
      blocks.push(block.createSnapshot(dontRecurseIntoBlocks, fromAnimatedValue));
    }

    const connections = [];
    for (const connection of this.connections) {
      connections.push(connection.createSnapshot());
    }

    return new NkSnapshot(this.id, "field", {
      name: this.name,
      displayName: this.displayName,
      type: this.type,
      value: fromAnimatedValue ? this.value : this.internalValue,
      preload: this.preload,
      info: this.info,
      loadingManagerRule: this.loadingManagerRule,
      item: this.item,
      itemRepo: this.itemRepo,

      condition: this.condition,
      conditionFields: this.conditionFields,
      conditionFieldNames: this.conditionFieldNames,
      dependantFields: this.dependantFields,
      hidden: this.hidden,

      linkableTypes: this.linkableTypes,
      linkableItemsCache: this.linkableItemsCache,

      collapsed: this.collapsed,

      datatype: this.datatype,
      defaultValue: this.defaultValue,
      minValue: this.minValue,
      maxValue: this.maxValue,
      options: this.options,
      language: this.language,
      widget: this.widget,
      length: this.length,

      templates: this.templates,
      elementName: this.elementName,

      blocks: blocks,
      connections: connections
    });
  }

  restoreFromSnapshot(snapshot) {
    const _this = this;

    this.id = snapshot.id;
    this.name = snapshot.data.name;
    this.displayName = snapshot.data.displayName;
    this.type = snapshot.data.type;
    this.internalValue = snapshot.data.value;
    this.info = snapshot.data.info;
    this.preload = snapshot.data.preload;
    this.loadingManagerRule = snapshot.data.loadingManagerRule;
    this.item = snapshot.data.item;
    this.ownerItem = snapshot.data.item;
    this.itemRepo = snapshot.data.itemRepo;

    // conditions
    this.condition = snapshot.data.condition;
    this.conditionFields = snapshot.data.conditionFields;
    this.conditionFieldNames = snapshot.data.conditionFieldNames;
    this.dependantFields = snapshot.data.dependantFields;
    this.hidden = snapshot.data.hidden;

    // for links
    this.linkableTypes = snapshot.data.linkableTypes;
    this.linkableItemsCache = snapshot.data.linkableItemsCache;

    // for separators
    this.collapsed = snapshot.data.collapsed;

    // for attributes
    this.datatype = snapshot.data.datatype;
    this.defaultValue = snapshot.data.defaultValue;
    this.minValue = snapshot.data.minValue;
    this.maxValue = snapshot.data.maxValue;
    this.options = snapshot.data.options;
    this.language = snapshot.data.language;
    this.widget = snapshot.data.widget;
    this.length = snapshot.data.length;

    // for lists and trees
    this.blocks = [];
    this.connections = [];
    this.templates = snapshot.data.templates;
    this.elementName = snapshot.data.elementName;

    this._rollbackArray(this.blocks, snapshot.data.blocks, function(snapshot, parent) {
      return proxyTools.proxyBlock(new NkBlock(snapshot, parent), _this.ownerItem);
    });

    this._rollbackArray(this.connections, snapshot.data.connections, function(snapshot, parent) {
      return proxyTools.proxyConnection(new NkConnection(snapshot, parent), _this.ownerItem);
    });
  }

  rollbackFromSnapshot(snapshot) {
    const _this = this;

    this.value = snapshot.data.value;
    this.animatedValue = undefined;

    this._rollbackArray(this.blocks, snapshot.data.blocks, function(snapshot, parent) {
      return proxyTools.proxyBlock(new NkBlock(snapshot, parent), _this.ownerItem);
    });

    this._rollbackArray(this.connections, snapshot.data.connections, function(snapshot, parent) {
      return proxyTools.proxyConnection(new NkConnection(snapshot, parent), _this.ownerItem);
    });
  }

}

function createField(name, displayName, type, value, item, itemRepo, linkableItemsCache) {
  return new NkField(name, displayName, type, value, item, itemRepo, linkableItemsCache);
}

export { createField };
