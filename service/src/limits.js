"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

// Object count limits
exports.MAX_ACCESS_TOKENS_PER_USER = 50;
exports.MAX_FOLDERS_PER_CLIENT = 1000000;
exports.MAX_ITEMS_PER_CLIENT = 1000000;
exports.MAX_ATTRIBUTE_TEMPLATES_PER_CLIENT = 1000;
exports.MAX_GROUPS_PER_CLIENT = 1000;
exports.MAX_JOBS_PER_USER = 100;
exports.MAX_LICENSES_PER_CLIENT = 1000;
exports.MAX_CATEGORIES_PER_CLIENT = 1000;
exports.MAX_USERS_PER_CLIENT = 10000;

// Mail templates
exports.MAX_MAILTEMPLATES_PER_CLIENT = 1000;
exports.MAX_MAILTEMPLATE_IMAGECOUNT = 20;
exports.MAX_MAILTEMPLATE_TOTAL_IMAGESIZE = 1024 * 1024; // 1 MB

// Invoice templates
exports.MAX_INVOICETEMPLATES_PER_CLIENT = 1000;
exports.MAX_INVOICETEMPLATE_IMAGECOUNT = 20;
exports.MAX_INVOICETEMPLATE_TOTAL_IMAGESIZE = 1024 * 1024; // 1 MB

// 2FA
exports.MAX_2FA_VALIDITY = 5;
exports.MAX_2FA_VALIDITY_UNIT = "minute";

// Purchases
exports.PURCHASE_CANCEL_GRACE_PERIOD_MINUTES = 5;
exports.PURCHASE_MINIMUM_PRICE = 100;
exports.PURCHASE_OPTION_INTERVALS = ["once", "monthly", "yearly"];

// Attributes
exports.USER_CUSTOM_ATTRIBUTES_MAX_SIZE = 100 * 1024;

// ZIP Export
exports.ZIP_STREAM_MAXIMUM_ITEM_COUNT = 100000;
exports.ZIP_STREAM_MAXIMUM_FILE_SIZE_MB = 1024;

// Package Export
exports.PACKAGE_STREAM_MAXIMUM_ITEM_COUNT = 100000;
exports.PACKAGE_STREAM_MAXIMUM_FILE_SIZE_MB = 1024;
