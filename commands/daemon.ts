import { fastify as Fastify } from "fastify";
import { JSONRPCServer, JSONRPCErrorException } from "json-rpc-2.0";

import { Config } from "../src/types.js";
import { getLatestBlockNumber, getStrategies, getUserContracts } from "../src/utils.js";
import crawl from "./crawl.js";
import filter_contracts from "./filter_contracts.js";
import { db } from "../database/index.js";
import { DaemonJsonrpcType } from "./daemon/daemon-jsonrpc-type.js";
import { daemonJsonrpcSchema } from "./daemon/daemon-jsonrpc-schema.js";
import { getLastCrawledBlock, saveLastCrawledBlock } from "../src/state.js";

const fastify = Fastify();

export default async function daemon(
  _from: number | undefined,
  crawlFlag: boolean,
  recrawl: boolean,
  port: number,
  config: Config,
  strategyNames: string[],
) {
  const RANGE_FOR_CRAWL = 5000;
  let from = _from ?? (await getLastCrawledBlock());
  let to = Math.min(from + RANGE_FOR_CRAWL, await getLatestBlockNumber(config.rpc[0]));
  const strategies = getStrategies(strategyNames, from, to);

  const task = async () => {
    const latestBlockNumber = await getLatestBlockNumber(config.rpc[0]);
    to = Math.min(from + RANGE_FOR_CRAWL, latestBlockNumber);

    console.log(`\n\n***** Starting a crawl cycle from ${from} to ${to} *****\n`);

    await filter_contracts(from, to, recrawl, config, strategies);
    await crawl(from, to, recrawl, config, strategies);

    await saveLastCrawledBlock(to);
    from = to;
    const nextTaskWaitTime = to === latestBlockNumber ? config.breatheTimeMS : 0;
    setTimeout(task, nextTaskWaitTime);
  };

  if (crawlFlag) task();
  await startServer(port);
}

async function startServer(port: number) {
  const server = new JSONRPCServer();

  server.addMethod("getIdsChanged_fill", async ([from, to]) => {
    if (to - from > 5000)
      return new JSONRPCErrorException("Block range should be less than 5000", -32600);
    const res = await db.getIdsChanged_fill(from, to);
    return res;
  });

  server.addMethod("getUserContracts", async () => {
    return getUserContracts();
  });

  fastify.route<{ Body: DaemonJsonrpcType }>({
    method: "POST",
    url: "/",
    schema: {
      body: daemonJsonrpcSchema,
    },
    handler: async (request, reply) => {
      const res = await server.receive(request.body);
      return res;
    },
  });

  return fastify.listen({ port, host: "::" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Daemon started at ${address}`);
  });
}
