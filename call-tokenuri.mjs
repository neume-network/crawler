import { messages } from "./extraction-worker/src/api.mjs";
import { encodeFunctionCall, decodeParameters, toHex } from "eth-fun";
import { env } from "process";

const { route } = messages;

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

const options = {
  url: env.RPC_HTTP_HOST,
};

if (env.RPC_API_KEY) {
  options.headers = {
    Authorization: `Bearer ${env.RPC_API_KEY}`,
  };
}

function makeRequest(
  tokenId,
  blockNumber,
  address,
  signature,
  transactionHash
) {
  const data = encodeFunctionCall(signature, [tokenId]);

  const from = null;
  return {
    type: "json-rpc",
    options,
    version: "0.0.1",
    method: "eth_call",
    params: [
      {
        from,
        to: address,
        data,
      },
      toHex(blockNumber),
    ],
    metadata: {
      transactionHash,
      block: {
        number: blockNumber,
      },
      contract: {
        address,
      },
      tokenId,
    },
  };
}

export async function callTokenUris(nfts) {
  const ids = Object.keys(nfts);

  const msgs = await Promise.all(
    ids.map(async (id) => {
      const nft = nfts[id];
      const msg = await route(
        makeRequest(
          nft.erc721.tokens[0].id,
          nft.erc721.createdAt,
          nft.erc721.address,
          signature,
          nft.erc721.tokens[0].transactionHash
        )
      );

      nft.erc721.tokens[0].tokenURI = decodeParameters(
        ["string"],
        msg.results
      )[0];

      return nft;
    })
  );

  return msgs;
}
