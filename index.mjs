import { callBlockLogs } from "./logs.mjs";
import util from "util";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { callTokenUris } from "./call-tokenuri.mjs";
import { getTokenUris } from "./get-tokenuri.mjs";
import { musicOs } from "./music-os.mjs";

const FROM = "0xf1cd98";
const TO = "0xf1cd99";

const db = await open({
  filename: "./.db",
  driver: sqlite3.cached.Database,
});
db.getDatabaseInstance().parallelize();

await db.run(`CREATE TABLE IF NOT EXISTS pending_nfts (
  id TEXT PRIMARY KEY NOT NULL,
  data JSON NOT NULL
)`);

await db.run(`CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY NOT NULL,
  data JSON NOT NULL
)`);

const rows = await db.all(`SELECT * from pending_nfts`);
const oldNfts = rows.reduce((oldNfts, row) => {
  oldNfts[row.id] = JSON.parse(row.data);
  return oldNfts;
}, {});

const newNFTs = await callBlockLogs(FROM, TO);
let nfts = { ...oldNfts, ...newNFTs };
let ids = Object.keys(nfts);

await Promise.all(
  ids.map((id) => {
    return db.run(
      "INSERT OR REPLACE INTO pending_nfts (id, data) VALUES (?, ?)",
      id,
      JSON.stringify(nfts[id])
    );
  })
);

await callTokenUris(nfts);
await getTokenUris(nfts);
const tracks = musicOs(nfts);

await Promise.all(
  Object.keys(tracks).map((id) => {
    const track = tracks[id];

    return Promise.all([
      db.run("DELETE FROM pending_nfts WHERE id=?", id),
      db.run(
        "INSERT OR REPLACE INTO tracks (id, data) VALUES (?,?)",
        id,
        JSON.stringify(track)
      ),
    ]);
  })
);

console.log(await db.all(`SELECT * FROM pending_nfts`));
console.log(await db.all(`SELECT * FROM tracks`));
