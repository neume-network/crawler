import { Strategy } from "../strategies/strategy.types.js";

export async function getIpfsTokenUri(this: Strategy, uri: string): Promise<Record<any, any>> {
  if (!this.config.ipfs) throw new Error(`IPFS configuration is required for getIpfsTokenUri`);

  const msg = await this.worker({
    type: "ipfs",
    version: "0.0.1",
    commissioner: "",
    options: {
      uri: uri,
      gateway: this.config.ipfs.httpsGateway,
      retry: {
        retries: 3,
      },
    },
  });

  if (msg.error) {
    throw new Error(
      `Error while fetching IPFS URI: ${JSON.stringify(msg.error)} \n${JSON.stringify(
        msg,
        null,
        2,
      )}`,
    );
  }

  const content = msg.results;

  if (!content) throw new Error(`tokenURI content shouldn't be empty`);

  return content;
}
