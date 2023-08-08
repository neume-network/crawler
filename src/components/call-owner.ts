import { toHex, encodeFunctionSignature, decodeParameters } from "eth-fun";
import { Strategy } from "../strategies/strategy.types.js";
import { randomItem } from "../utils.js";

export async function callOwner(this: Strategy, to: string, blockNumber: number): Promise<string> {
  const rpc = randomItem(this.config.chain[this.chain].rpc);
  const data = encodeFunctionSignature("owner()");
  const msg = await this.worker({
    type: "json-rpc",
    commissioner: "",
    version: "0.0.1",
    method: "eth_call",
    options: {
      url: rpc.url,
      retry: {
        retries: 3,
      },
    },
    params: [
      {
        to,
        data,
      },
      toHex(blockNumber),
    ],
  });

  if (msg.error)
    throw new Error(`Error while calling owner on contract: ${to} ${JSON.stringify(msg, null, 2)}`);

  const owner = decodeParameters(["address"], msg.results)[0];

  if (typeof owner !== "string")
    throw new Error(`typeof owner invalid ${JSON.stringify(msg, null, 2)}`);

  return owner;
}
