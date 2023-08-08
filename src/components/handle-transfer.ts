import { decodeLog } from "eth-fun";
import { JsonRpcLog, NFT } from "../types.js";
import { ethGetLogs } from "./eth-get-logs.js";
import { tracksDB } from "../../database/tracks.js";
import Lens from "../strategies/lens/lens.js";
import { ERC721Strategy } from "../strategies/strategy.types.js";
import { Token, Track } from "@neume-network/schema";

const TRANSFER_EVENT_SELECTOR =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function debug<T>(fn: (...args: any[]) => Promise<T>, name: string) {
  let labelAdded = false;

  const timeout = setTimeout(() => {
    console.time(name);
    labelAdded = true;
  }, 30_000);

  const interval = setInterval(() => {
    console.timeLog(name);
  }, 60_000);

  return async function (this: any, ...args: any[]): Promise<T> {
    const resp = await fn.call(this, ...args);
    clearTimeout(timeout);
    clearInterval(interval);
    if (labelAdded) console.timeEnd(name);
    return resp;
  };
}

export async function handleTransfer(
  this: Lens | ERC721Strategy,
  from: number,
  to: number,
  recrawl: boolean,
) {
  // `from - to` should be smaller than crawlStep but just in case
  // it is not, call handleTransfer multiple times
  const { crawlStep } = this.config.chain[this.chain];
  for (let i = from; i <= to; i += crawlStep + 1) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + crawlStep);
    await debug(
      _handleTransfer,
      `_handleTransfer is hung up for ${this.constructor.name} ${fromBlock}-${toBlock}`,
    ).call(this, fromBlock, toBlock, recrawl);
  }
}

async function _handleTransfer(
  this: Lens | ERC721Strategy,
  from: number,
  to: number,
  recrawl: boolean,
) {
  const contractsStorage = this.contracts;
  const { getLogsBlockSpanSize, getLogsAddressSize } = this.config.chain[this.chain];
  const iterator = contractsStorage.iterator();
  const entries = await iterator.all();
  const addresses = entries.map((e) => e[0]);

  const mintNFTsPromise: Promise<void>[] = [];
  const allTransferNFTs: NFT[] = [];

  for (let i = from; i <= to; i += getLogsBlockSpanSize + 1) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + getLogsBlockSpanSize);

    for (let j = 0; j < addresses.length; j += getLogsAddressSize) {
      // console.log(
      //   `handle-transfer for ${this.constructor.name} from ${fromBlock} to ${toBlock} [j=${j}]`,
      // );
      const addressSlice = addresses.slice(j, j + getLogsAddressSize);

      const logs = await debug(
        ethGetLogs,
        `eth-getLogs is hung up for ${this.constructor.name} ${fromBlock}-${toBlock}-${j}`,
      ).call(this, fromBlock, toBlock, [TRANSFER_EVENT_SELECTOR], addressSlice);

      let nfts = logs.map((log) => prepareNFT(log));

      // Partition NFTs into mints and transfers
      const { mintNfts, transferNfts } = nfts.reduce(
        (nfts, nft) => {
          if (nft.erc721.transaction.from === "0x0000000000000000000000000000000000000000") {
            nfts.mintNfts.push(nft);
          } else {
            nfts.transferNfts.push(nft);
          }
          return nfts;
        },
        { mintNfts: [] as NFT[], transferNfts: [] as NFT[] },
      );

      const promises = mintNfts.map(async (nft) => {
        let uid;
        if (!recrawl) {
          uid = await this.nftToUid(nft);
          if (await tracksDB.isTokenPresent(uid, nft.erc721.token.id)) return;
        }

        const ret = await this.fetchMetadata(nft);

        if (!ret) return;

        if (isToken(ret)) {
          const token = ret;
          const uid = await this.nftToUid(nft);
          console.log(
            "Found new NFT for an existing track",
            uid,
            nft.erc721.token.id,
            "at",
            nft.erc721.blockNumber,
          );

          tracksDB.upsertToken(uid, token);

          return;
        }

        const track = ret;
        console.log(
          "Found new NFT (could be a new track):",
          track?.title,
          nft.erc721.token.id,
          track?.platform.version,
          track?.platform.name,
          "at",
          nft.erc721.blockNumber,
        );
        await tracksDB.upsertTrack(track);
      });

      mintNFTsPromise.push(...promises);
      allTransferNFTs.push(...transferNfts);
    }
  }

  await Promise.all(mintNFTsPromise);

  await Promise.all(
    allTransferNFTs.map(async (nft) => {
      let alias;
      let uid = await this.nftToUid(nft);
      let isTrackPresent = await tracksDB.isTrackPresent(uid);

      // Track has not been crawled. Most probably we ignored it.
      // Makes no sense to record ownership transfer.
      if (!isTrackPresent) return;

      const owner = {
        from: nft.erc721.transaction.from,
        to: nft.erc721.transaction.to,
        blockNumber: nft.erc721.blockNumber,
        transactionHash: nft.erc721.transaction.transactionHash,
        alias: alias ?? undefined,
      };

      if (!recrawl && isTrackPresent) {
        const isOwnerPresent = await tracksDB.isOwnerPresent(uid, nft.erc721.token.id, owner);
        if (isOwnerPresent) return;
      }

      await tracksDB.upsertOwner(uid, nft.erc721.token.id, owner, this.constructor.name);

      console.log(
        "Update ownership of",
        nft.erc721.address,
        "at",
        nft.erc721.blockNumber,
        "from",
        nft.erc721.transaction.from,
        "to",
        nft.erc721.transaction.to,
      );
    }),
  );
}

function prepareNFT(log: JsonRpcLog): NFT {
  if (!log.topics[3] || !log.transactionHash || !log.blockNumber) {
    throw new Error(`log doesn't contain the required fields: ${JSON.stringify(log, null, 2)}`);
  }

  const decodedTopics = decodeLog(
    [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    log.data,
    log.topics.slice(1),
  );

  return {
    platform: {
      name: "<null>",
      version: "1.0",
    },
    erc721: {
      blockNumber: parseInt(log.blockNumber, 16),
      address: log.address,
      transaction: {
        from: decodedTopics[0],
        to: decodedTopics[1],
        transactionHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
      },
      token: {
        id: BigInt(log.topics[3]).toString(10),
      },
    },
    metadata: {},
  };
}

function isToken(data: Track | Token): data is Token {
  if ("uid" in data) return false;
  return true;
}
