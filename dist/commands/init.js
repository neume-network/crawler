import path from "path";
import fs from "fs/promises";
import runMigration from "../database/runMigration.js";
export default async function init() {
    let fileExists;
    // .env
    fileExists = await fs
        .access(path.resolve(".env"), fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!fileExists)
        await fs.copyFile(new URL("../assets/.env-copy", import.meta.url), path.resolve(".env"));
    // config.js
    fileExists = await fs
        .access(path.resolve("./config.js"), fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    if (!fileExists)
        await fs.copyFile(new URL("../assets/config.sample.js", import.meta.url), path.resolve("./config.js"));
    await runMigration("up");
}
