import { Jsonrpc } from "@neume-network/schema";
import { encodeFunctionCall, decodeParameters, toHex } from "eth-fun";
import { Strategy } from "../strategies/strategy.types.js";

import { NFT } from "../types.js";
import { randomItem } from "../utils.js";

export async function callTokenUri(
  this: Strategy,
  blockNumber: number,
  nft: NFT,
  overrideSignature?: Record<string, any>,
): Promise<string> {
  const signature = overrideSignature ?? {
    name: "tokenURI",
    type: "function",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
      },
    ],
  };
  const rpc = randomItem(this.config.chain[this.chain].rpc);
  const options = {
    url: rpc.url,
    ...(rpc.key && {
      headers: {
        Authorization: `Bearer ${rpc.key}`,
      },
    }),
    retry: {
      retries: 3,
    },
  };
  const data = encodeFunctionCall(signature, [nft.erc721.token.id]);

  const from = null;
  const msg: Jsonrpc = {
    type: "json-rpc",
    commissioner: "",
    version: "0.0.1",
    options,
    method: "eth_call",
    params: [
      {
        from,
        to: nft.erc721.address,
        data,
      },
      toHex(blockNumber),
    ],
  };
  const ret = await this.worker(msg);

  if (ret.error)
    throw new Error(`Error while calling tokenURI on contract: ${JSON.stringify(ret, null, 2)}`);

  const uri = decodeParameters(["string"], ret.results)[0];

  if (!uri) throw new Error(`tokenURI shouldn't be empty ${JSON.stringify(nft, null, 2)}`);

  if (typeof uri !== "string")
    throw new Error(`typeof tokenURI invalid ${JSON.stringify(nft, null, 2)}`);

  return uri;
}
