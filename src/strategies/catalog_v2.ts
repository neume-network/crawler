/**
 * Strategy to crawl Catalog songs on 0x0bC2A24ce568DAd89691116d5B34DEB6C203F342.
 * Also known as Catalog V2 as they used to use Zora initially.
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { Config, NFT } from "../types.js";
import { Strategy } from "./strategy.types.js";
import { randomItem } from "../utils.js";

export default class CatalogV2 implements Strategy {
  public static version = "2.0.0";
  public static createdAtBlock = 0;
  public static deprecatedAtBlock = null;
  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  crawl = async (nft: NFT) => {
    nft.erc721.token.uri = await callTokenUri(
      this.worker,
      this.config,
      nft.erc721.blockNumber,
      nft,
    );

    try {
      nft.erc721.token.uriContent = await getIpfsTokenUri(
        nft.erc721.token.uri,
        this.worker,
        this.config,
      );
    } catch (err: any) {
      if (err.message.includes("Invalid CID")) {
        console.warn("Invalid CID: Ignoring the given track.", JSON.stringify(nft, null, 2));
        return null;
      }
      if (err.message.includes("504") || err.message.includes("AbortError")) {
        console.warn(
          "Couldn't find CID on the IPFS network: Ignoring NFT",
          JSON.stringify(nft, null, 2),
        );
        return null;
      }
      throw err;
    }

    nft.creator = await this.callCreator(
      nft.erc721.address,
      nft.erc721.blockNumber,
      nft.erc721.token.id,
    );

    const datum = nft.erc721.token.uriContent;

    let duration;
    if (datum?.duration) {
      duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
    }

    return {
      version: CatalogV2.version,
      title: datum.title,
      duration,
      artist: {
        version: CatalogV2.version,
        name: datum.artist,
        address: nft.creator,
      },
      platform: {
        version: CatalogV2.version,
        name: "Catalog",
        uri: "https://catalog.works",
      },
      erc721: {
        transaction: {
          from: nft.erc721.transaction.from,
          to: nft.erc721.transaction.to,
          blockNumber: nft.erc721.transaction.blockNumber,
          transactionHash: nft.erc721.transaction.transactionHash,
        },
        version: CatalogV2.version,
        createdAt: nft.erc721.blockNumber,
        tokenId: nft.erc721.token.id,
        address: nft.erc721.address,
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
          version: CatalogV2.version,
          uri: datum.image,
          mimetype: "image",
        },
        {
          version: CatalogV2.version,
          uri: datum.losslessAudio,
          mimetype: datum.mimeType,
        },
      ],
    };
  };

  updateOwner(nft: NFT) {}

  private callCreator = async (
    to: string,
    blockNumber: number,
    tokenId: string,
  ): Promise<string> => {
    const rpc = randomItem(this.config.rpc);
    const data = encodeFunctionCall(
      {
        name: "creator",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "_tokenId",
          },
        ],
      },
      [tokenId],
    );
    const msg = await this.worker({
      type: "json-rpc",
      commissioner: "",
      version: "0.0.1",
      method: "eth_call",
      options: {
        url: rpc.url,
        retry: {
          retries: 3,
        },
      },
      params: [
        {
          to,
          data,
        },
        toHex(blockNumber),
      ],
    });

    if (msg.error)
      throw new Error(
        `Error while calling owner on contract: ${to} ${JSON.stringify(msg, null, 2)}`,
      );

    const creator = decodeParameters(["address"], msg.results)[0];

    if (typeof creator !== "string")
      throw new Error(`typeof owner invalid ${JSON.stringify(msg, null, 2)}`);

    return creator;
  };
}
