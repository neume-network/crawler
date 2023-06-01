/**
 * Utility functions to manage state
 */

import fs from "fs/promises";
import path from "path";
import { CHAINS, CONSTANTS } from "./types.js";

export async function getLastCrawledBlock(chain: CHAINS) {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL, chain);
  const fileExists = await fs
    .access(location, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) await saveLastCrawledBlock(chain, CONSTANTS.FIRST_BLOCK[chain]);
  return fs.readFile(location, "utf-8").then(parseInt);
}

export async function saveLastCrawledBlock(chain: CHAINS, blockNumber: number) {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL, chain);
  const fileExists = await fs
    .access(path.dirname(location), fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!fileExists) await fs.mkdir(path.dirname(location), { recursive: true });
  return fs.writeFile(location, blockNumber.toString(), "utf-8");
}
