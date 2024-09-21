/**
 * @type {import("eslint").Linter.Config}
 */
const config = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ["dist", "node_modules", "test"],
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/no-this-alias": "off",
    "no-constant-condition": "off",
    "@typescript-eslint/no-var-requires": "off",
  },
};

module.exports = config;
