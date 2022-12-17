import ExtractionWorker from "@neume-network/extraction-worker";
import { toHex } from "eth-fun";

import { DB } from "../database/index.js";
import { JsonRpcLog, NFT, Config } from "../types.js";
import { getContracts, randomItem } from "../utils.js";
import { Strategy } from "../strategies/strategy.types.js";
import path from "path";

const TRANSFER_EVENT_SELECTOR =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const CHAIN_ID = "1";

export default async function (
  from: number,
  to: number,
  config: Config,
  _strategies: typeof Strategy[]
) {
  const db = new DB(path.resolve("./tracks"));
  const contracts = await getContracts();
  const worker = ExtractionWorker(config.worker);
  const strategies = _strategies.map((s) => new s(worker, config));

  for (let i = from; i <= to; i += config.step.block) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + config.step.block);
    console.log("Crawling from", fromBlock, "to", toBlock);

    for (
      let j = 0;
      j < Object.keys(contracts).length;
      j += config.step.contract
    ) {
      const contractsSlice = Object.keys(contracts).slice(
        j,
        j + config.step.contract
      );
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

      await Promise.all(
        logs.map(async (log) => {
          if (!log.blockNumber) {
            console.log(`log.blockNumber not found for ${msg}`);
            return;
          }
          if (!log.topics[3]) {
            console.log(`log.topics[3] should not be undefined`);
            return;
          }

          const nft: NFT = {
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

          const strategy = strategies.find(
            (s) => s.constructor.name === nft.platform.name
          );

          const track = await strategy?.crawl(nft);

          if (track !== null) {
            await db.insert(
              {
                chainId: CHAIN_ID,
                address: nft.erc721.address,
                tokenId: nft.erc721.token.id,
                blockNumber: nft.erc721.createdAt.toString(),
              },
              track
            );
          }

          console.log(
            "Found track:",
            track?.title,
            track?.platform.name,
            "at",
            track?.erc721.createdAt
          );
        })
      );
    }
  }

  await db.level.close();
  console.log("Exiting from crawl command");
  process.exit(0);
}
