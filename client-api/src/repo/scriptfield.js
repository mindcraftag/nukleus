"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import tools from '../tools'
import NkSnapshot from "./snapshot";
import NkSnapshotable from "./snapshotable";

export default class NkScriptField extends NkSnapshotable {

    constructor(script, name, value, item) {
        super(item);

        this.value = value;
        this.script = script;
        this.type = null;
        this.datatype = null;
        this.minValue = null;
        this.maxValue = null;
        this.order = null;
        this.inject = null;

        this.setName(name);
    }

    getId() {
        return this.name;
    }

    setName(name) {
        this.name = name;
        this._updateDisplayName();
    }

    setOrder(order) {
        this.order = order;
    }

    clone() {
        const clonedField = new NkScriptField();

        clonedField.ownerItem = this.ownerItem;
        clonedField.value = this.value;
        clonedField.script = this.script;
        clonedField.type = this.type;
        clonedField.minValue = this.minValue;
        clonedField.maxValue = this.maxValue;
        clonedField.order = this.order;

        clonedField.setName(this.name);

        return clonedField;
    }

    clearDefinition() {
        this.type = null;
    }

    setDefinition(def) {
        this.inject = def.inject;
        const type = def.type.toLowerCase();
        switch(type) {
            case "boolean":
            case "bool":
                this.type = "Attribute";
                this.datatype = "Boolean";
                this.value = this.value !== undefined ? this._toBoolean(this.value) : this._toBoolean(def.defaultValue);
                break;

            case "number":
                this.type = "Attribute";
                this.datatype = "Float";
                this.value = this.value !== undefined ? Number(this.value) : Number(def.defaultValue);
                const params = this._parseTypeParams(def.typeparams, 2);
                if (params) {
                    this.minValue = Number(params[0]);
                    this.maxValue = Number(params[1]);
                } else {
                    this.minValue = undefined;
                    this.maxValue = undefined;
                }
                break;

            case "string":
                this.type = "Attribute";
                this.datatype = "String";
                this.value = this.value ? this.value.toString() : (def.defaultValue ? def.defaultValue.toString() : "");
                break;

            case "node":
                this.type = "Attribute";
                this.datatype = "Node";
                break;

            default:
                console.error("Unknown script field type: " + type);
                this.type = "Attribute";
                this.datatype = "String";
                this.value = this.value ? this.value.toString() : (def.defaultValue ? def.defaultValue.toString() : "");
                break;
        }
    }

    _toBoolean(value) {
        if (value === null || value === undefined)
            return false;

        if (value === true || value === false)
            return value;

        return value.toString().toLowerCase() !== "false";
    }

    _updateDisplayName() {
        if (this.name && typeof this.name === 'string')
            this.displayName = tools.toUserFriendlyName(this.name);
        else
            this.displayName = "";
    }

    _parseTypeParams(text, expectedCount) {
        if (!text)
            return null;

        const parts = text.split(",").map((x) => x.trim());
        if (parts.length !== expectedCount)
            return null;

        return parts;
    }

    createSnapshot() {
        return new NkSnapshot(this.name, "scriptfield", {
            type: this.type,
            name: this.name,
            value: this.value,
            datatype: this.datatype,
            minValue: this.minValue,
            maxValue: this.maxValue
        });
    }

}
