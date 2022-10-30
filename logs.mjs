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
          tokens: [
            {
              minting: {
                transactionHash: log.transactionHash,
              },
              id: BigInt(log.topics[3]).toString(10),
            },
          ],
        },
      };
    })
    .reduce((nfts, nft) => {
      return {
        ...nfts,
        [`${nft.erc721.address}/${nft.erc721.tokens[0].id}`]: nft,
      };
    }, {});
}

export async function callBlockLogs(from, to) {
  from = parseInt(from, "16");
  to = parseInt(to, "16");

  let messages = [];
  for (let i = from; i < to; i++) {
    const block = toHex(i);
    messages.push(
      route({
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
      })
    );
  }

  messages = await Promise.all(messages);
  const logs = messages.map(({ results }) => results).flat();
  return filterLogs(logs);
}
