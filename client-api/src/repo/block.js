"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import tools from "../tools";
import proxyTools from '../proxytools.js'
import NkSnapshot from "./snapshot";
import NkSnapshotable from "./snapshotable";
import NkScript from './script'
import NkField, { createField } from './field'

export default class NkBlock extends NkSnapshotable {

  constructor(id, parent, type, name, displayName, item) {
    super(item);

    if (id instanceof NkSnapshot) {
      this.restoreFromSnapshot(id, parent);
    } else {
      this.id = id || tools.createGUID();
      this.parent = parent;
      this.type = type;
      this.name = name || this.type;
      this.displayName = displayName || this.name;
      this.fields = [];
      this.blocks = [];
      this.isSelected = false;
      this.isExpanded = true;
      this.scripts = [];

      // for graph nodes:
      this.inputs = [];
      this.outputs = [];
      this.posX = 0;
      this.posY = 0;
    }
  }

  getId() {
    return this.id;
  }

  clone(proxyItem) {
    const clonedBlock = new NkBlock();

    clonedBlock.ownerItem = this.ownerItem;
    clonedBlock.parent = this.parent;
    clonedBlock.type = this.type;
    clonedBlock.name = this.name;
    clonedBlock.displayName = this.displayName;
    clonedBlock.isSelected = false;
    clonedBlock.isExpanded = true;
    clonedBlock.inputs = this.inputs;
    clonedBlock.outputs = this.outputs;
    clonedBlock.posX = 0;
    clonedBlock.posY = 0;

    // clone fields
    // -------------------------------------------------------------------------------------------
    for (const field of this.fields) {
      let clonedField;

      if (field instanceof NkField) {
        clonedField = field.clone(proxyItem);
      }
      else {
        clonedField = structuredClone(proxyItem)
      }

      if (proxyItem)
        clonedField = proxyTools.proxyBlockField(clonedField, clonedBlock, proxyItem);

      clonedBlock.fields.push(clonedField);
    }

    // clone scripts
    // -------------------------------------------------------------------------------------------
    if (proxyItem)
      clonedBlock.scripts = proxyTools.proxyScriptArray(clonedBlock.scripts, clonedBlock, proxyItem);

    for (const script of this.scripts) {
      const clonedScript = script.clone();
      clonedBlock.scripts.push(clonedScript);
    }

    // clone blocks
    // -------------------------------------------------------------------------------------------
    const childBlocks = clonedBlock.blocks;

    if (proxyItem)
      clonedBlock.blocks = proxyTools.proxyBlockArray(childBlocks, clonedBlock, proxyItem);

    for (const block of this.blocks) {
      let clonedChildBlock = block.clone(proxyItem);
      clonedChildBlock.parent = clonedBlock;

      if (proxyItem)
        clonedChildBlock = proxyTools.proxyBlock(clonedChildBlock, proxyItem);

      childBlocks.push(clonedChildBlock);
    }

    return clonedBlock;
  }

  setFields(fields) {
    this.fields = fields;
  }

  setInputs(inputs) {
    this.inputs = inputs;
  }

  setOutputs(outputs) {
    this.outputs = outputs;
  }

  setPosition(x, y) {
    this.posX = x;
    this.posY = y;
  }

  setSelected(value) {
    this.isSelected = value;
  }

  setExpanded(value) {
    this.isExpanded = value;
  }

  getRoot() {
    if (this.parent) {
      return this.parent.getRoot();
    }
    return this;
  }

  findBlock(id) {
    if (this.id === id)
      return this;

    for (const block of this.blocks) {
      const found = block.findBlock(id);
      if (found)
        return found;
    }

    return null;
  }

  removeBlock(block) {
    this.blocks.removeObject(block);
  }

  addBlock(block, position) {
    if (!this.blocks.includes(block)) {
      if (position === undefined)
        this.blocks.push(block);
      else {
        this.blocks.splice(position, 0, block);
      }
    }
  }

  moveBlock(block, position) {
    this.removeBlock(block);
    this.addBlock(block, position);
  }

  moveToPosition(position) {
    console.log(`Node was moved to position ${position}`);
    this.parent.moveBlock(this, position);
  }

