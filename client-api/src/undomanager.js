"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import eventBus from "./eventbus";
import proxyTools from './proxytools'
import tools from './tools'
import {InvalidArgumentException} from "./exception";
import NkSnapshot from "./repo/snapshot";

// an event is bundled with the last event if they happened right after another (= within max bundle time)
// they will have the same bundleIndex
const MAX_BUNDLE_TIME_IN_MS = 75;

export default class NkUndoManager {

    constructor(itemRepo, maxUndoCount) {
        this.itemRepo = itemRepo;
        this.undoEvents = [];
        this.redoEvents = [];
        this.maxUndoCount = maxUndoCount || 100;
        this.enabled = true;
        this.snapshots = new Map();

        proxyTools.setUndoManager(this);

        eventBus.$on('nk:undoManager:undo', (count) => this.undo(count));
        eventBus.$on('nk:undoManager:redo', (count) => this.redo(count));
    }

    clear() {
        this.undoEvents = [];
        this.redoEvents = [];
        this.snapshots.clear();
        eventBus.$emit('nk:undoManager:undoStepsChanged', 0);
        eventBus.$emit('nk:undoManager:redoStepsChanged', 0);
    }

    createSnapshot() {
        const id = tools.createGUID();

        const snapshot = {
            id: id,
            items: []
        };

        // There may be multiple instances of the same item because when the
        // same scene is loaded multiple times it will always have different and
        // unique instance ids. Therefore we add an index to differentiate them.
        for (const items of this.itemRepo.loadedItems.values()) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                snapshot.items.push({
                    id: item._id,
                    idx: i,
                    data: this._grabSnapshot(item)
                });
            }
        }

        this.snapshots.set(id, snapshot);
        return id;
    }

    rollbackFromSnapshot(id) {
        const snapshot = this.snapshots.get(id);
        if (!snapshot)
            throw new InvalidArgumentException("Snapshot not found");

        for (const entry of snapshot.items) {
            const items = this.itemRepo.loadedItems.get(entry.id);
            // Use the index to find the correct item instance.
            if (items) {
                const item = items[entry.idx];
                this._rollbackFromSnapshot(item, entry.data);
            } else {
                console.error("Trying to rollback snapshot for item but did not find the item: " + entry.id);
            }

        }

        this.snapshots.delete(id);
    }

    _grabSnapshot(item) {
        const fieldInstances = [];
        for (const field of item.fieldInstances) {
            try {
                if (field.createSnapshot)
                    fieldInstances.push(field.createSnapshot());
                else
                    console.warn("Field seems to be not of type NkField. Cannot create a snapshot: " + field.name);
            }
            catch(err) {
                console.error(`Could not grab snapshot of field ${field.name}`, err);
            }
        }

        return new NkSnapshot(null, "item", {
            fieldInstances: fieldInstances
        });
    }

    _getFieldInstance(item, id) {
        for (const fieldInstance of item.fieldInstances) {
            if (fieldInstance.getId() === id)
                return fieldInstance;
        }

        return null;
    }

    _rollbackFromSnapshot(item, snapshot)  {
        for (const fieldInstanceSnapshot of snapshot.data.fieldInstances) {
            const fieldInstance = this._getFieldInstance(item, fieldInstanceSnapshot.id);
            if (!fieldInstance) {
                console.error("Could not find field instance in snapshot: " + fieldInstanceSnapshot.id);
            } else {
                fieldInstance.rollbackFromSnapshot(fieldInstanceSnapshot);
            }
        }
    }

    getEnabled() {
        return this.enabled;
    }

    setEnabled(value) {
        this.enabled = !!value;
    }

    ignore(func) {
        const enabled = this.enabled;
        let omitFinally = false;

        try {
            if (enabled)
                this.setEnabled(false);

            const result = func();

            if (result && result.then) {
                omitFinally = true;

                return result.finally(() => {
                    if (enabled) this.setEnabled(true);
                })
            }
        }
        catch(err) {
            throw err;
        }
        finally {
            if (enabled && !omitFinally)
                this.setEnabled(true);
        }
    }

    undo(count) {
        if (!this.enabled)
            return;

        if (!this.undoEvents.length)
            return;

        count = count || 1;

        while (this.undoEvents.length > 0 && count > 0) {
            const undoBundle = this.spliceLastEventBundle(this.undoEvents).reverse();
            
            for (const event of undoBundle) {
                event.undo()
                this.redoEvents.push(event);
            }
            
            count--;
        }

        eventBus.$emit('nk:undoManager:undoStepsChanged', this.getNumberOfUndoBundles());
        eventBus.$emit('nk:undoManager:redoStepsChanged', this.getNumberOfRedoBundles());
    }

    redo(count) {
        if (!this.enabled)
            return;

        if (!this.redoEvents.length)
            return;

        count = count || 1;

        while (this.redoEvents.length > 0 && count > 0) {
            const redoBundle = this.spliceLastEventBundle(this.redoEvents).reverse();

            for (const event of redoBundle) {
                event.redo()
                this.undoEvents.push(event);
            }

            count--;
        }

        eventBus.$emit('nk:undoManager:undoStepsChanged', this.getNumberOfUndoBundles());
        eventBus.$emit('nk:undoManager:redoStepsChanged', this.getNumberOfRedoBundles());
    }

    getUndoSteps() {
        return this.undoEvents.map(function(event) {
            return {
                type: event.type,
                itemId: event.itemId,
                prop: event.prop
            };
        });
    }

    getRedoSteps() {
        return this.redoEvents.map((event) => {
            return {
                type: event.type,
                itemId: event.itemId,
                prop: event.prop
            };
        });
    }

    event(event) {
        if (!this.enabled)
            return;

        this.redoEvents = [];
        eventBus.$emit('nk:undoManager:redoStepsChanged', 0);


        this.assignBundleIndexToEvent(event);

        if (this.undoEvents.length !== 0) {
            let mergeWasSuccessful = false;

            for (let i = this.undoEvents.length-1; i >= 0; i--) {
                const otherEvent = this.undoEvents[i];

                // undoEvents are sorted by createdAt, so any following events wont meet this criteria either
                if (!event.isWithinMergeDeltaOf(otherEvent)) {
                    break;
                }

                const mergedEvent = otherEvent.merge(event);

                if (mergedEvent) {
                    mergeWasSuccessful = true;

                    this.undoEvents.splice(i, 1);
                    this.undoEvents.push(mergedEvent);

                    break;
                }
            }
            
            if (!mergeWasSuccessful) {
                this.undoEvents.push(event);
                eventBus.$emit('nk:undoManager:undoStepsChanged', this.getNumberOfUndoBundles());            
            }
        } else {
            this.undoEvents.push(event);
            eventBus.$emit('nk:undoManager:undoStepsChanged', this.getNumberOfUndoBundles());        
        }

        if (this.getNumberOfUndoBundles() > this.maxUndoCount) {
            this.spliceFirstEventBundle(this.undoEvents);

            for (const event of this.undoEvents) {
                event.bundleIndex -= 1;
            }

            eventBus.$emit('nk:undoManager:undoStepsChanged', this.getNumberOfUndoBundles()); 
        }
    }

    getNumberOfUndoBundles() {
        if (this.undoEvents.length === 0) {
            return 0;
        }

        return this.undoEvents.at(-1).bundleIndex + 1;
    }

    getNumberOfRedoBundles() {
        if (this.redoEvents.length === 0) {
            return 0;
        }

        const maxUndoBundleIndex = this.getNumberOfUndoBundles() - 1;
        const maxRedoBundleIndex = this.redoEvents.at(0).bundleIndex;

        return maxRedoBundleIndex-maxUndoBundleIndex;
    }
    
    // remove and return all events with the bundleIndex that is on top of the event stack
    spliceLastEventBundle(events) {
        if (events.length === 0) return [];

        const bundleIndexToLookFor = events.at(-1).bundleIndex;
        let bundleIndexStart = events.length-1;

        for (let i = events.length-1; i >= 0; i--) {
            if (events[i].bundleIndex === bundleIndexToLookFor) {
                bundleIndexStart = i;
            } else {
                break;
            }
        }

        return events.splice(bundleIndexStart);
    }

    // remove all events with the bundleIndex that is on the bottom of the event stack
    spliceFirstEventBundle(events) {
        if (events.length === 0) return [];

        const bundleIndexToLookFor = events.at(0).bundleIndex;

        for (let i = 1; i < events.length; i++) {
            if (events[i].bundleIndex !== bundleIndexToLookFor) {
                return events.splice(0, i);
            }
        }

        return events.splice(0);
    }

    assignBundleIndexToEvent(event) {
        if (this.undoEvents.length === 0) {
            event.bundleIndex = 0;
            return;
        } 
        
        const latestEvent = this.undoEvents.at(-1);
        const eventDelta = Math.abs(event.createdAt - latestEvent.createdAt);

        event.bundleIndex = eventDelta > MAX_BUNDLE_TIME_IN_MS 
            ? latestEvent.bundleIndex + 1 
            : latestEvent.bundleIndex;
    }
}
