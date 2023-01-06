/**
 * Utility functions to manage state
 */
import fs from "fs/promises";
import path from "path";
import { CONSTANTS } from "./types.js";
export async function getLastCrawledBlock() {
    const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL);
    const fileExists = await fs
        .access(location, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!fileExists)
        await saveLastCrawledBlock(CONSTANTS.FIRST_BLOCK);
    return fs.readFile(location, "utf-8").then(parseInt);
}
export async function saveLastCrawledBlock(blockNumber) {
    const location = path.resolve(CONSTANTS.DATA_DIR, CONSTANTS.STATE.LAST_CRAWL);
    return fs.writeFile(location, blockNumber.toString(), "utf-8");
}
