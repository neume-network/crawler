#!/usr/bin/env node

import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";

import crawl from "./commands/crawl.js";
import dump from "./commands/dump.js";
import filterContracts from "./commands/filter_contracts.js";
import { getLatestBlockNumber, getStrategies } from "./src/utils.js";
import daemon from "./commands/daemon.js";
import sync from "./commands/sync.js";
import init from "./commands/init.js";
import { db } from "./database/index.js";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> <options>")
  .command(
    "crawl",
    "Find new NFTs from the list of already known contracts",
    {
      from: {
        type: "number",
        describe: "From block number",
        demandOption: true,
      },
      to: {
        type: "number",
        describe: "To block number",
      },
      recrawl: {
        type: "boolean",
        describe: "Re-crawl an NFT if they already exist",
        default: false,
      },
    },
    async (argv) => {
      const { config, strategies: strategyNames } = await import(
        path.resolve("./config.js")
      );
      const from = argv.from;
      const to = argv.to ?? (await getLatestBlockNumber(config.rpc[0]));
      await crawl(
        from,
        to,
        argv.recrawl,
        config,
        getStrategies(strategyNames, from, to)
      );
      process.exit(0);
    }
  )
  .command(
    "filter-contracts",
    "Find new contracts",
    {
      from: {
        type: "number",
        describe: "From block number",
        demandOption: true,
      },
      to: {
        type: "number",
        describe: "From block number",
      },
      recrawl: {
        type: "boolean",
        describe: "Re-crawl an NFT if they already exist",
        default: false,
      },
    },
    async (argv) => {
      const { config, strategies: strategyNames } = await import(
        path.resolve("./config.js")
      );
      const from = argv.from;
      const to = argv.to ?? (await getLatestBlockNumber(config.rpc[0]));
      await filterContracts(
        from,
        to,
        argv.recrawl,
        config,
        getStrategies(strategyNames, from, to)
      );
      process.exit(0);
    }
  )
  .command(
    "dump",
    "Export database as JSON",
    {
      at: {
        type: "number",
        describe: "Export database as seen at the given block number",
        demandOption: true,
      },
    },
    async (argv) => {
      const { config } = await import(path.resolve("./config.js"));
      const at = argv.at ?? (await getLatestBlockNumber(config.rpc[0]));
      return dump(at);
    }
  )
  .command(
    "daemon",
    "Start neume-network daemon",
    {
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
    },
    async (argv) => {
      const { config, strategies: strategyNames } = await import(
        path.resolve("./config.js")
      );
      await daemon(
        argv.from,
        argv.crawl,
        argv.recrawl,
        argv.port,
        config,
        strategyNames
      );
    }
  )
  .command(
    "sync",
    "Sync neume-network with another node",
    {
      url: {
        type: "string",
        describe: "An endpoint that is running the neume-network daemon",
        demandOption: true,
      },
      from: {
        type: "number",
        describe: "From block number",
        defaultDescription:
          "Uses the database to calculate the last synced block",
      },
      to: {
        type: "number",
        describe: "To block number",
        defaultDescription: "Syncs to the latest block number",
      },
    },
    async (argv) => {
      const { config, strategies: strategyNames } = await import(
        path.resolve("./config.js")
      );
      const to = argv.to ?? (await getLatestBlockNumber(config.rpc[0]));
      await sync(argv.from, to, argv.url, config);
      process.exit(0);
    }
  )
  .command(
    "create-change-index",
    "Create change index from primary database",
    async (argv) => {
      return db.createChangeIndex();
    }
  )
  .command(
    "init",
    "Initialize files required by neume at the current working directory",
    async (argv) => {
      await init();
    }
  )
  .help(true)
  .parse();
