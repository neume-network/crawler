import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { Level } from "level";
import { decodeLog } from "eth-fun";
import { AbstractSublevel } from "abstract-level";

import { callTokenUri } from "../components/call-tokenuri.js";
import { getArweaveTokenUri } from "../components/get-arweave-tokenuri.js";
import { callOwner } from "../components/call-owner.js";
import { CHAINS, Config, NFT } from "../types.js";
import { ERC721Strategy } from "./strategy.types.js";
import { ethGetLogs } from "../components/eth-get-logs.js";
import { localStorage } from "../../database/localstorage.js";
import { handleTransfer } from "../components/handle-transfer.js";

export default class SoundProtocol implements ERC721Strategy {
  static version = "2.0.0";
  createdAtBlock = 15570834;
  deprecatedAtBlock = null;
  static invalidIDs = [];
  static TRANSFER_EVENT_SELECTOR =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  static EDITION_CREATED_SELECTOR =
    "0x405098db99342b699216d8150e930dbbf2f686f5a43485aed1e69219dafd4935";

  static chain = CHAINS.eth;
  chain = SoundProtocol.chain;
  worker: ExtractionWorkerHandler;
  config: Config;
  localStorage: AbstractSublevel<Level<string, any>, string | Buffer | Uint8Array, string, any>;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
    this.localStorage = localStorage.sublevel<string, any>(SoundProtocol.name, {
      valueEncoding: "json",
    });
  }

  crawl = async (from: number, to: number, recrawl: boolean) => {
    const { getLogsBlockSpanSize } = this.config.chain[this.chain];

    const handleEditionCreatedPromises = [];
    for (let i = from; i <= to; i += getLogsBlockSpanSize + 1)
      handleEditionCreatedPromises.push(this.handleEditionCreated(i, i + getLogsBlockSpanSize));
    await Promise.all(handleEditionCreatedPromises);

    await this.handleTransfer(from, to, recrawl);
  };

  handleEditionCreated = async (from: number, to: number) => {
    const logs = await ethGetLogs.call(this, from, to, [[SoundProtocol.EDITION_CREATED_SELECTOR]]);

    const contracts = logs.map((log) => {
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

    const contractsStorage = this.localStorage.sublevel<string, any>("contracts", {
      valueEncoding: "json",
    });

    await Promise.all(
      contracts.map(async (c) => {
        console.log("Found a SoundProtocol contract", c.address);
        // Save contract address that is to be checked for NFTs in future
        await contractsStorage.put(c.address, { name: c.name, version: c.version });
      }),
    );
  };

  handleTransfer = handleTransfer.bind(this);

  nftToUid = async (nft: NFT) =>
    `${this.chain}/${SoundProtocol.name}/${nft.erc721.address.toLowerCase()}`;

  fetchMetadata = async (nft: NFT): Promise<Track | null> => {
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

    nft.erc721.token.uri = await callTokenUri.call(this, nft.erc721.blockNumber, nft);

    if (!nft.erc721.token.uri.includes("ar://")) {
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because includes invalid tokenURI`,
      );
      return null;
    }

    try {
      nft.erc721.token.uriContent = await getArweaveTokenUri(
        nft.erc721.token.uri,
        this.worker,
        this.config,
      );
    } catch (err: any) {
      if (err.message.includes("status: 4")) {
        // we are getting 4XX. which probably means the URI is incorrect. best to ignore the track.
        return null;
      }
      throw err;
    }

    nft.creator = await callOwner.call(this, nft.erc721.address, nft.erc721.blockNumber);

    try {
      const datum = nft.erc721.token.uriContent as any;

      return {
        version: SoundProtocol.version,
        title: datum.name,
        uid: await this.nftToUid(nft),
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
}

// const { config }: { config: Config } = await import(path.resolve("./config.js"));
// const soundProtocol = new SoundProtocol(ExtractionWorker(config.worker), config);
// await soundProtocol.crawl(16_01_0000, 16_05_0000, false);
// process.exit(0);
