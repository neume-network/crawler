import path from "path";
import fs from "fs/promises";
import { saveLastCrawledBlock } from "../src/state.js";
import { CONSTANTS } from "../src/types.js";

export default async function init() {
  await fs.copyFile(new URL("../assets/.env-copy", import.meta.url), path.resolve(".env"));
  await fs.copyFile(
    new URL("../assets/config.sample.js", import.meta.url),
    path.resolve("./config.js"),
  );
  // Will create file if it does not exist
  await fs.writeFile(path.resolve("./data/contracts.json"), "{}", {
    flag: "w",
  });
  // Create the last_crawled_block file in ./data
  await saveLastCrawledBlock(CONSTANTS.FIRST_BLOCK);
}
