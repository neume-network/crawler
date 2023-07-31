/**
 * Utility functions to manage state
 */

import fs from "fs/promises";
import path from "path";
import { CONSTANTS } from "./types.js";
import { getStrategies } from "./utils.js";

export async function getLastCrawledBlock(strategy: string) {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL, strategy);
  const { createdAtBlock } = getStrategies([strategy])[0];
  const fileExists = await fs
    .access(location, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) await saveLastCrawledBlock(strategy, createdAtBlock);
  return fs.readFile(location, "utf-8").then(parseInt);
}

export async function saveLastCrawledBlock(strategy: string, blockNumber: number) {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL, strategy);
  const fileExists = await fs
    .access(path.dirname(location), fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) await fs.mkdir(path.dirname(location), { recursive: true });
  return fs.writeFile(location, blockNumber.toString(), "utf-8");
}
