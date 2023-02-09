import ExtractionWorker, { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { toHex, decodeLog } from "eth-fun";

import { db } from "../database/index.js";
import { JsonRpcLog, NFT, Config, Contracts } from "../src/types.js";
import { getAllContracts, randomItem } from "../src/utils.js";
import { Strategy } from "../src/strategies/strategy.types.js";
import { Track } from "@neume-network/schema";

const TRANSFER_EVENT_SELECTOR =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const CHAIN_ID = "1";

// from and to are supposed to be included
export default async function (
  from: number,
  to: number,
  recrawl: boolean,
  config: Config,
  _strategies: typeof Strategy[],
) {
  const allContracts = await getAllContracts();
  const contracts = Object.entries(allContracts).reduce((prevValue, [addr, info]) => {
    if (_strategies.filter((s) => s.name === info.name).length)
      prevValue = { ...prevValue, ...{ [addr]: info } };
    return prevValue;
  }, {} as Contracts);
  const worker = ExtractionWorker(config.worker);
  const strategies = _strategies.map((s) => new s(worker, config));

  for (let i = from; i <= to; i += config.crawlStep + 1) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + config.crawlStep);
    await crawl(fromBlock, toBlock, recrawl, config, strategies, contracts, worker);
  }

  console.log("Exiting from crawl command");
}

// (from - to) must not be too big
// from and to are supposed to be included
async function crawl(
  from: number,
  to: number,
  recrawl: boolean,
  config: Config,
  strategies: Strategy[],
  contracts: Contracts,
  worker: ExtractionWorkerHandler,
) {
  console.log("Crawling from", from, "to", to);

  /**
   * We start crawling the NFT if the log is for a mint, else if
   * the log is for a transfer we wait for all the mints to be
   * processed.
   *
   * This is because to process a transfer we update the owner
   * field and not re-fetch the metadata.
   */

  /**
   * We have processed all the mints if all the promises in this
   * array have been resolved.
   */
  const mintNFTsPromise: Promise<void>[] = [];

  /**
   * We store all logs/NFTs beloging to a transfer event in this
   * array to process the later that is after all the mints.
   */
  const allTransferNFTs: NFT[] = [];

  for (let i = from; i <= to; i += config.getLogsBlockSpanSize + 1) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + config.getLogsBlockSpanSize);

    for (let j = 0; j < Object.keys(contracts).length; j += config.getLogsAddressSize) {
      const contractsSlice = Object.keys(contracts).slice(j, j + config.getLogsAddressSize);
      const rpcHost = randomItem(config.rpc);

      const msg = await worker({
        type: "json-rpc",
        commissioner: "",
        method: "eth_getLogs",
        options: {
          url: rpcHost.url,
          headers: {
            ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
          },
          retry: {
            retries: 3,
          },
        },
        params: [
          {
            fromBlock: toHex(fromBlock),
            toBlock: toHex(toBlock),
            address: contractsSlice,
            topics: [TRANSFER_EVENT_SELECTOR],
          },
        ],
        version: "0.0.1",
      });

      if (msg.error) {
        console.error(msg);
        throw new Error(`Error occured while fetching Transfer events`);
      }

      const logs = msg.results as any as JsonRpcLog[];
      let nfts = logs.map((log) => prepareNFT(contracts, log));

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
        let nftExists = false;

        try {
          nftExists = !!(await db.level.get(
            db.datumToKey({
              chainId: CHAIN_ID,
              address: nft.erc721.address,
              tokenId: nft.erc721.token.id,
              blockNumber: nft.erc721.blockNumber,
            }),
          ));
        } catch (err: any) {
          if (err.code !== "LEVEL_NOT_FOUND") throw err;
        }

        if (!recrawl && nftExists) return;

        const strategy = strategies.find((s) => s.constructor.name === nft.platform.name);

        if (!strategy) {
          throw new Error(
            `Couldn't find any strategy with the name of ${nft.platform.name} for address ${nft.erc721.address}`,
          );
        }

        await fetchMetadata(nft, strategy);
      });

      mintNFTsPromise.push(...promises);
      allTransferNFTs.push(...transferNfts);
    }
  }

  await Promise.all(mintNFTsPromise);

  await Promise.all(
    allTransferNFTs.map(async (nft) => {
      let nftExists = false;

      try {
        nftExists = !!(await db.level.get(
          db.datumToKey({
            chainId: CHAIN_ID,
            address: nft.erc721.address,
            tokenId: nft.erc721.token.id,
            blockNumber: nft.erc721.blockNumber,
          }),
        ));
      } catch (err: any) {
        if (err.code !== "LEVEL_NOT_FOUND") throw err;
      }

      if (!recrawl && nftExists) return;

      const strategy = strategies.find((s) => s.constructor.name === nft.platform.name);

      if (!strategy) {
        throw new Error(
          `Couldn't find any strategy with the name of ${nft.platform.name} for address ${nft.erc721.address}`,
        );
      }

      await updateOwnership(nft, strategy);
    }),
  );
}

function prepareNFT(contracts: Contracts, log: JsonRpcLog): NFT {
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
      ...contracts[log.address],
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

async function fetchMetadata(nft: NFT, strategy: Strategy) {
  let track = null;
  try {
    track = await strategy?.crawl(nft);
  } catch (err) {
    console.log(track);
    console.error(`Error occurured while crawling\n`, err, JSON.stringify(nft, null, 2));
    throw err; // Re-throwing to stop the application
  }

  if (track !== null) {
    await db.insert(
      {
        chainId: CHAIN_ID,
        address: nft.erc721.address,
        tokenId: nft.erc721.token.id,
        blockNumber: nft.erc721.blockNumber,
      },
      track,
    );

    console.log(
      "Found track:",
      track?.title,
      track?.platform.version,
      track?.platform.name,
      "at",
      track?.erc721.createdAt,
    );
  }
}

async function updateOwnership(nft: NFT, strategy: Strategy) {
  let track: Track | undefined = undefined;

  try {
    // Get the last track
    track = (
      await db.getOne({
        chainId: CHAIN_ID,
        address: nft.erc721.address,
        tokenId: nft.erc721.token.id,
        blockNumber: nft.erc721.blockNumber - 1,
      })
    ).value;
  } catch (err: any) {
    if (err.code !== "LEVEL_NOT_FOUND") throw err;
  }

  // If the NFT hasn't been crawled before we can't update its owner
  if (track) {
    track.erc721.transaction = {
      from: nft.erc721.transaction.from,
      to: nft.erc721.transaction.to,
      blockNumber: nft.erc721.transaction.blockNumber,
      transactionHash: nft.erc721.transaction.transactionHash,
    };

    // If in future we have to update strategy specific
    // ownership data we can call updateOwner function

    await db.insert(
      {
        chainId: CHAIN_ID,
        address: nft.erc721.address,
        tokenId: nft.erc721.token.id,
        blockNumber: nft.erc721.blockNumber,
      },
      track,
    );

    console.log(
      "Update ownership of",
      track.title,
      track?.platform.name,
      track?.platform.version,
      "at",
      nft.erc721.blockNumber,
      "from",
      nft.erc721.transaction.from,
      "to",
      nft.erc721.transaction.to,
    );
  }
}
