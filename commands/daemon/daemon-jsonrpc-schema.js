import { compile } from "json-schema-to-typescript";
import { fileURLToPath } from "url";

export const daemonJsonrpcSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "DaemonJsonrpcType",
  oneOf: [{ $ref: "#/$defs/request" }, { type: "array", items: { $ref: "#/$defs/request" } }],
  $defs: {
    request: {
      type: "object",
      oneOf: [
        {
          $ref: "#/$defs/getTracks",
        },
        {
          $ref: "#/$defs/getLocalStorage",
        },
      ],
    },
    getTracks: {
      type: "object",
      properties: {
        jsonrpc: { type: "string", const: "2.0" },
        id: { type: "string" },
        method: { type: "string", const: "getTracks" },
        params: {
          type: "object",
          properties: {
            since: { type: "number", $comment: "Since is a unix timestamp" },
            platform: { type: "string" },
          },
          required: ["since", "platform"],
        },
      },
      required: ["jsonrpc", "id", "method", "params"],
    },
    getLocalStorage: {
      type: "object",
      properties: {
        jsonrpc: { type: "string", const: "2.0" },
        id: { type: "string" },
        method: { type: "string", const: "getLocalStorage" },
        params: {
          type: "object",
          properties: {
            platform: { type: "string" },
          },
          required: ["platform"],
        },
      },
      required: ["jsonrpc", "id", "method", "params"],
    },
  },
};

// This is called from package.json to compile the above type
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compile(daemonJsonrpcSchema).then(console.log);
}
