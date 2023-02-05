import fs from "fs";
import { writeFile, mkdir } from "fs/promises";
import { canonicalize } from "json-canonicalize";
import path from "path";
import { db } from "../database/index.js";
const DIR = path.resolve("./dump");
export default async function dump(at) {
    if (!fs.existsSync(DIR)) {
        fs.mkdirSync(DIR, { recursive: true });
    }
    let count = 0;
    try {
        for await (const { id, value } of db.getMany({
            chainId: "1",
            blockNumber: at,
        })) {
            const track = canonicalize(value);
            const outputPath = path.resolve(DIR, `${id.chainId}/${id.address}/${id.tokenId}`);
            await mkdir(outputPath, { recursive: true });
            const outputFile = path.resolve(outputPath, `entry.json`);
            await writeFile(outputFile, track);
            count++;
        }
    }
    catch (err) {
        // TOOD: Find a way to not depend on error message
        if (err.message === "Couldn't find any items for the given DB query") {
            console.log("Nothing to dump. Exiting from dump command.");
            process.exit(0);
        }
        throw err;
    }
    console.log(`Exiting from dump command; Wrote ${count} tracks.`);
    process.exit(0);
}
async function flush(filename, tracks) {
    await writeFile(filename, JSON.stringify(tracks, null, 2));
}
