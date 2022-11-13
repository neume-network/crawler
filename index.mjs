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
import { DB } from "./database/index.js";

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
const pendingDb = new DB("./database/pending_tracks");
const db = new DB("./database/tracks");

// The program can crash in between or some NFTs
// can fail to be crawled. For them, I mantain a
// pending_nfts table.
// The newly found NFTs and old pending NFTs are
// later merged to form a single NFTs object.
const oldNfts = {};
for await (const [id, value] of pendingDb.level.iterator()) {
  oldNfts[id] = value;
}

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
    return pendingDb.insert(
      {
        chainId: 1,
        address: nft.erc721.address,
        tokenId: nft.erc721.tokens[0].id,
        blockNumber: nft.erc721.createdAt,
      },
      data
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
      pendingDb.level.clear(),
      db.insert(
        {
          chainId: 1,
          blockNumber: track.erc721.createdAt,
          address: track.erc721.address,
          tokenId: track.erc721.tokenId,
        },
        data
      ),
    ]);
  })
);

for await (const [id, value] of db.level.iterator()) {
  console.log(id, value);
}

// console.log(util.inspect(nfts, false, null, true));
// process.exit();
