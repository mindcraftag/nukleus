// This script auto-generates types and makes some small manual adjustments.
// It is intended to run automatically during the "prepare" hook of NPM,
// but it can also be executed directly by using "yarn run prepare".

const shell = require("shelljs");
const fs = require("fs");

const INDEX_TYPES_PATH = "types/index.d.ts";

shell.rm("-rf", "types");
shell.exec("yarn tsc ./index.js --target es2015 --declaration --allowJs --emitDeclarationOnly --outDir types");

let indexTypes = "";

// We want to access the nukleus-model as "model":
indexTypes += `export * as model from "@mindcraftgmbh/nukleus-model";`;

// The type of "config" changes during runtime as the load() function
// adds additional keys. Instead we set "config" to the type "any". 
indexTypes += `export let config: any;`;

// Now we add the auto-generated indexTypes to the end. Our declarations
// above will overwrite any conflicting declarations.
indexTypes += fs.readFileSync(INDEX_TYPES_PATH).toString();

const oldModelType = `export const model: any;`;
const oldConfigType = `export const config: {
    load: (filePath: any, log: any) => void;
};\n`;

// Remove the previous auto-generated exports for the model and config, so the new ones will be used.
let newContent = indexTypes.replace(oldModelType, "").replace(oldConfigType, "");

const typeImports = [];
const regex = /export const (.*): typeof import\("(.*)\"\);/g;

for (const line of newContent.split("\n")) {
    const res = line.matchAll(regex);
    const matches = res.next().value;
    if (matches) {
        typeImports.push(`export type ${matches[1]} = typeof ${matches[1]};`);
    }
}

newContent += typeImports.join("\n");

fs.writeFileSync(INDEX_TYPES_PATH, newContent);
