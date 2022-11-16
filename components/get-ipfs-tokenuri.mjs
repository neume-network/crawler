import { messages } from "../extraction-worker/src/api.mjs";
import { env } from "process";

const { route } = messages;

function makeRequest(tokenURI) {
  return {
    type: "ipfs",
    version: "0.0.1",
    options: {
      uri: tokenURI,
      gateway: env.IPFS_HTTPS_GATEWAY,
    },
  };
}

export async function getIpfsTokenUri(nft) {
  const msg = await route(makeRequest(nft.erc721.token.tokenURI));
  nft.erc721.token.tokenURIContent = msg.results;
  return nft;
}
