
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import pkg from './package.json';

const globals = {
    "axios": "axios",
    "moment": "moment",
    "lodash": "lodash",
    "ws": "ws",
    "pako": "pako",
    "localforage": "localforage",
    "utf-8-validate": "utf-8-validate",
    "isomorphic-ws": "isomorphic-ws",
    "jszip": "jszip"
};

const external = ['jszip', 'axios', 'moment', 'lodash', 'ws', 'pako', 'bufferutil', 'localforage', 'utf-8-validate', 'isomorphic-ws'];

export default [
    // browser-friendly UMD build
    {
        input: 'src/index.js',
        external: external,
        output: {
            sourcemap: true,
            name: 'nukleus-client-api',
            file: pkg.browser,
            format: 'umd',
            globals: globals
        },
        plugins: [
            resolve(), // so Rollup can find `ms`
            commonjs(), // so Rollup can convert `ms` to an ES module
            json(),
            nodePolyfills()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // an array for the `output` option, where we can specify
    // `file` and `format` for each target)
    {
        input: 'src/index.js',
        external: external,
        output: [
            { file: pkg.main, format: 'cjs', globals: globals, sourcemap: true },
            { file: pkg.module, format: 'es', globals: globals, sourcemap: true }
        ]
    }
];
