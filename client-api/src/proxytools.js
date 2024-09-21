"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import eventBus from './eventbus'
import NkProxyEvent from './proxyevent'
import tools from './tools.js'

const IGNORE_DIRTY_PROPS = ['__proto__', '__ob__', 'isSelected', 'isDirty', 'options', 'hidden', 'animatedValue', 'dependantFields', 'conditionFields', 'separatorFields', 'dependenciesInitialized'];
const IGNORE_UNDO_PROPS = ['isSelected', 'isDirty', 'hidden', 'options', 'animatedValue', 'dependantFields', 'conditionFields', 'separatorFields', 'dependenciesInitialized'];

export default {

  setUndoManager(manager) {
    this.undoManager = manager;
  },

  _postUndoManagerEvent(event) {
    if (this.undoManager) {
      if (!IGNORE_UNDO_PROPS.includes(event.prop))
        this.undoManager.event(event);
    }
  },

  setItemDirty(item, prop, origValue, value) {
    if (!item.isDirty) {
      if (origValue !== value && !IGNORE_DIRTY_PROPS.includes(prop)) {
        item.isDirty = true;
        eventBus.$emit('nk:itemRepo:itemBecameDirty', item._id);
      }
    }
  },

  // --------------------------------------------------------------------------------
  // Helper function to proxy an object. Is not used directly, but by other proxy functions below
  // --------------------------------------------------------------------------------
  _proxyObject(object, element, item, options) {
    const _this = this;

    if (!object) {
      throw "_proxyObject(): Object is not defined. Cannot create proxy!";
    }

    if (!item) {
      throw "_proxyObject(): Item is not defined. Cannot create proxy!";
    }

    if (!options) {
      throw "_proxyObject(): Options is not defined. Cannot create proxy!";
    }

    return new Proxy(object, {
      set: function (target, prop, value) {

        let postUndoEvent = true;

        // Execute action
        // --------------------------------------------------------------------------------
        const origValue = Reflect.get(target, prop);
        if (tools.areValuesEqual(origValue, value))
          return true;

        let ret = Reflect.set(target, prop, value);

        if (!options.changeDoesNotMakeItemDirty) {
          if (!tools.matchItemIdAndObject(origValue, value)) {
            _this.setItemDirty(item, prop, origValue, value);
          } else {
            postUndoEvent = false;
          }
        }

        // Create event and undo/redo function
        // --------------------------------------------------------------------------------
        function createEvent(value, origValue) {
          const event = new NkProxyEvent(options.proxyEventTypeName, item._id, element ? element.id : null, target, prop, value, origValue);

          if (options.isField) {
            event.setField(object.name);
            event.setFieldId(object.id);
          }

          if (options.isLink !== undefined)
            event.setIsLink(options.isLink);

          return event;
        }

        const event = createEvent(value, origValue);
        event.undo = function() {
          // In case an undo is triggered, we play back the original value to the target object
          Reflect.set(target, prop, this.oldValue);
          // Now we create an event about this
          const undoEvent = createEvent(this.oldValue, this.value);
          // We pass this event with this special event type to let the UI know it needs to repaint in case it relies on this field
          eventBus.$emitSync('nk:proxy:valueChange', undoEvent);
          // Now emit the event with the requested type of changing values
          options.changeEventFunc(undoEvent);
        }
        event.redo = function() {
          // In case an redo is triggered, we play back the original value to the target object
          Reflect.set(target, prop, this.value);
          // Now we create an event about this
          const redoEvent = createEvent(this.value, this.oldValue);
          // We pass this event with this special event type to let the UI know it needs to repaint in case it relies on this field
          eventBus.$emitSync('nk:proxy:valueChange', redoEvent);
          // Now emit the event with the requested type of changing values
          options.changeEventFunc(redoEvent);
        }

        // Send event
        // --------------------------------------------------------------------------------
        options.changeEventFunc(event);

        if (postUndoEvent)
          _this._postUndoManagerEvent(event);

        eventBus.$emitSync('nk:proxy:valueChange', event);

        return ret;
      }
    });
  },

  // --------------------------------------------------------------------------------
  // Helper function to proxy an array. Is not used directly, but by other proxy functions below
  // --------------------------------------------------------------------------------
  _proxyArray(array, element, item, options) {
    const _this = this;

    if (!array) {
      throw "_proxyArray(): Array is not defined. Cannot create proxy!";
    }

    if (!item) {
      throw "_proxyArray(): Item is not defined. Cannot create proxy!";
    }

    if (!options) {
      throw "_proxyArray(): Options is not defined. Cannot create proxy!";
    }

    return new Proxy(array, {
      set(target, prop, value) {

        // Execute the action
        // -----------------------------------------------------------------------
        const origValue = Reflect.get(target, prop);
        let ret = Reflect.set(target, prop, value);

        if (prop !== 'length' && prop !== "__proto__") {

          if (!options.changeDoesNotMakeItemDirty)
            _this.setItemDirty(item, prop, origValue, value);

          // Create event and undo/redo function
          // -----------------------------------------------------------------------
          function createEvent(value, origValue) {
            const event = new NkProxyEvent("arraySetValue", item._id, element ? element.id : null, target, prop, value, origValue);

            if (options.field) {
              event.setField(options.field.name);
              event.setFieldId(options.field.id);
            }

            return event;
          }

          const event = createEvent(value, origValue);
          event.undo = function() {
            const undoEvent = createEvent(this.oldValue, this.value);

            const startIndex = parseInt(prop);
            if (this.oldValue === undefined && (target.length-1) === startIndex) {
              // the operation added a new entry to the end of the array. So we need to pop it and pass it to the event
              const deletedBlock = target.pop();
              undoEvent.setElementsToDelete([deletedBlock]);
              undoEvent.setRange(startIndex, 1);
            } else {
              // in all other cases just set the oldvalue to the location
              Reflect.set(target, prop, this.oldValue);
            }

            eventBus.$emitSync('nk:proxy:valueChange', undoEvent);
            options.deleteEventFunc(undoEvent);
          }
          event.redo = function() {
            Reflect.set(target, prop, this.value);
            const redoEvent = createEvent(this.value, this.oldValue);
            eventBus.$emitSync('nk:proxy:valueChange', redoEvent);
            options.addEventFunc(redoEvent);
          }

          // Send event
          // -----------------------------------------------------------------------
          options.addEventFunc(event);
          _this._postUndoManagerEvent(event);
          eventBus.$emitSync('nk:proxy:valueChange', event);
        }
        return ret;
      },
      get(target, prop) {
        if (prop === 'splice') {
          const origMethod = Reflect.get(target, prop);
          return function (...args) {

            // Copy the elements that should be deleted from the array if any
            // -----------------------------------------------------------------------
            // Todo: add support for a splice with zero or one arguments
            const spliceStart = args[0];
            const spliceLength = args[1];
            const elementsToDelete = [];

            for (let i=spliceStart; i<spliceStart+spliceLength; i++) {
              const elementToDelete = target[i];
              elementsToDelete.push(elementToDelete);
            }

            // Execute the action
            // -----------------------------------------------------------------------
            origMethod.apply(target, args);
            _this.setItemDirty(item, prop, true, false);

            function createRemoveEvent(start, length, elementsToDelete) {
              const event = new NkProxyEvent("arraySpliceRemove", item._id, element ? element.id : null, target);
              if (options.field) {
                event.setField(options.field.name);
                event.setFieldId(options.field.id);
              }
              event.setRange(start, length);
              event.setElementsToDelete(elementsToDelete);
              return event;
            }

            function createAddEvent(position, elementsToAdd) {
              const event = new NkProxyEvent("arraySpliceAdd", item._id, element ? element.id : null, target, prop, elementsToAdd);
              if (options.field) {
                event.setField(options.field.name);
                event.setFieldId(options.field.id);
              }
              event.setPosition(position);
              return event;
            }

            // If length > 0, this is a removal operation on the array
            // -----------------------------------------------------------------------
            if (spliceLength > 0 && args.length < 3) {

              // Create event and undo/redo function
              // --------------------------------------------------------------------------------
              const event = createRemoveEvent(spliceStart, spliceLength, elementsToDelete);

              event.undo = function() {
                target.splice(spliceStart, 0, ...elementsToDelete);
                const undoEvent = createAddEvent(spliceStart, elementsToDelete);
                eventBus.$emitSync('nk:proxy:valueChange', undoEvent);
                options.addEventFunc(undoEvent);
              }

              event.redo = function() {
                target.splice(spliceStart, spliceLength);
                const redoEvent = createRemoveEvent(spliceStart, spliceLength, elementsToDelete);
                eventBus.$emitSync('nk:proxy:valueChange', redoEvent);
                options.deleteEventFunc(redoEvent);
              }

              options.deleteEventFunc(event);
              _this._postUndoManagerEvent(event);
              eventBus.$emitSync('nk:proxy:valueChange', event);
            }

            // If we have more than 2 args, this is an add operation on the array
            // Todo: add functionality for an add/remove-splice with spliceLength > 0
            // -----------------------------------------------------------------------
            else if (args.length > 2) {

              // Create event and undo/redo function
              // --------------------------------------------------------------------------------
              const elementsToAdd = args.slice(2);
              const event = createAddEvent(spliceStart, elementsToAdd);
              event.setPosition(spliceStart);

              event.undo = function () {
                target.splice(spliceStart, elementsToAdd.length);
                const undoEvent = createRemoveEvent(spliceStart, elementsToAdd.length, elementsToAdd);
                eventBus.$emitSync('nk:proxy:valueChange', undoEvent);
                options.deleteEventFunc(undoEvent);
              }

              event.redo = function () {
                target.splice(spliceStart, 0, ...elementsToAdd);
                const redoEvent = createAddEvent(spliceStart, elementsToAdd);
                eventBus.$emitSync('nk:proxy:valueChange', redoEvent);
                options.addEventFunc(redoEvent);
              }

              options.addEventFunc(event);
              _this._postUndoManagerEvent(event);
              eventBus.$emitSync('nk:proxy:valueChange', event);
            }
          }
        } else if (prop === 'move') {

        }

        return Reflect.get(target, prop);
      }
    });
  },

  // --------------------------------------------------------------------------------
  // Proxy Block Array
  // --------------------------------------------------------------------------------
  // This will be used for children of blocks, to know when the children change.
  // As an example, this proxy will notice, if we add or delete an item from the scenegraph
  // --------------------------------------------------------------------------------
  proxyBlockArray(arr, block, item) {
    return this._proxyArray(arr, block, item, {
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:blockAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:blockDeleted", event);
      }
    });
  },

  // --------------------------------------------------------------------------------
  // Proxy List Array
  // --------------------------------------------------------------------------------
  // This will be used for children of lists, to know when the children change.
  // --------------------------------------------------------------------------------
  proxyListArray(arr, field, item) {
    return this._proxyArray(arr, null, item, {
      field: field,
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:listEntryAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:listEntryDeleted", event);
      }
    });
  },

  // --------------------------------------------------------------------------------
  // Proxy Script Array
  // --------------------------------------------------------------------------------
  // This will be used for scripts of blocks, to know when scripts are added or removed.
  // --------------------------------------------------------------------------------
  proxyScriptArray(arr, block, item) {
    return this._proxyArray(arr, block, item, {
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptDeleted", event);
      }
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Block
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on a block, for example if values on a scene
  //  graph item changes. This can be name or selected state
  // --------------------------------------------------------------------------------
  proxyBlock(block, item) {
    return this._proxyObject(block, block, item, {
      isLink: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:fieldChanged", event);
        eventBus.$emit("nk:itemRepo:linkChanged", event);
      },
      proxyEventTypeName: "blockSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Graph Block
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on a graph node block
  // --------------------------------------------------------------------------------
  proxyGraphBlock(block, item) {
    return this._proxyObject(block, block, item, {
      isLink: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphNodeChanged", event);
      },
      proxyEventTypeName: "blockSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  // Proxy Graph Block Array
  // --------------------------------------------------------------------------------
  // This will be used for nodes of a graph to notice additions or removals
  // --------------------------------------------------------------------------------
  proxyGraphBlockArray(arr, graphItem) {
    return this._proxyArray(arr, graphItem, graphItem, {
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphNodeAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphNodeDeleted", event);
      }
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Connection
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on a connection
  // --------------------------------------------------------------------------------
  proxyConnection(connection, graphItem) {
    return this._proxyObject(connection, graphItem, graphItem, {
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphConnectionChanged", event);
      },
      proxyEventTypeName: "connectionSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  // Proxy Connection Array
  // --------------------------------------------------------------------------------
  // This will be used to notice added or removed connections
  // --------------------------------------------------------------------------------
  proxyConnectionArray(arr, graphItem) {
    return this._proxyArray(arr, arr, graphItem, {
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphConnectionAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphConnectionDeleted", event);
      }
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Item Field
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on item fields, so any change of a field
  //  directly on an item. For example the encoding of a texture. It will NOT notice
  //  any changes on fields further down an item like scene graph elements or any list entries
  // --------------------------------------------------------------------------------
  proxyItemField(field, item) {
    const isLink = field.type === "Link";
    return this._proxyObject(field, null, item, {
      isLink: isLink,
      isField: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:fieldChanged", event);
        if (isLink)
          eventBus.$emit("nk:itemRepo:linkChanged", event);
      },
      proxyEventTypeName: "itemFieldSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Graph Block Field
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on block fields of a graph. This means one
  //  of the fields of a node
  // --------------------------------------------------------------------------------
  proxyGraphBlockField(field, block, item) {
    return this._proxyObject(field, block, item, {
      isLink: field.type === 'Link',
      isField: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:graphNodeFieldChanged", event);
      },
      proxyEventTypeName: "blockFieldSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Block Field
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes on block fields. This can be a field on a
  //  scene graph item like when the size of a box is changed.
  // --------------------------------------------------------------------------------
  proxyBlockField(field, block, item) {
    const isLink = field.type === 'Link';
    return this._proxyObject(field, block, item, {
      isLink: isLink,
      isField: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:fieldChanged", event);
        if (isLink)
          eventBus.$emit("nk:itemRepo:linkChanged", event);
      },
      proxyEventTypeName: "blockFieldSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Script Item
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes in a script's item
  // --------------------------------------------------------------------------------
  proxyScriptItem(scriptItem, script, item) {
    return this._proxyObject(scriptItem, script, item, {
      isLink: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptItemChanged", event);
      },
      proxyEventTypeName: "scriptItemSetValue"
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Script Fields
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes in the fields array of a script
  // --------------------------------------------------------------------------------
  proxyScriptFieldsArray(fields, script, item) {
    return this._proxyArray(fields, script, item, {
      addEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptFieldAdded", event);
      },
      deleteEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptFieldDeleted", event);
      },
      changeDoesNotMakeItemDirty: true
    });
  },

  // --------------------------------------------------------------------------------
  //  Proxy Script Fields
  // --------------------------------------------------------------------------------
  //  This proxy will notice any changes in a script's field
  // --------------------------------------------------------------------------------
  proxyScriptField(field, script, item) {
    return this._proxyObject(field, script, item, {
      isLink: false,
      isField: true,
      changeEventFunc: function(event) {
        eventBus.$emit("nk:itemRepo:scriptFieldChanged", event);
      },
      proxyEventTypeName: "itemScriptFieldSetValue",
      changeDoesNotMakeItemDirty: true
    });
  }
}
