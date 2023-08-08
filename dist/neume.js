#!/usr/bin/env node
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import { getLatestBlockNumber, getStrategies } from "./src/utils.js";
import daemon from "./commands/daemon.js";
import sync from "./commands/sync.js";
import init from "./commands/init.js";
import { db } from "./database/index.js";
import runMigration from "./database/runMigration.js";
import { tracksDB } from "./database/tracks.js";
const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <command> <options>")
    .env("NEUME")
    .command("runMigration", "Run migrations on the database", {
    type: {
        type: "string",
        describe: "Up or Down?",
        demandOption: true,
        choices: ["up", "down"],
    },
}, async (argv) => {
    await runMigration(argv.type);
})
    .command("dump", "Export database as JSON [Out of date]", {
    at: {
        type: "number",
        describe: "Export database as seen at the given block number",
        demandOption: true,
    },
}, async (argv) => {
    throw new Error("Not Implemented");
    const { config } = await import(path.resolve("./config.js"));
    const at = argv.at ?? (await getLatestBlockNumber(config.rpc[0]));
    // @ts-ignore
    return dump(at);
})
    .command("daemon", "Start neume-network daemon", {
    from: {
        type: "number",
        describe: "From block number",
        defaultDescription: "Last crawled block number",
    },
    crawl: {
        type: "boolean",
        describe: "Flag for crawler",
        default: true,
        defaultDescription: "true",
    },
    recrawl: {
        type: "boolean",
        describe: "Re-crawl an NFT if they already exist",
        default: false,
        defaultDescription: "false",
    },
    port: {
        type: "number",
        describe: "Port for the daemon",
        default: 8080,
        defaultDescription: "8080",
    },
}, async (argv) => {
    const { config, strategies: strategyNames } = await import(path.resolve("./config.js"));
    await daemon(argv.crawl, argv.recrawl, argv.port, config, strategyNames);
})
    .command("sync", "Sync neume-network with another node", {
    url: {
        type: "string",
        describe: "An endpoint that is running the neume-network daemon",
        demandOption: true,
    },
    since: {
        type: "number",
        describe: "`since` is a timestamp. Neume will fetch changes since the provided timestamp.",
        defaultDescription: "Uses the database to find the last synced timestamp",
    },
}, async (argv) => {
    const { config, strategies: strategyNames } = await import(path.resolve("./config.js"));
    await sync(argv.since, argv.url, config, getStrategies(strategyNames));
    await tracksDB.close();
})
    .command("create-change-index", "Create change index from primary database", async (argv) => {
    return db.createChangeIndex();
})
    .command("init", "Initialize files required by neume at the current working directory", async (argv) => {
    await init();
})
    .help(true)
    .parse();
