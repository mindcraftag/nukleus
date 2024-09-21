"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

class Exception {
    constructor(type, msg) {
        this.type = type;
        this.msg = msg;
    }

    toString() {
        return `${this.type}: ${this.msg}`;
    }
}

class ValidationError extends Exception {
    constructor(msg, field) {
        super("ValidationError", msg);
        this.field = field;
    }

    toString() {
        if (!this.field)
            return super.toString();
        else
            return `${this.type} [${this.field}]: ${this.msg}`;
    }
}

class QuotaExceededError extends Exception {
    constructor() {
        super("QuotaExceeded");
    }

    toString() {
        return "Quota exceeded";
    }
}

class LimitExceededError extends Exception {
    constructor(message) {
        super("LimitExceeded", message);
    }

    toString() {
        return "Quota exceeded";
    }
}

class PermissionDeniedError extends Exception {
    constructor(msg) {
        super("PermissionDeniedError", msg);
    }

    toString() {
        return super.toString();
    }
}

exports.Exception = Exception;
exports.ValidationError = ValidationError;
exports.PermissionDeniedError = PermissionDeniedError;
exports.QuotaExceededError = QuotaExceededError;
exports.LimitExceededError = LimitExceededError;
