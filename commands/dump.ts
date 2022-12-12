import { Track } from "@neume-network/schema";
import fs from "fs";
import { writeFile, mkdir } from "fs/promises";
import { canonicalize } from "json-canonicalize";
import crypto from "crypto";
import path from "path";

import { DB } from "../database/index.js";

const DIR = path.resolve("./dump");

export default async function dump(at: number) {
  const db = new DB(path.resolve("./tracks"));

  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
  }

  try {
    for await (const { id, value } of db.getMany({
      chainId: "1",
      blockNumber: at.toString(),
    })) {
      const track = canonicalize(value);
      const hash = crypto
        .createHash("sha256")
        .update(track)
        .digest("hex")
        .match(/.{1,2}/g)
        ?.join("/");
      if (!hash) throw new Error("Couldn't hash JSON value");
      await mkdir(path.resolve(DIR, hash), { recursive: true });
      const normalId = db.datumToKey(id).replace(/\//g, ".");
      const outputPath = path.resolve(DIR, hash, `${normalId}.json`);
      await writeFile(outputPath, track);
      console.log("Wrote track at", outputPath);
    }
  } catch (err: any) {
    // TOOD: Find a way to not depend on error message
    if (err.message === "Couldn't find any items for the given DB query") {
      console.log("Nothing to dump. Exiting from dump command.");
      process.exit(0);
    }
    throw err;
  }

  console.log("Exiting from dump command");
  process.exit(0);
}

async function flush(filename: string, tracks: Track[]) {
  await writeFile(filename, JSON.stringify(tracks, null, 2));
}
