"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

// an event is only mergeable if it happened within the last max merge time
const MAX_MERGE_TIME_IN_MS = 75;

export default class NkProxyEvent {

    constructor(type, itemId, elementId, target, prop, value, oldValue) {
        this.type = type;
        this.itemId = itemId;
        this.elementId = elementId;
        this.target = target;
        this.prop = prop;
        this.value = value;
        this.oldValue = oldValue;
        this.createdAt = Date.now();
    }

    setRange(start, length) {
        this.start = start;
        this.length = length;
    }

    setPosition(position) {
        this.position = position;
    }

    setElementsToDelete(elements) {
        this.elementsToDelete = elements;
    }

    setField(field) {
        this.field = field;
    }

    setFieldId(id) {
        this.fieldId = id;
    }

    setIsLink(isLink) {
        this.isLink = isLink;
    }

    clone() {
        return Object.assign(new NkProxyEvent(), this);
    }

    isWithinMergeDeltaOf(other) {
        const deltaTime = Math.abs(other.createdAt - this.createdAt);

        return deltaTime <= MAX_MERGE_TIME_IN_MS;
    }

    isMergeableWith(other) {
        if (!this.isWithinMergeDeltaOf(other)) return false;
        
        const isOfSameType = other.type === this.type &&
            other.itemId === this.itemId &&
            other.elementId === this.elementId &&
            other.target === this.target &&
            other.prop === this.prop;

        const setsValue = other.value &&
            other.oldValue &&
            other.start === undefined &&
            other.length === undefined &&
            other.position === undefined &&
            other.elementsToDelete === undefined;

        return isOfSameType && setsValue;
    }

    merge(other) {
        if (!this.isMergeableWith(other))
            return null;

        let newEvent = this.clone();
        newEvent.value = other.value;
        newEvent.createdAt = other.createdAt;
        return newEvent;
    }

}

