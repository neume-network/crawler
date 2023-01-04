import { compile } from "json-schema-to-typescript";
import { fileURLToPath } from "url";

const _daemonJsonrpcSchema = {
  "type": "object",
  "title": 'DaemonJsonrpcType',
  "oneOf": [
    {
      "$ref": "#/$defs/getIdsChanged_fill",
    },
    {
      "$ref": "#/$defs/getAllContracts",
    },
  ],
  "required": ["jsonrpc", "id", "method"],
  "$defs": {
    "getIdsChanged_fill": {
      "type": "object",
      "properties": {
        "jsonrpc": { "type": "string", "const": "2.0" },
        "id": { "type": "string" },
        "method": { "type": "string", "const": "getIdsChanged_fill" },
        "params": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "string"
          }
        }
      },
      "required": ["jsonrpc", "id", "method", "params"]
    },
    "getAllContracts": {
      "type": "object",
      "properties": {
        "jsonrpc": { "type": "string", "const": "2.0" },
        "id": { "type": "string" },
        "method": { "type": "string", "const": "getAllContracts" },
      },
      "required": ["jsonrpc", "id", "method"]
    }
  },
}

export const daemonJsonrpcSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": 'DaemonJsonrpcType',
  "oneOf": [
    { "$ref": "#/$defs/request" },
    { "type": "array", "items": { "$ref": "#/$defs/request" } }
  ],
  "$defs": {
    "request": {
      "type": "object",
      "oneOf": [
        {
          "$ref": "#/$defs/getIdsChanged_fill",
        },
        {
          "$ref": "#/$defs/getUserContracts",
        },
      ],
    },
    "getIdsChanged_fill": {
      "type": "object",
      "properties": {
        "jsonrpc": { "type": "string", "const": "2.0" },
        "id": { "type": "string" },
        "method": { "type": "string", "const": "getIdsChanged_fill" },
        "params": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "string"
          }
        }
      },
      "required": ["jsonrpc", "id", "method", "params"]
    },
    "getUserContracts": {
      "type": "object",
      "properties": {
        "jsonrpc": { "type": "string", "const": "2.0" },
        "id": { "type": "string" },
        "method": { "type": "string", "const": "getUserContracts" },
      },
      "required": ["jsonrpc", "id", "method"]
    }
  },
}

// This is called from package.json to compile the above type
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compile(daemonJsonrpcSchema).then(console.log)
}
