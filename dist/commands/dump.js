import fs from "fs";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import git from "isomorphic-git";
import { DB } from "../database/index.js";
const FILE_LIMIT = 100;
const DIR = fileURLToPath(new URL("../dump", import.meta.url));
export default async function dump(at) {
    const db = new DB("../tracks");
    if (!fs.existsSync(DIR)) {
        fs.mkdirSync(DIR, { recursive: true });
        git.init({ fs, dir: DIR });
    }
    let i = 0;
    let tracks = [];
    for await (const { id, value } of db.getMany({
        chainId: "1",
        blockNumber: at.toString(),
    })) {
        tracks.push(value);
        if (tracks.length >= FILE_LIMIT) {
            await flush(`${DIR}/${i}.json`, tracks);
            console.log(`Wrote ${tracks.length} tracks`);
            i++;
            tracks = [];
        }
    }
    await git.add({ fs, dir: DIR, filepath: "." });
    const files = await git.listFiles({ fs, dir: DIR });
    if (files) {
        console.log("Following files are available to be commit", files);
        await git.commit({
            fs,
            dir: DIR,
            message: `Update at block number: ${at}`,
            author: { name: "neume-network", email: "info@neume.network" },
        });
    }
    else {
        console.log("No files availble to commit");
    }
    console.log("Exiting from dump command");
}
async function flush(filename, tracks) {
    await writeFile(filename, JSON.stringify(tracks, null, 2));
}
