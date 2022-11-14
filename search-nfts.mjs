import pMap from "p-map";
import { env } from "process";
import { messages } from "./extraction-worker/src/api.mjs";
import { contracts } from "./contracts.mjs";
import { toHex } from "eth-fun";

const { route } = messages;

const transferEventSelector =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const emptyB32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const options = {
  url: env.RPC_HTTP_HOST,
};

if (env.RPC_API_KEY) {
  options.headers = {
    Authorization: `Bearer ${env.RPC_API_KEY}`,
  };
}

function filterLogs(logs) {
  return logs
    .filter((log) => {
      return (
        log.topics[0] === transferEventSelector &&
        log.topics[1] === emptyB32 &&
        Object.keys(contracts).includes(log.address)
      );
    })
    .map((log) => {
      return {
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
    })
    .reduce((nfts, nft) => {
      return {
        ...nfts,
        [`1/${nft.erc721.address}/${nft.erc721.token.id}/${nft.erc721.createdAt}`]:
          nft,
      };
    }, {});
}

export async function searchNfts(from, to, cb) {
  from = parseInt(from, "16");
  to = parseInt(to, "16");

  const blocks = [];
  for (let i = from; i < to; i++) {
    blocks.push(i);
  }

  await pMap(
    blocks,
    async (i) => {
      const block = toHex(i);
      const message = await route({
        type: "json-rpc",
        method: "eth_getLogs",
        params: [
          {
            fromBlock: block,
            toBlock: block,
          },
        ],
        version: "0.0.1",
        options,
      });
      const log = message.results;
      if (
        log.topics[0] === transferEventSelector &&
        log.topics[1] === emptyB32 &&
        Object.keys(contracts).includes(log.address)
      ) {
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
        cb(nft);
      }
    },
    { concurrency: parseInt(env.EXTRACTION_WORKER_CONCURRENCY) }
  );
}
