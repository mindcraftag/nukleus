import ace from 'ace-builds';

import modeTextUrl from 'ace-builds/src-noconflict/mode-text?url';
ace.config.setModuleUrl('ace/mode/text', modeTextUrl);

import modeJsonUrl from 'ace-builds/src-noconflict/mode-json?url';
ace.config.setModuleUrl('ace/mode/json', modeJsonUrl);

import modeLuaUrl from 'ace-builds/src-noconflict/mode-lua?url';
ace.config.setModuleUrl('ace/mode/lua', modeLuaUrl);

import modeLuaExtUrl from './mode-luaext?url';
ace.config.setModuleUrl('ace/mode/luaext', modeLuaExtUrl);

import modeGlslUrl from 'ace-builds/src-noconflict/mode-glsl?url';
ace.config.setModuleUrl('ace/mode/glsl', modeGlslUrl);

import themeTwilightUrl from 'ace-builds/src-noconflict/theme-twilight?url';
ace.config.setModuleUrl('ace/theme/twilight', themeTwilightUrl);

import themeMerbinateUrl from './theme-merbinate?url';
ace.config.setModuleUrl('ace/theme/merbinate', themeMerbinateUrl);

import 'ace-builds/src-noconflict/ext-language_tools';
ace.require("ace/ext/language_tools");

import 'ace-builds/src-noconflict/ext-searchbox';
ace.require("ace/ext/searchbox");

import 'ace-builds/src-noconflict/keybinding-vscode';
ace.require("ace-builds/src-noconflict/keybinding-vscode");
