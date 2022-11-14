import pMap from "p-map";
import path from "path";
import { env } from "process";
import { toHex } from "eth-fun";
import { readFileSync, writeFileSync } from "fs";

import { messages } from "./extraction-worker/src/api.mjs";
import {
  endpointStore,
  populateEndpointStore,
} from "./extraction-worker/src/endpoint_store.mjs";
import { DB } from "./database/index.js";
import {
  extractSoundProtocolContract,
  editionCreatedSelector,
  isSoundProtocolCreateEvent,
} from "./strategies/sound-protocol.mjs";

// For demo purposes
const FROM = 15_89_0106;
const TO = 15_89_8525;
const STEP = 100;

const { route } = messages;

export const contracts = JSON.parse(readFileSync("./contracts.json"));

// This is used by extraction-worker for rate limiting
populateEndpointStore(endpointStore, {
  [env.RPC_HTTP_HOST]: {
    timeout: 30_000,
    requestsPerUnit: 200,
    unit: "second",
  },
  [env.ARWEAVE_HTTPS_GATEWAY]: {
    timeout: 30_000,
    requestsPerUnit: 500,
    unit: "second",
  },
});

// Initialize database
const db = new DB("./tracks");

const transferEventSelector =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const emptyB32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function isTransferLog(log) {
  return (
    log.topics[0] === transferEventSelector &&
    log.topics[1] === emptyB32 &&
    Object.keys(contracts).includes(log.address)
  );
}

async function crawlNft(nft) {
  console.log("crawling nft with id", nft.erc721.address, nft.erc721.token.id);

  const { crawl } = await import(
    path.resolve("./strategies", `${nft.platform.name}.mjs`)
  );
  const track = await crawl(nft);

  db.insert(
    {
      chainId: 1,
      blockNumber: track.erc721.createdAt,
      address: track.erc721.address,
      tokenId: track.erc721.tokenId,
    },
    track
  );
}

async function callLogs(from, to) {
  const options = {
    url: env.RPC_HTTP_HOST,
  };

  const blocks = [];
  for (let i = from; i < to; i += STEP) {
    blocks.push(i);
  }

  await pMap(
    blocks,
    async (i) => {
      const fromBlock = toHex(i);
      const toBlock = toHex(Math.min(i + STEP, to));
      console.log("crawling block", i, Math.min(i + STEP, to));
      const message = await route({
        type: "json-rpc",
        method: "eth_getLogs",
        params: [
          {
            fromBlock,
            toBlock,
            address: Object.keys(contracts),
            topics: [[transferEventSelector, editionCreatedSelector]],
          },
        ],
        version: "0.0.1",
        options,
      });

      if (message.error) {
        console.log(message.error);
        return;
      }

      const logs = message.results;

      await Promise.all(
        logs.map(async (log) => {
          if (isTransferLog(log)) {
            const nft = {
              platform: {
                ...contracts[log.address],
              },
              erc721: {
                createdAt: parseInt(log.blockNumber, 16),
                address: log.address,
                token: {
                  minting: {
                    transactionHash: log.transactionHash,
                  },
                  id: BigInt(log.topics[3]).toString(10),
                },
              },
            };

            await crawlNft(nft);
          }
        })
      );
    },
    { concurrency: parseInt(env.EXTRACTION_WORKER_CONCURRENCY) }
  );

  for await (const [id, value] of db.level.iterator()) {
    console.log(id);
  }
}

async function retryPendingNfts() {
  const iterator = pendingDb.level.iterator();
  while (true) {
    const entries = await iterator.nextv(
      Number(env.EXTRACTION_WORKER_CONCURRENCY)
    );
    console.log(entries);

    if (entries.length === 0) break;

    await Promise.all(
      entries.map(async (entry) => {
        const [id, value] = entry;
        crawlNft(value);
      })
    );
  }
}

async function filterContracts(from, to) {
  const options = {
    url: env.RPC_HTTP_HOST,
  };

  const blocks = [];
  for (let i = from; i < to; i += STEP) {
    blocks.push(i);
  }

  await pMap(
    blocks,
    async (i) => {
      const fromBlock = toHex(i);
      const toBlock = toHex(Math.min(i + STEP, to));

      const message = await route({
        type: "json-rpc",
        method: "eth_getLogs",
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
        console.log(message.error);
        return;
      }

      const logs = message.results;

      logs.map(async (log) => {
        if (isSoundProtocolCreateEvent(log)) {
          const address = extractSoundProtocolContract(log);
          console.log("found new contract", address);
          contracts[address] = {
            name: "sound-protocol",
          };
          writeFileSync("./contracts.json", JSON.stringify(contracts, null, 2));
        }
      });
    },
    { concurrency: parseInt(env.EXTRACTION_WORKER_CONCURRENCY) }
  );
}

await filterContracts(FROM, TO);
console.log("filtered", contracts);
await callLogs(FROM, TO);
// await retryPendingNfts();
