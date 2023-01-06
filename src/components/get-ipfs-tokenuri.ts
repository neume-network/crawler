import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";

import { Config } from "../types.js";

export async function getIpfsTokenUri(
  uri: string,
  worker: ExtractionWorkerHandler,
  config: Config
): Promise<Record<any, any>> {
  if (!config.ipfs)
    throw new Error(`IPFS configuration is required for getIpfsTokenUri`);

  const msg = await worker({
    type: "ipfs",
    version: "0.0.1",
    commissioner: "",
    options: {
      uri: uri,
      gateway: config.ipfs.httpsGateway,
      retry: {
        retries: 3,
      },
    },
  });

  if (msg.error)
    throw new Error(
      `Error while fetching IPFS URI: ${JSON.stringify(msg, null, 2)}`
    );

  const content = msg.results;

  if (!content) throw new Error(`tokenURI content shouldn't be empty`);

  return content;
}
