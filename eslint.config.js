// Lints the Node pipeline under scripts/. Imports resolve through
// pc-quote-builder's node_modules because this repository has no root
// manifest by design.
import js from "./pc-quote-builder/node_modules/@eslint/js/src/index.js";
import globals from "./pc-quote-builder/node_modules/globals/index.js";

export default [
  { ignores: ["**/node_modules/**", "scripts/fixtures/**"] },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
