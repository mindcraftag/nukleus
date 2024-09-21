"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default class NkEventEmitter {

    constructor() {
        this.debugMode = false;

        let listeners = new Map();
        let onceListeners = new Map();

        this.getListeners = function() {
            return listeners;
        }

        this.getOnceListeners = function() {
            return onceListeners;
        }
    }

    setDebugMode(mode) {
        this.debugMode = mode;
    }

    $clear() {
        this.getListeners().clear();
        this.getOnceListeners().clear();
    }

    listenerCount(event) {
        let count = 0;
        if (this.getListeners().has(event)) {
            count += this.getListeners().get(event).length;
        }
        if (this.getOnceListeners().has(event)) {
            count += this.getOnceListeners().get(event).length;
        }
        return count;
    }

    $hasListener(eventName) {
        return this.listenerCount(eventName) > 0;
      }

    $on(event, func, owner) {
        let list = [];

        if (typeof func !== 'function') {
            console.trace();
            throw "Listener must be of type function";
        }

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

        if (typeof func !== 'function') {
            console.trace();
            throw "Listener must be of type function";
        }

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

        return removeCount;
    }

    $offByOwner(event, owner) {
        let removeCount = 0;

        if (this.getListeners().has(event)) {
            const list = this.getListeners().get(event);
            removeCount += list.removeByFilterFunc(x => x.owner === owner);
        }

        if (this.getOnceListeners().has(event)) {
            const list = this.getOnceListeners().get(event);
            removeCount += list.removeByFilterFunc(x => x.owner === owner);
        }

        return removeCount;
    }

    $emitSync(event, ...args) {
        const startTime = Date.now();

        try {
            if (this.getListeners().has(event)) {
                const list = this.getListeners().get(event);
                for (const entry of list) {
                    try {
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

        if (this.debugMode && event !== 'log') {
            const endTime = Date.now();
            const duration = Math.floor(endTime - startTime);
            if (duration > 3)
                console.log(`Expensive event ${event}: ${duration}ms`);
        }
    }

    $emit(event, ...args) {
        const _this = this;
        return new Promise((resolve, reject) => {
            _this.$emitSync(event, ...args);
            resolve();
        });
    }
}
