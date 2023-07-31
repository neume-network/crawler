import path from "path";
import fs from "fs/promises";
import { saveLastCrawledBlock } from "../src/state.js";
import { CHAINS, CONSTANTS } from "../src/types.js";
import runMigration from "../database/runMigration.js";

export default async function init() {
  await fs.copyFile(new URL("../assets/.env-copy", import.meta.url), path.resolve(".env"));
  await fs.copyFile(
    new URL("../assets/config.sample.js", import.meta.url),
    path.resolve("./config.js"),
  );
  // Create the last_crawled_block file in ./data
  await saveLastCrawledBlock(CHAINS.eth, CONSTANTS.FIRST_BLOCK[CHAINS.eth]);
  await runMigration("up");
}
