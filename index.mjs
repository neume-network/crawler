import { callBlockLogs } from "./logs.mjs";
import util from "util";
import { env } from "process";
import {
  endpointStore,
  populateEndpointStore,
} from "./extraction-worker/src/endpoint_store.mjs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { callTokenUri } from "./call-tokenuri.mjs";
import { getTokenUri } from "./get-tokenuri.mjs";
import { musicOs } from "./music-os.mjs";

// For demo purposes
const FROM = "0xf1cd98";
const TO = "0xf1cd99";

// This is used by extraction-worker for rate limiting
populateEndpointStore(endpointStore, {
  [env.RPC_HTTP_HOST]: {
    timeout: 10_000,
    requestsPerUnit: 500,
    unit: "second",
  },
  [env.ARWEAVE_HTTPS_GATEWAY]: {
    timeout: 30_000,
    requestsPerUnit: 500,
    unit: "second",
  },
});

// Initialize database
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

// The program can crash in between or some NFTs
// can fail to be crawled. For them, I mantain a
// pending_nfts table.
// The newly found NFTs and old pending NFTs are
// later merged to form a single NFTs object.
const rows = await db.all(`SELECT * from pending_nfts`);
const oldNfts = rows.reduce((oldNfts, row) => {
  oldNfts[row.id] = JSON.parse(row.data);
  return oldNfts;
}, {});

const newNFTs = await callBlockLogs(FROM, TO);
const mergeNFTs = { ...oldNfts, ...newNFTs };

// This is the list of all NFTs to be crawled.
// With each step additional information gets
// added to each NFT. For example, in the first
// tokenURI gets added.
let nfts = Object.keys(mergeNFTs).map((id) => {
  return {
    id,
    ...mergeNFTs[id],
  };
});

await Promise.all(
  nfts.map((nft) => {
    const data = { ...nft };
    delete data.id;
    return db.run(
      "INSERT OR REPLACE INTO pending_nfts (id, data) VALUES (?, ?)",
      nft.id,
      JSON.stringify(data)
    );
  })
);

nfts = (
  await Promise.all(
    nfts.map(async (nft) => {
      try {
        return await callTokenUri(nft);
      } catch (err) {
        console.log(`Error occured in call-tokenuri with id=${nft.id}`, err);
      }
    })
  )
).filter(Boolean);

nfts = (
  await Promise.all(
    nfts.map(async (nft) => {
      try {
        return await getTokenUri(nft);
      } catch (err) {
        console.log(`Error occured in get-tokenuri with id=${nft.id}`, err);
      }
    })
  )
).filter(Boolean);

const tracks = nfts
  .map((nft) => {
    try {
      return musicOs(nft);
    } catch (err) {
      console.log(`Error occured in  with id=${nft.id}`, err);
    }
  })
  .filter(Boolean);

await Promise.all(
  tracks.map((track) => {
    const data = { ...track };
    delete data.id;

    return Promise.all([
      db.run("DELETE FROM pending_nfts WHERE id=?", track.id),
      db.run(
        "INSERT OR REPLACE INTO tracks (id, data) VALUES (?,?)",
        track.id,
        JSON.stringify(data)
      ),
    ]);
  })
);

console.log(await db.all(`SELECT * FROM pending_nfts`));
console.log(await db.all(`SELECT * FROM tracks`));

// console.log(util.inspect(nfts, false, null, true));
// process.exit();
