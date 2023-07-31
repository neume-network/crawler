import { toHex } from "eth-fun";
import { randomItem } from "../utils.js";
export async function ethGetLogs(from, to, topics, address) {
    const rpcHost = randomItem(this.config.chain[this.chain].rpc);
    const msg = await this.worker({
        type: "json-rpc",
        commissioner: "",
        method: "eth_getLogs",
        options: {
            url: rpcHost.url,
            headers: {
                ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
            },
            retry: {
                retries: 3,
            },
        },
        params: [
            {
                fromBlock: toHex(from),
                toBlock: toHex(to),
                ...(address && { address: address }),
                topics: topics,
            },
        ],
        version: "0.0.1",
    });
    if (msg.error) {
        throw new Error(`Error occured while fetching Transfer events: ${JSON.stringify(msg, null, 2)}`);
    }
    return msg.results;
}
