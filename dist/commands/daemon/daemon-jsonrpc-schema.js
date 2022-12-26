import { compile } from "json-schema-to-typescript";
import { fileURLToPath } from "url";
export const daemonJsonrpcSchema = {
    "type": "object",
    "title": 'DaemonJsonrpcType',
    "properties": {
        "jsonrpc": { "type": "string", "const": "2.0" },
        "id": { "type": "string" },
        "method": { "type": "string" },
        "params": {
            "oneOf": [
                {
                    "$ref": "#/$defs/getIdsChanged"
                }
            ]
        }
    },
    "required": ["jsonrpc", "id", "method"],
    "$defs": {
        "getIdsChanged": {
            "type": "array",
            "items": {
                "type": "string"
            }
        }
    }
};
// This is called from package.json to compile the above type
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    compile(daemonJsonrpcSchema).then(console.log);
}
