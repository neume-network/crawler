import { fastify as Fastify } from "fastify";
import { JSONRPCServer } from "json-rpc-2.0";
import { getLatestBlockNumber, getStrategies } from "../src/utils.js";
import { daemonJsonrpcSchema } from "./daemon/daemon-jsonrpc-schema.js";
import { getLastCrawledBlock, saveLastCrawledBlock } from "../src/state.js";
import { tracksDB } from "../database/tracks.js";
import { getLocalStorage } from "../database/localstorage.js";
import ExtractionWorker from "@neume-network/extraction-worker";
const fastify = Fastify();
export default async function daemon(crawlFlag, recrawl, port, config, strategyNames) {
    const worker = ExtractionWorker(config.worker);
    const allStrategies = getStrategies(strategyNames).map((s) => new s(worker, config));
    const task = async (strategy) => {
        const { crawlStep } = config.chain[strategy.chain];
        const latestBlockNumber = await getLatestBlockNumber(config.chain[strategy.chain].rpc[0]);
        const from = await getLastCrawledBlock(strategy.constructor.name);
        const to = Math.min(from + crawlStep, latestBlockNumber);
        if (from >= (strategy.deprecatedAtBlock ?? Number.MAX_VALUE)) {
            console.log(`Removing ${strategy.constructor.name} from queue because we have reached deprecatedAtBlock (${strategy.deprecatedAtBlock})`);
            return;
        }
        console.log("Calling strategy", strategy.constructor.name, "from", from, "to", to);
        await strategy.crawl(from, to, recrawl);
        await saveLastCrawledBlock(strategy.constructor.name, to);
        const nextTaskWaitTime = to === latestBlockNumber ? config.breatheTimeMS ?? 1 : 1;
        setTimeout(task.bind({}, strategy), nextTaskWaitTime);
    };
    if (crawlFlag) {
        allStrategies.forEach((s) => {
            task(s);
        });
    }
    await startServer(port);
}
async function startServer(port) {
    const server = new JSONRPCServer();
    server.addMethod("getTracks", async ({ since, platform }) => {
        // if (to - from > 5000)
        //   return new JSONRPCErrorException("Block range should be less than 5000", -32600);
        const res = await tracksDB.getTracksChanged(since, platform);
        return res;
    });
    server.addMethod("getLocalStorage", async ({ platform }) => {
        return getLocalStorage(platform);
    });
    fastify.route({
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
