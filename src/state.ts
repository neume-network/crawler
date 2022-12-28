/**
 * Utility functions to manage state
 */

import fs from "fs/promises";
import path from "path";
import { CONSTANTS } from "../types.js";

export async function getLastCrawledBlock() {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL);
  return fs.readFile(location, "utf-8").then(parseInt);
}

export async function saveLastCrawledBlock(blockNumber: number) {
  const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL);
  return fs.writeFile(location, blockNumber.toString(), "utf-8");
}
