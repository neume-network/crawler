/**
 * Strategy to crawl Noizd songs at 0xf5819e27b9bad9f97c177bf007c1f96f26d91ca6.
 *
 * Noizd also has a NFT collection on Polygon. The collection on Ethereum is known
 * as Noizd.
 *
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { AbstractSublevel } from "abstract-level";
import { Level } from "level";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { handleTransfer } from "../components/handle-transfer.js";
import { CHAINS, Config, Contract, NFT } from "../types.js";
import { localStorage } from "../../database/localstorage.js";
import { ERC721Strategy } from "./strategy.types.js";

export default class Noizd implements ERC721Strategy {
  public static version = "1.0.0";
  // Oldest NFT mint found using OpenSea: https://etherscan.io/tx/0x9cd2b56dadc49a3c6ddb5f130de9c932a78a0ccb21c930ab978ce51cc5819901
  static createdAtBlock = 13493464;
  createdAtBlock = Noizd.createdAtBlock;
  deprecatedAtBlock = null;
  chain = CHAINS.eth;
  worker: ExtractionWorkerHandler;
  config: Config;
  localStorage: AbstractSublevel<Level<string, any>, string | Buffer | Uint8Array, string, any>;
  contracts: AbstractSublevel<typeof this.localStorage, any, string, Contract>;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
    this.localStorage = localStorage.sublevel(Noizd.name, {
      valueEncoding: "json",
    });
    this.contracts = this.localStorage.sublevel("contracts", {
      valueEncoding: "json",
    });

    const NOIZD_NFT_CONTRACT = "0xf5819e27b9bad9f97c177bf007c1f96f26d91ca6";
    this.contracts.put(NOIZD_NFT_CONTRACT, {
      name: Noizd.name,
      version: Noizd.version,
    });
  }

  crawl = async (from: number, to: number, recrawl: boolean) => {
    await handleTransfer.call(this, from, to, recrawl);
  };

  fetchMetadata = async (nft: NFT) => {
    nft.erc721.token.uri = await callTokenUri.call(this, nft.erc721.blockNumber, nft);
    try {
      nft.erc721.token.uriContent = (await getIpfsTokenUri.call(
        this,
        nft.erc721.token.uri,
      )) as Record<string, any>;
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

    const datum = nft.erc721.token.uriContent;

    let duration;
    if (datum?.duration) {
      duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
    }

    return {
      version: Noizd.version,
      title: datum.name,
      duration,
      uid: await this.nftToUid(nft),
      artist: {
        version: Noizd.version,
        name: datum.artist_name,
        address: datum.artist_address,
      },
      platform: {
        version: Noizd.version,
        name: "Noizd",
        uri: "https://noizd.com",
      },
      erc721: {
        version: Noizd.version,
        createdAt: nft.erc721.blockNumber,
        address: nft.erc721.address,
        tokens: [
          {
            id: nft.erc721.token.id,
            uri: nft.erc721.token.uri,
            metadata: {
              ...datum,
              name: datum.name,
              description: datum.description,
              image: datum.image,
            },
            owners: [
              {
                from: nft.erc721.transaction.from,
                to: nft.erc721.transaction.to,
                blockNumber: nft.erc721.blockNumber,
                transactionHash: nft.erc721.transaction.transactionHash,
                alias: undefined,
              },
            ],
          },
        ],
      },
      manifestations: [
        {
          version: Noizd.version,
          uri: datum.audio_url,
          mimetype: "audio",
        },
        {
          version: Noizd.version,
          uri: datum.image,
          mimetype: "image",
        },
      ],
    };
  };

  nftToUid = async (nft: NFT) =>
    `${this.chain}/${Noizd.name}/${nft.erc721.address.toLowerCase()}/${nft.erc721.token.id}`;
}
