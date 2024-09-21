"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

class InvalidArgumentException extends Error {
    constructor(msg) {
        super(msg);
        this.name = "InvalidArgumentException";
    }
}

class InvalidStateException extends Error {
    constructor(msg) {
        super(msg);
        this.name = "InvalidStateException";
    }
}

class RuntimeException extends Error {
    constructor(msg) {
        super(msg);
        this.name = "RuntimeException";
    }
}

class LoaderException extends Error {
    constructor(msg) {
        super(msg);
        this.name = "LoaderException";
    }
}

export {
    InvalidArgumentException,
    InvalidStateException,
    LoaderException,
    RuntimeException
}
