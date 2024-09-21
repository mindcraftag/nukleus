"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const fs = require('fs');
const xlsx = require('xlsx');
const common = require('../common');

exports.createXlsx = function(sheetName, data) {
    const workBook = xlsx.utils.book_new();
    const workSheet = xlsx.utils.json_to_sheet(data);

    xlsx.utils.book_append_sheet(workBook, workSheet, `export.xlsx`)
    const buffer = xlsx.write(workBook, { bookType: 'xlsx', bookSST: false, type: 'buffer' });

    //fs.writeFileSync("/home/chris/export.xlsx", buffer);

    return buffer;
}

exports.sendXlsx = function(res, buffer) {
    const head = {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export.xlsx"`,
    };

    const stream = common.bufferToStream(buffer);
    res.writeHead(200, head);
    stream.pipe(res);
}