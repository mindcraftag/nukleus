"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default class NkSnapshotable {

    constructor(ownerItem) {
        this.ownerItem = ownerItem;
    }

    createSnapshot() {
        throw "createSnapshot not implemented!";
    }

    restoreFromSnapshot(snapshot) {
        // This function will assume the object is completely wiped and needs to be recreated from scratch
        throw "restoreFromSnapshot not implemented!"
    }

    rollbackFromSnapshot(snapshot) {
        // This function will assume the object has just changed and will thus restore only the variable bits
        throw "rollbackFromSnapshot not implemented!"
    }

    _getElementById(id, array) {
        for (const element of array) {
            if (element.id === id)
                return element;
        }
        return null;
    }

    _rollbackArray(array, arraySnapshot, elementCreator) {

        if (!Array.isArray(array)) {
            console.log("_rollbackArray(): no array given!");
            return;
        }

        // Make a list of all elements that are in the snapshot but cannot be found in the current list anymore.
        // Those were deleted and need to be added again.
        // Also note all the elements that need to be rolled back with their snapshot data
        // ------------------------------------------------------------------------------------
        const deletedElements = [];
        const rollbackElements = [];
        let position = 0;
        for (const elementSnapshot of arraySnapshot) {
            const element = this._getElementById(elementSnapshot.id, array);
            if (!element)
                deletedElements.push({ position: position, snapshot: elementSnapshot });
            else
                rollbackElements.push({ element: element, snapshot: elementSnapshot });

            position++;
        }

        // Make a list of all elements that are in the current list but not in the snapshot.
        // Those were added and need to be removed again
        // ------------------------------------------------------------------------------------
        const addedElements = [];
        position = 0;
        for (const element of array) {
            const elementSnapshot = this._getElementById(element.id, arraySnapshot);
            if (!elementSnapshot)
                addedElements.push(position - addedElements.length); // subtract the current amount of deleted elements as correction

            position++;
        }

        // Remove any added elements
        // ------------------------------------------------------------------------------------
        for (const position of addedElements) {
            array.splice(position, 1);
        }

        // Rollback any snapshots
        // ------------------------------------------------------------------------------------
        for (const entry of rollbackElements) {
            entry.element.rollbackFromSnapshot(entry.snapshot);
        }

        // Lastly, add anything that was deleted
        // ------------------------------------------------------------------------------------
        for (const entry of deletedElements) {
            const restoredElement = elementCreator(entry.snapshot, this);
            array.splice(entry.position, 0, restoredElement);
        }

    }
}
