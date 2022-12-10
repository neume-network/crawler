// This is a script to generate ownership history.
// Incomplete right now.
import { decodeParameters, encodeFunctionCall, toHex } from "eth-fun";
import { env } from "process";
import { DB } from "./database/index.js";
import { messages } from "./extraction-worker/src/api.mjs";
const BLOCK_NUMBER = parseInt(process.argv[2]);
const db = new DB("./tracks");
const { route } = messages;
const options = {
    url: env.RPC_HTTP_HOST,
};
if (env.RPC_API_KEY) {
    options.headers = {
        Authorization: `Bearer ${env.RPC_API_KEY}`,
    };
}
const iterator = db.level.iterator();
while (true) {
    const entries = await iterator.nextv(parseInt(env.EXTRACTION_WORKER_CONCURRENCY));
    if (entries.length === 0)
        break;
    entries.map(async (e) => {
        const [id, value] = e;
        console.log(id);
        const [chainId, address, tokenId, blockNumber] = id.split("/");
        const data = encodeFunctionCall({
            name: "ownerOf",
            type: "function",
            inputs: [
                {
                    name: "tokenId",
                    type: "uint256",
                },
            ],
        }, [tokenId]);
        const message = await route({
            type: "json-rpc",
            options,
            version: "0.0.1",
            method: "eth_call",
            params: [
                {
                    from: null,
                    to: address,
                    data,
                },
                toHex(BLOCK_NUMBER),
            ],
        });
        if (message.error)
            console.log(id, message.error);
        else
            console.log(id, decodeParameters(["address"], message.results));
    });
}
