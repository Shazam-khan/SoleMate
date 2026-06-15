import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["**/node_modules/**", "Frontend/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["backend/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^next$|^req$|^res$",
          ignoreRestSiblings: true, // allow `const { password, ...safe } = user`
          caughtErrors: "none",
        },
      ],
      "no-console": "warn",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["backend/test/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, require: "readonly" },
    },
    rules: { "no-console": "off", "no-unused-vars": "off" },
  },
];
