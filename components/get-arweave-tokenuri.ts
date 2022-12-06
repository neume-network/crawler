import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";

import { Config, NFT } from "../types.js";

export async function getArweaveTokenUri(
  worker: ExtractionWorkerHandler,
  config: Config,
  nft: NFT
) {
  if (!config.arweave?.httpsGateway)
    throw new Error(`Arweave gateway is required for ${JSON.stringify(nft)}`);
  if (!nft.erc721.token.uri)
    throw new Error(`tokenURI required to fetch content`);

  const msg = await worker({
    type: "arweave",
    commissioner: "",
    version: "0.0.1",
    options: {
      uri: nft.erc721.token.uri,
      gateway: config.arweave.httpsGateway,
      retry: {
        retries: 3,
      },
    },
  });

  if (msg.error)
    throw new Error(
      `Error while fetching Arweave URI: ${JSON.stringify(
        msg,
        null,
        2
      )} \n${JSON.stringify(nft, null, 2)}`
    );

  nft.erc721.token.uriContent = msg.results as any;
  return nft;
}
