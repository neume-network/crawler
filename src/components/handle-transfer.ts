import { decodeLog } from "eth-fun";
import SoundProtocol from "../strategies/sound_protocol.js";
import { JsonRpcLog, NFT } from "../types.js";
import { ethGetLogs } from "./eth-get-logs.js";
import { tracksDB } from "../../database/tracks.js";
import Lens from "../strategies/lens/lens.js";

export async function handleTransfer(
  this: Lens | SoundProtocol,
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
    await _handleTransfer.call(this, fromBlock, toBlock, recrawl);
  }
}

async function _handleTransfer(
  this: Lens | SoundProtocol,
  from: number,
  to: number,
  recrawl: boolean,
) {
  const contractsStorage = this.localStorage.sublevel<string, any>("contracts", {});
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
      const addressSlice = addresses.slice(j, j + getLogsAddressSize);

      const logs = await ethGetLogs.call(
        this,
        fromBlock,
        toBlock,
        [SoundProtocol.TRANSFER_EVENT_SELECTOR],
        addressSlice,
      );

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
        if (!recrawl) {
          const uid = await this.nftToUid(nft);
          if (await tracksDB.isTrackPresent(uid)) return;
        }

        const track = await this.fetchMetadata(nft);

        if (track) {
          console.log(
            "Found track:",
            track?.title,
            track?.platform.version,
            track?.platform.name,
            "at",
            nft.erc721.blockNumber,
          );

          await tracksDB.upsertTrack(track);
        }
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

      if (!recrawl && (await tracksDB.isTrackPresent(uid))) return;

      await tracksDB.upsertOwner(
        uid,
        nft.erc721.token.id,
        {
          from: nft.erc721.transaction.from,
          to: nft.erc721.transaction.to,
          blockNumber: nft.erc721.blockNumber,
          transactionHash: nft.erc721.transaction.transactionHash,
          alias: alias ?? undefined,
        },
        this.constructor.name,
      );

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
