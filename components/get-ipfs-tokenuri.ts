import { messages } from "../extraction-worker/src/api.mjs";
import { env } from "process";
import { NFT } from "../types.js";

const { route } = messages;

function makeRequest(tokenURI: string) {
  return {
    type: "ipfs",
    version: "0.0.1",
    options: {
      uri: tokenURI,
      gateway: env.IPFS_HTTPS_GATEWAY,
    },
  };
}

export async function getIpfsTokenUri(nft: NFT) {
  if (!nft.erc721.token.uri)
    throw new Error(
      `tokenURI required for IPFS: ${JSON.stringify(nft, null, 2)}`
    );
  const msg = await route(makeRequest(nft.erc721.token.uri));
  nft.erc721.token.uriContent = msg.results;
  return nft;
}
