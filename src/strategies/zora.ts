/**
 * Note: Catalog (catalog.works) used to use Zora to mint music NFTs
 * Since, Zora is a marketplace we will find non-music NFTs which
 * we will have to filter.
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { anyIpfsToNativeIpfs } from "ipfs-uri-utils";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { NFT, Config, CHAINS, Contract } from "../types.js";
import { randomItem } from "../utils.js";

import { ERC721Strategy } from "./strategy.types.js";
import { handleTransfer } from "../components/handle-transfer.js";
import { AbstractSublevel } from "abstract-level";
import { Level } from "level";
import { localStorage } from "../../database/localstorage.js";

export default class Zora implements ERC721Strategy {
  static version = "1.0.0";
  static createdAtBlock = 11996516;
  createdAtBlock = Zora.createdAtBlock; // First catalog song: https://etherscan.io/nft/0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7/1678
  // Last song on Zora contract: https://beta.catalog.works/lucalush/velvet-girls
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fcatalog-prod.hasura.app%2Fv1%2Fgraphql&query=query+MyQuery+%7B%0A++tracks%28%0A++++where%3A+%7Bcontract_address%3A+%7B_iregex%3A+%220xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7%22%7D%7D%0A++++order_by%3A+%7Bcreated_at%3A+desc%7D%0A++%29+%7B%0A++++created_at%0A++++contract_address%0A++++short_url%0A++++title%0A++++nft_id%0A++%7D%0A%7D%0A
  deprecatedAtBlock = null;
  worker: ExtractionWorkerHandler;
  config: Config;
  chain = CHAINS.eth;
  localStorage: AbstractSublevel<Level<string, any>, string | Buffer | Uint8Array, string, any>;
  contracts: AbstractSublevel<typeof this.localStorage, any, string, Contract>;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
    this.localStorage = localStorage.sublevel(Zora.name, {
      valueEncoding: "json",
    });
    this.contracts = this.localStorage.sublevel("contracts", {
      valueEncoding: "json",
    });

    const ZORA_NFT_CONTRACT = "0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7";
    this.contracts.put(ZORA_NFT_CONTRACT, { name: Zora.name, version: Zora.version });
  }

  crawl = async (from: number, to: number, recrawl: boolean) => {
    await handleTransfer.call(this, from, to, recrawl);
  };

  fetchMetadata = async (nft: NFT) => {
    nft.erc721.token.uri = (await callTokenUri.call(this, nft.erc721.blockNumber, nft)) as string;

    try {
      nft.erc721.token.uri = anyIpfsToNativeIpfs(nft.erc721.token.uri);
    } catch (err) {
      console.warn(
        "Invalid tokenURI: Couldn't convert to IPFS URI. Ignoring the given track.",
        JSON.stringify(nft, null, 2),
      );

      return null;
    }

    nft.metadata.uri = await callTokenUri.call(this, nft.erc721.blockNumber, nft, {
      name: "tokenMetadataURI",
      type: "function",
      inputs: [
        {
          name: "tokenId",
          type: "uint256",
        },
      ],
    });

    try {
      nft.metadata.uri = anyIpfsToNativeIpfs(nft.metadata.uri);
    } catch (err) {
      console.warn(
        "Invalid tokenURI: Couldn't convert to IPFS URI. Ignoring the given track.",
        JSON.stringify(nft, null, 2),
      );

      return null;
    }

    try {
      nft.metadata.uriContent = await getIpfsTokenUri.call(this, nft.metadata.uri);
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

    // Assumption that is specific to Catalog
    if (!nft.metadata.uriContent?.body?.version?.includes("catalog")) {
      return null;
    }

    nft.creator = await this.callTokenCreator(
      nft.erc721.address,
      nft.erc721.blockNumber,
      nft.erc721.token.id,
    );

    const datum = nft.metadata.uriContent;

    const title = datum?.body?.title || datum?.name;
    const artist = datum?.body?.artist;
    const description = datum?.body?.notes;
    const artwork = datum?.body?.artwork?.info?.uri;
    let duration;
    if (datum.body && datum.body.duration) {
      duration = `PT${Math.floor(datum.body.duration / 60)}M${(datum.body.duration % 60).toFixed(
        0,
      )}S`;
    }

    return {
      version: Zora.version,
      title,
      duration,
      uid: await this.nftToUid(nft),
      artist: {
        version: Zora.version,
        name: artist,
        address: nft.creator,
      },
      platform: {
        version: Zora.version,
        name: "Catalog",
        uri: "https://catalog.works",
      },
      erc721: {
        version: Zora.version,
        createdAt: nft.erc721.blockNumber,
        address: nft.erc721.address,
        tokens: [
          {
            id: nft.erc721.token.id,
            uri: nft.erc721.token.uri,
            metadata: {
              ...datum,
              name: title,
              description,
              // TODO: add image here
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
          version: Zora.version,
          uri: nft.erc721.token.uri,
          mimetype: datum.body.mimeType,
        },
        {
          version: Zora.version,
          uri: artwork,
          mimetype: "image",
        },
      ],
    } as Track;
  };

  nftToUid = async (nft: NFT) =>
    `${this.chain}/${Zora.name}/${nft.erc721.address.toLowerCase()}/${nft.erc721.token.id}`;

  private callTokenCreator = async (
    to: string,
    blockNumber: number,
    tokenId: string,
  ): Promise<string> => {
    const rpc = randomItem(this.config.chain[this.chain].rpc);
    const data = encodeFunctionCall(
      {
        name: "tokenCreators",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "<input>",
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
