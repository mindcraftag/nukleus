"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

class EventEmitter {

    constructor() {
        let listeners = new Map();
        let onceListeners = new Map();

        this.getListeners = function() {
            return listeners;
        }

        this.getOnceListeners = function() {
            return onceListeners;
        }
    }

    $clear() {
        this.getListeners().clear();
        this.getOnceListeners().clear();
    }

    $on(event, func, owner) {
        let list = [];

        if (typeof func !== 'function')
            throw "Listener must be of type function";

        if (this.getListeners().has(event)) {
            list = this.getListeners().get(event);
        } else {
            this.getListeners().set(event, list);
        }

        list.push({
            func: func,
            owner: owner
        });
    }

    $once(event, func, owner) {
        let list = [];

        if (typeof func !== 'function')
            throw "Listener must be of type function";

        if (this.getOnceListeners().has(event)) {
            list = this.getOnceListeners().get(event);
        } else {
            this.getOnceListeners().set(event, list);
        }

        list.push({
            func: func,
            owner: owner
        });
    }

    $off(event, func, owner) {
        let removeCount = 0;

        if (this.getListeners().has(event)) {
            const list = this.getListeners().get(event);
            removeCount += list.removeByFilterFunc(x => x.func === func && x.owner === owner);
        }

        if (this.getOnceListeners().has(event)) {
            const list = this.getOnceListeners().get(event);
            removeCount += list.removeByFilterFunc(x => x.func === func && x.owner === owner);
        }

        /*if (!removeCount)
            console.warn("Tried to remove event handler but it did not exist: " + event, func, owner);*/
    }

    $emit(event, ...args) {
        let wasHandled = false;
        try {
            //if (event !== "log")
            //    console.log("Emitting event: " + event);

            if (this.getListeners().has(event)) {
                const list = this.getListeners().get(event);
                for (const entry of list) {
                    try {
                        wasHandled = true;
                        entry.func.call(entry.owner, ...args);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }

            if (this.getOnceListeners().has(event)) {
                const list = this.getOnceListeners().get(event);
                for (const entry of list) {
                    try {
                        wasHandled = true;
                        entry.func.call(entry.owner, ...args);
                    } catch (err) {
                        console.error(err);
                    }
                }
                this.getOnceListeners().set(event, []);
            }
        }
        catch(err) {
            console.error(err);
        }

        return wasHandled;
    }

    $emitNoCatch(event, ...args) {
        let wasHandled = false;

        const promises = [];

        if (this.getListeners().has(event)) {
            const list = this.getListeners().get(event);
            for (const entry of list) {
                try {
                    wasHandled = true;
                    const result = entry.func.call(entry.owner, ...args);
                    if (result && typeof result.then === 'function') {
                        promises.push(result);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }

        if (this.getOnceListeners().has(event)) {
            const list = this.getOnceListeners().get(event);
            for (const entry of list) {
                try {
                    wasHandled = true;
                    const result = entry.func.call(entry.owner, ...args);
                    if (result && typeof result.then === 'function') {
                        promises.push(result);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
            this.getOnceListeners().set(event, []);
        }

        if (promises.length)
            return Promise.all(promises);

        return false;
    }
}

exports.EventEmitter = EventEmitter;
