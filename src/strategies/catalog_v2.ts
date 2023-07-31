/**
 * Strategy to crawl Catalog songs on 0x0bC2A24ce568DAd89691116d5B34DEB6C203F342.
 * Also known as Catalog V2 as they used to use Zora initially.
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { CHAINS, Config, Contract, NFT } from "../types.js";
import { ERC721Strategy } from "./strategy.types.js";
import { randomItem } from "../utils.js";
import { AbstractSublevel } from "abstract-level";
import { Level } from "level";
import { localStorage } from "../../database/localstorage.js";
import { handleTransfer } from "../components/handle-transfer.js";

export default class CatalogV2 implements ERC721Strategy {
  public static version = "2.0.0";
  // The Catalog contract was deployed at https://etherscan.io/tx/0x65a0c575267dae42937363299c58cb0d30e35b0a6741ff0dc079ffd927c8e1b2
  static createdAtBlock = 14566826;
  createdAtBlock = CatalogV2.createdAtBlock;
  deprecatedAtBlock = null;
  chain = CHAINS.eth;
  worker: ExtractionWorkerHandler;
  config: Config;
  localStorage: AbstractSublevel<Level<string, any>, string | Buffer | Uint8Array, string, any>;
  contracts: AbstractSublevel<typeof this.localStorage, any, string, Contract>;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
    this.localStorage = localStorage.sublevel(CatalogV2.name, {
      valueEncoding: "json",
    });
    this.contracts = this.localStorage.sublevel("contracts", {
      valueEncoding: "json",
    });

    const CATALOG_NFT_CONTRACT = "0x0bC2A24ce568DAd89691116d5B34DEB6C203F342";
    this.contracts.put(CATALOG_NFT_CONTRACT, {
      name: CatalogV2.name,
      version: CatalogV2.version,
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
      uid: await this.nftToUid(nft),
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
        version: CatalogV2.version,
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

  nftToUid = async (nft: NFT) =>
    `${this.chain}/${CatalogV2.name}/${nft.erc721.address.toLowerCase()}/${nft.erc721.token.id}`;

  private callCreator = async (
    to: string,
    blockNumber: number,
    tokenId: string,
  ): Promise<string> => {
    const rpc = randomItem(this.config.chain[this.chain].rpc);
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
