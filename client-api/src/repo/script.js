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
import proxyTools from "../proxytools";
import NkScriptField from "./scriptfield";
import NkSnapshot from "./snapshot";
import NkSnapshotable from "./snapshotable";
import {createField} from "./field";

export default class NkScript extends NkSnapshotable {

    constructor(id, block, item, scriptItemId) {
        super(item);

        if (id instanceof NkSnapshot) {
            this.restoreFromSnapshot(id, block);
        } else {
            this.id = id || tools.createGUID();
            this.block = block;
            this.fields = [];
            this.item = {
                value: scriptItemId || null,
                linkableItems: [],
                linkableTypes: ['Script']
            }
        }

        this.item = proxyTools.proxyScriptItem(this.item, this, this.ownerItem);
        this.fields = proxyTools.proxyScriptFieldsArray(this.fields, this, this.ownerItem);
    }

    getId() {
        return this.id;
    }

    clone() {
        const clonedScript = new NkScript(undefined, this.block, this.ownerItem, this.item.value);

        // clone fields
        for (const field of this.fields) {
            const clonedField = field.clone();
            clonedField.script = clonedScript;
            clonedScript.fields.push(proxyTools.proxyScriptField(clonedField, clonedScript, this.ownerItem));
        }

        return clonedScript;
    }

    createFieldsFromDefinition(fieldDefArray) {
        fieldDefArray = fieldDefArray || [];

        function findInArray(arr, name) {
            for (const entry of arr) {
                if (entry.name === name)
                    return entry;
            }
            return null;
        }

        // Get rid of type information for all fields that are not in the definition
        // ---------------------------------------------------------------------------
        for (const field of this.fields) {
            if (!findInArray(fieldDefArray, field.name)) {
                field.clearDefinition();
            }
        }

        // Set definition of all the rest of the fields that DO exist
        // ---------------------------------------------------------------------------
        let index = 0;
        for (const fieldDef of fieldDefArray) {
            let field = findInArray(this.fields, fieldDef.name);
            if (!field) {
                field = new NkScriptField(this, fieldDef.name, undefined, this.ownerItem);
                this.fields.push(proxyTools.proxyScriptField(field, this, this.ownerItem));
            }

            field.setOrder(index++);
            field.setDefinition(fieldDef);
        }

        // sort fields by their order index
        this.fields.sort(function(a, b) { return a.order - b.order; });
    }

    clearFieldTypes() {
        this.createFieldsFromDefinition();
    }

    addField(field) {
        this.fields.push(proxyTools.proxyScriptField(field, this, this.ownerItem));
    }

    createSnapshot() {

        const fields = [];
        for (const field of this.fields) {
            fields.push(field.createSnapshot());
        }

        return new NkSnapshot(this.id, "script", {
            id: this.id,
            item: this.item.value,
            fields: fields,
        });
    }

    restoreFromSnapshot(snapshot, block) {
        const _this = this;

        this.id = snapshot.data.id;
        this.block = block;
        this.item = {
            value: snapshot.data.item,
            linkableItems: [],
            linkableTypes: ['Script']
        }

        // Restore fields
        // ----------------------------------------------------------------------------------------
        const fields = [];
        this._rollbackArray(fields, snapshot.data.fields, function(snapshot) {
            return proxyTools.proxyBlockField(createField(snapshot), _this, _this.ownerItem);
        });
        this.fields = fields;
    }

    rollbackFromSnapshot(snapshot) {
        const _this = this;

        // Rollback fields
        // ----------------------------------------------------------------------------------------
        this._rollbackArray(this.fields, snapshot.data.fields, function(snapshot) {
            return proxyTools.proxyBlockField(createField(snapshot), _this, _this.ownerItem);
        });
    }

}
