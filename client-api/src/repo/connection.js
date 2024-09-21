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
import NkSnapshot from "./snapshot";
import NkSnapshotable from "./snapshotable";

export default class NkConnection extends NkSnapshotable {

    constructor(id, item, data) {
        super(item);

        this.id = id || tools.createGUID();
        this.srcNode = data.srcNode;
        this.srcSlot = data.srcSlot;
        this.destNode = data.destNode;
        this.destSlot = data.destSlot;
        this.posX = data.posX || 0;
        this.posY = data.posY || 0;
    }

    getId() {
        return this.id;
    }

    setPosition(x, y) {
        this.posX = x;
        this.posY = y;
    }

    getPosX() {
        return this.posX;
    }

    getPosY() {
        return this.posY;
    }

    getSrcNode() {
        return this.srcNode;
    }

    getDestNode() {
        return this.destNode;
    }

    getSrcSlot() {
        return this.srcSlot;
    }

    getDestSlot() {
        return this.destSlot;
    }

    setSrcNode(value) {
        this.srcNode = value;
    }

    setDestNode(value) {
        this.destNode = value;
    }

    setSrcSlot(value) {
        this.srcSlot = value;
    }

    setDestSlot(value) {
        this.destSlot = value;
    }

    clone() {
        return new NkConnection(undefined, this.ownerItem, {
            srcNode: this.srcNode,
            srcSlot: this.srcSlot,
            destNode: this.destNode,
            destSlot: this.destSlot,
            posX: this.posX,
            posY: this.posY
        });
    }

    createSnapshot() {
        return new NkSnapshot(this.id, "connection", {
            id: this.id,
            srcNode: this.srcNode,
            srcSlot: this.srcSlot,
            destNode: this.destNode,
            destSlot: this.destSlot,
            posX: this.posX,
            posY: this.posY
        });
    }

    restoreFromSnapshot(snapshot) {
        this.id = snapshot.id;
        this.srcNode = snapshot.data.srcNode;
        this.srcSlot = snapshot.data.srcSlot;
        this.destNode = snapshot.data.destNode;
        this.destSlot = snapshot.data.destSlot;
        this.posX = snapshot.data.posX;
        this.posY = snapshot.data.posY;
    }

    rollbackFromSnapshot(snapshot) {
        this.srcNode = snapshot.data.srcNode;
        this.srcSlot = snapshot.data.srcSlot;
        this.destNode = snapshot.data.destNode;
        this.destSlot = snapshot.data.destSlot;
        this.posX = snapshot.data.posX;
        this.posY = snapshot.data.posY;
    }

}
