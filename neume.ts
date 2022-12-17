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
    },
    async (argv) => {
      const from = argv.from;
      const to = argv.to ?? (await getLatestBlockNumber(config.rpc[0]));
      return crawl(from, to, config, getStrategies(strategyNames, from, to));
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
    },
    async (argv) => {
      const from = argv.from;
      const to = argv.to ?? (await getLatestBlockNumber(config.rpc[0]));
      return filterContracts(
        from,
        to,
        config,
        getStrategies(strategyNames, from, to)
      );
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
  .help(true)
  .parse();

/**
 * 
  .command("dump", "Export database as JSON", async (args) =>
    dump(parseInt(args.argv.at ?? (await getLatestBlockNumber(config.rpc[0]))))
  )
  .describe("from", "Start the crawl from this block number")
  .describe(
    "to",
    "Last block number to be crawled. (Default: latest block number)"
  )
 */
