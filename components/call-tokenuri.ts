import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Jsonrpc } from "@neume-network/schema";
import { encodeFunctionCall, decodeParameters, toHex } from "eth-fun";

import { NFT } from "../types.js";
import { Config } from "../types.js";
import { randomItem } from "../utils.js";

export async function callTokenUri(
  worker: ExtractionWorkerHandler,
  config: Config,
  blockNumber: number,
  nft: NFT
) {
  const signature = {
    name: "tokenURI",
    type: "function",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
      },
    ],
  };
  const rpc = randomItem(config.rpc);
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
  const ret = await worker(msg);

  if (msg.error)
    throw new Error(
      `Error while calling tokenURI on contract: ${JSON.stringify(
        msg,
        null,
        2
      )} \n${JSON.stringify(nft, null, 2)}`
    );

  nft.erc721.token.uri = decodeParameters(["string"], ret.results)[0];

  return nft;
}