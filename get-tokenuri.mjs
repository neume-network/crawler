import { messages } from "./extraction-worker/src/api.mjs";
import { env } from "process";

const { route } = messages;

function makeRequest(tokenURI) {
  return {
    type: "arweave",
    version: "0.0.1",
    options: {
      uri: tokenURI,
      gateway: env.ARWEAVE_HTTPS_GATEWAY,
    },
  };
}

export async function getTokenUri(nft) {
  const msg = await route(makeRequest(nft.erc721.tokens[0].tokenURI));
  nft.erc721.tokens[0].tokenURIContent = msg.results;
  return nft;
}
