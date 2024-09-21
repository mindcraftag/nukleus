"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import NkField from './field';

export default class NkTemplate {

  constructor(fields) {
    if (!Array.isArray(fields))
      throw "Template fields need to be an array!";

    for (const field of fields) {
      if (!(field instanceof NkField)) {
        throw "Template fields need to be all instances of NkField class!"
      }
    }

    this.fields = fields;
  }

  clone() {
    const newFields = [];
    for (const field of this.fields) {
      newFields.push(field.clone());
    }
    return new NkTemplate(newFields);
  }

  /**
   * Changes the default values of the template
   * @param fieldValues object an object with new values for every field that should be changed
   */
  specialize(fieldValues) {
    for (const field of this.fields) {
      // Overwrite the default value if *any* value is defined. Otherwise falsy values (like 0) would be ignored.
      if (fieldValues[field.name] !== undefined) {
        field.defaultValue = fieldValues[field.name];
      }
    }
    return this;
  }

  instantiate() {
    const instances = [];

    for (const field of this.fields) {
      instances.push(field.clone());
    }

    return instances;
  }

}
