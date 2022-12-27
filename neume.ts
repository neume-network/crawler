#!/usr/bin/env -S node --unhandled-rejections=throw

// Note: The -S flag for env is available for FreeBSD and coreutils >= 8.30
// It should work in macOS and newer linux versions
// https://www.gnu.org/software/coreutils/manual/html_node/env-invocation.html#g_t_002dS_002f_002d_002dsplit_002dstring-usage-in-scripts

import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";

import crawl from "./commands/crawl.js";
import dump from "./commands/dump.js";
import filterContracts from "./commands/filter_contracts.js";
import { getLatestBlockNumber, getStrategies } from "./utils.js";
import daemon from "./commands/daemon/index.js";
import sync from "./commands/sync.js";
import { db } from "./database/index.js";

const { config, strategies: strategyNames } = await import(
  path.resolve("./config.js")
);

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
        describe: "From block number",
      },
      recrawl: {
        type: "boolean",
        describe: "Re-crawl an NFT if they already exist",
        default: false,
      },
    },
    async (argv) => {
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
        demandOption: true,
      },
      crawl: {
        type: "boolean",
        describe: "Flag for crawler",
        default: true,
      },
      recrawl: {
        type: "boolean",
        describe: "Re-crawl an NFT if they already exist",
        default: false,
      },
    },
    async (argv) => {
      await daemon(argv.from, argv.crawl, argv.recrawl, config, strategyNames);
    }
  )
  .command(
    "sync",
    "Sync neume-network with another node",
    {
      url: {
        type: "string",
        describe: "An endpoint that is running neume-network daemon",
        demandOption: true,
      },
    },
    async (argv) => {
      const latestBlockNumber = await getLatestBlockNumber(config.rpc[0]);
      await sync(argv.url, latestBlockNumber, config);
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
  .help(true)
  .parse();