  moveToParent(parentId, position) {
    console.log("Node was moved from", this.parent, "to", parentId);

    const childParent = this.findBlock(parentId);
    if (childParent) {
      console.error("Cannot move block to a parent that is a child.");
      return;
    }

    const root = this.getRoot();
    if (!root) {
      console.error("Cannot find root block!");
      return;
    }

    const newParent = root.findBlock(parentId);
    if (!newParent) {
      console.error(`Cannot find the new parent block: ${parentId}`);
      return;
    }

    this.parent.removeBlock(this);
    newParent.addBlock(this, position);
    this.parent = newParent;
  }

  getField(name) {
    for (const field of this.fields) {
      if (field.name === name) {
        return field;
      }
    }
    return null;
  }

  hasTag(tag) {
    const field = this.getField("Tags");
    if (field && Array.isArray(field.value))
      return field.value.includes(tag);

    return false;
  }

  getNameFieldValue() {
    const field = this.getField("Name");
    if (field)
      return field.value;

    return null;
  }

  getActiveFieldValue() {
    const field = this.getField("Active");
    if (field)
      return field.value;

    return true;
  }

  createSnapshot(dontRecurseIntoBlocks, fromAnimatedValues) {

    const fields = [];
    for (const field of this.fields) {
      if (field.createSnapshot)
        fields.push(field.createSnapshot(dontRecurseIntoBlocks, fromAnimatedValues));
    }

    const blocks = [];
    if (!dontRecurseIntoBlocks) {
      for (const block of this.blocks) {
        blocks.push(block.createSnapshot(dontRecurseIntoBlocks, fromAnimatedValues));
      }
    }

    const scripts = [];
    for (const script of this.scripts) {
      scripts.push(script.createSnapshot());
    }

    return new NkSnapshot(this.id, "block", {
      id: this.id,
      ownerItem: this.ownerItem,
      type: this.type,
      name: this.name,
      displayName: this.displayName,
      fields: fields,
      blocks: blocks,
      isExpanded: this.isExpanded,
      scripts: scripts,
      inputs: this.inputs,
      outputs: this.outputs,
      posX: this.posX,
      posY: this.posY
    });
  }

  restoreFromSnapshot(snapshot, parent) {
    const _this = this;

    this.id = snapshot.data.id;
    this.parent = parent;
    this.type = snapshot.data.type;
    this.ownerItem = snapshot.data.ownerItem;
    this.name = snapshot.data.name;
    this.displayName = snapshot.data.displayName;
    this.isSelected = false;
    this.isExpanded = snapshot.data.isExpanded;
    this.inputs = snapshot.data.inputs;
    this.outputs = snapshot.data.outputs;
    this.posX = snapshot.data.posX;
    this.posY = snapshot.data.posY;

    // Restore fields
    // ----------------------------------------------------------------------------------------
    const fields = [];
    this._rollbackArray(fields, snapshot.data.fields, function(snapshot) {
      return proxyTools.proxyBlockField(createField(snapshot), _this, _this.ownerItem);
    });
    this.fields = fields;

    // Restore blocks
    // ----------------------------------------------------------------------------------------
    const blocks = [];
    this._rollbackArray(blocks, snapshot.data.blocks, function(snapshot, parent) {
      return proxyTools.proxyBlock(new NkBlock(snapshot, parent), _this.ownerItem);
    });
    this.blocks = proxyTools.proxyBlockArray(blocks, this, this.ownerItem);

    // Restore scripts
    // ----------------------------------------------------------------------------------------
    const scripts = [];
    this._rollbackArray(scripts, snapshot.data.scripts, function(snapshot, parent) {
      return proxyTools.proxyBlock(new NkScript(snapshot, parent, _this.ownerItem), _this.ownerItem);
    });
    this.scripts = proxyTools.proxyScriptArray(scripts, this, this.ownerItem);
  }

  rollbackFromSnapshot(snapshot, dontRecurseIntoBlocks) {
    const _this = this;

    // Rollback fields
    // ----------------------------------------------------------------------------------------
    this._rollbackArray(this.fields, snapshot.data.fields, function(snapshot) {
      return proxyTools.proxyBlockField(createField(snapshot), _this, _this.ownerItem);
    });

    if (!dontRecurseIntoBlocks) {
      // Rollback blocks
      // ----------------------------------------------------------------------------------------
      this._rollbackArray(this.blocks, snapshot.data.blocks, function (snapshot, parent) {
        return proxyTools.proxyBlock(new NkBlock(snapshot, parent), _this.ownerItem);
      });
    }
  }

  _getFieldByName(name, fields) {
    for (const field of fields) {
      if (field.id === name)
        return field;
    }
    return null;
  }

}
