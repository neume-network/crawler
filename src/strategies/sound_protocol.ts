import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { decodeLog, toHex } from "eth-fun";

import { callTokenUri } from "../components/call-tokenuri.js";
import { getArweaveTokenUri } from "../components/get-arweave-tokenuri.js";
import { callOwner } from "../components/call-owner.js";
import { Config, JsonRpcLog, NFT } from "../types.js";
import { Strategy } from "./strategy.types.js";
import { randomItem } from "../utils.js";

export default class SoundProtocol implements Strategy {
  public static version = "2.0.0";
  public static createdAtBlock = 15570834;
  public static deprecatedAtBlock = null;
  public static invalidIDs = [];
  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  filterContracts = async (from: number, to: number) => {
    const editionCreatedSelector =
      "0x405098db99342b699216d8150e930dbbf2f686f5a43485aed1e69219dafd4935";

    const rpcHost = randomItem(this.config.rpc);
    const options = {
      url: rpcHost.url,
      headers: {
        ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
      },
      retry: {
        retries: 3,
      },
    };

    const fromBlock = toHex(from);
    const toBlock = toHex(to);

    const message = await this.worker({
      type: "json-rpc",
      method: "eth_getLogs",
      commissioner: SoundProtocol.name,
      params: [
        {
          fromBlock,
          toBlock,
          topics: [[editionCreatedSelector]],
        },
      ],
      version: "0.0.1",
      options,
    });

    if (message.error) {
      throw new Error(
        `Error occured while filtering ${SoundProtocol.name} contracts: \n${JSON.stringify(
          message,
          null,
          2,
        )}`,
      );
    }

    const logs = message.results as any as Array<JsonRpcLog>;

    return logs.map((log) => {
      const topics = log.topics;
      topics.shift();
      const result = decodeLog(
        [
          { type: "address", name: "soundEdition", indexed: true },
          { type: "address", name: "deployer", indexed: true },
          { type: "bytes", name: "initData" },
          { type: "address[]", name: "contracts" },
          { type: "bytes[]", name: "data" },
          { type: "bytes[]", name: "results" },
        ],
        log.data,
        topics,
      );
      return {
        address: result.soundEdition.toLowerCase(),
        name: SoundProtocol.name,
        version: SoundProtocol.version,
      };
    });
  };

  crawl = async (nft: NFT) => {
    if (
      SoundProtocol.invalidIDs.filter((id) =>
        `${nft.erc721.address}/${nft.erc721.token.id}`.match(id),
      ).length != 0
    ) {
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because it is blacklisted`,
      );
      return null;
    }

    nft.erc721.token.uri = await callTokenUri(
      this.worker,
      this.config,
      nft.erc721.blockNumber,
      nft,
    );

    if (!nft.erc721.token.uri.includes("ar://")) {
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because includes invalid tokenURI`,
      );
      return null;
    }

    nft.erc721.token.uriContent = await getArweaveTokenUri(
      nft.erc721.token.uri,
      this.worker,
      this.config,
    );

    nft.creator = await callOwner(
      this.worker,
      this.config,
      nft.erc721.address,
      nft.erc721.blockNumber,
    );

    try {
      const datum = nft.erc721.token.uriContent as any;

      return {
        version: SoundProtocol.version,
        title: datum.name,
        artist: {
          version: SoundProtocol.version,
          name: datum.artist,
          address: nft.creator,
        },
        platform: {
          version: SoundProtocol.version,
          name: "Sound Protocol",
          uri: "https://sound.xyz",
        },
        erc721: {
          version: SoundProtocol.version,
          createdAt: nft.erc721.blockNumber,
          transaction: {
            from: nft.erc721.transaction.from,
            to: nft.erc721.transaction.to,
            blockNumber: nft.erc721.transaction.blockNumber,
            transactionHash: nft.erc721.transaction.transactionHash,
          },
          address: nft.erc721.address,
          tokenId: nft.erc721.token.id,
          tokenURI: nft.erc721.token.uri,
          metadata: {
            ...datum,
            name: datum.name,
            description: datum.description,
            image: datum.image,
          },
        },
        manifestations: [
          {
            version: SoundProtocol.version,
            uri: datum.losslessAudio,
            mimetype: "audio",
          },
          {
            version: SoundProtocol.version,
            uri: datum.image,
            mimetype: "image",
          },
        ],
      };
    } catch {
      // Failed to transform the track. Most probably the metadata is
      // incorrectly formatted. Ignoring the track.
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because of incorrect metadata`,
      );
      return null;
    }
  };

  updateOwner(nft: NFT) {}
}
