ace.define("ace/mode/luaext",["require","exports","module","ace/lib/oop","ace/mode/lua","ace/mode/lua_highlight_rules","ace/range"], function(require, exports, module) {

  var oop = require("ace/lib/oop");
  var Lua = require("ace/mode/lua");
  var LuaMode = Lua.Mode;
  var LuaHighlightRules = require("ace/mode/lua_highlight_rules").LuaHighlightRules;

  var MyLuaHighlightRules = function() {

    LuaHighlightRules.call(this);

    var startRules = [
      {
        token: [
          "comment.start.lua",
          "keyword.operator.lua",
          "text",
          "keyword",
          "text",
          "paren.lparen",
          "constant.numeric",
          "comma",
          "constant.numeric",
          "paren.rparen",
          "text",
          "variable.parameter.lua",
          "keyword.operator.assignment.lua",
          "constant.numeric"
        ],
        regex: "(--#)(public)(\\s+)(number)(\\s*)(\\()(\\s*\\d+\\s*)(,)(\\s*\\d+\\s*)(\\))(\\s+)(_\\w+)(=)?(\\d+)?",
        next: "start"
      },
      {
        token: [
          "comment.start.lua",
          "keyword.operator.lua",
          "text",
          "keyword",
          "text",
          "variable.parameter.lua",
          "keyword.operator.assignment.lua",
          "constant.numeric"
        ],
        regex: "(--#)(public)(\\s+)(number)(\\s+)(_\\w+)(=)?(\\d+)?",
        next: "start"
      },
      {
        token: [
          "comment.start.lua",
          "keyword.operator.lua",
          "text",
          "keyword",
          "text",
          "variable.parameter.lua",
          "keyword.operator.assignment.lua",
          "keyword"
        ],
        regex: "(--#)(public)(\\s+)(boolean|string|node)(\\s+)(_\\w+)(=)?(true|false)?",
        next: "start"
      },
      {
        token: [
          "comment.start.lua",
          "keyword.operator.lua",
          "text",
          "keyword",
          "text",
          "variable.parameter.lua",
          "keyword.operator.assignment.lua",
          "string"
        ],
        regex: "(--#)(public)(\\s+)(string)(\\s+)(_\\w+)(=)?(\".*\")?",
        next: "start"
      },
    ];

    for (var i = 0; i < startRules.length; i++) {
      this.$rules.start.unshift(startRules[i]);
    }

  };

  oop.inherits(MyLuaHighlightRules, LuaHighlightRules);

  var Mode = function() {
    LuaMode.call(this);
    this.HighlightRules = MyLuaHighlightRules;
  };

  oop.inherits(Mode, LuaMode);

  exports.Mode = Mode;

});

