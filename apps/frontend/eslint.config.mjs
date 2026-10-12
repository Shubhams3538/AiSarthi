import { nextJsConfig } from "../../packages/eslint-config/next.js";
export default [
  ...nextJsConfig,
  {
    rules: { "turbo/no-undeclared-env-vars": "off", "react/prop-types": "off" },
  },
];
