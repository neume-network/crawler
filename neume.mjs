#!/usr/bin/env -S node --unhandled-rejections=throw

// Note: The -S flag for env is available for FreeBSD and coreutils >= 8.30
// It should work in macOS and newer linux versions
// https://www.gnu.org/software/coreutils/manual/html_node/env-invocation.html#g_t_002dS_002f_002d_002dsplit_002dstring-usage-in-scripts

import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import crawl from "./commands/crawl.mjs";

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> --from [num]")
  .usage("Usage: $0 <command> --from [num] --to [num]")
  .command("crawl", "Find new NFTs", crawl)
  .describe("from", "Start the crawl from this block number")
  .describe(
    "to",
    "Last block number to be crawled. (Default: latest block number)"
  )
  .demandOption("from").argv;
