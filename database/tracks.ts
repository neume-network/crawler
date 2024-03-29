import { resolve } from "path";
import knex from "knex";
import type { Knex } from "knex";
import { Owner, Token, Track } from "@neume-network/schema";
import { Level } from "level";

import config from "./knexfile.js";

type LogValue = {
  operation: string;
  inputs: Array<any>;
};

/**
 * SQL database to store and retrieve tracks.
 */
export class Tracks {
  public db: Knex;

  // Used to log all operations. It can be used to regenerate the DB at a particular block number.
  public log: Level<string, LogValue>;

  constructor() {
    this.db = knex.default(config);

    this.log = new Level(resolve("./data/log"), {
      valueEncoding: "json",
    });
  }

  isTrackPresent = async (uid: string): Promise<Boolean> => {
    const rows = await this.db("tracks").select().where("uid", "=", uid);
    return Boolean(rows.length);
  };

  upsertTrack = async (track: Track, blockNumber: number) => {
    this.db.transaction(async (trx) => {
      await trx("tracks")
        .insert({
          version: track.version,
          title: track.title,
          duration: track.duration,
          artist_version: track.artist.version,
          artist_name: track.artist.name,
          artist_address: track.artist.address,
          platform_name: track.platform.name,
          platform_version: track.platform.version,
          platform_uri: track.platform.uri,
          erc721_version: track.erc721.version,
          erc721_address: track.erc721.address,
          erc721_metadata: track.erc721.metadata,
          erc721_uri: track.erc721.uri,
          uid: track.uid,
          lastUpdatedAt: blockNumber,
        })
        .onConflict(["uid"])
        .merge();

      await Promise.all(
        track.manifestations.map((m) =>
          trx("manifestations")
            .insert({
              version: m.version,
              uri: m.uri,
              mimetype: m.mimetype,
              uid: track.uid,
            })
            .onConflict(["uid", "uri"])
            .merge(),
        ),
      );

      await Promise.all(
        track.erc721.tokens.map(async (token) => {
          const { owners } = token;
          await trx("tokens")
            .insert({
              id: token.id,
              uri: token.uri,
              metadata: token.metadata,
              uid: track.uid,
            })
            .onConflict(["uid", "id"])
            .merge();

          await Promise.all(
            owners.map((o) =>
              trx("owners")
                .insert({
                  blockNumber: o.blockNumber,
                  from: o.from,
                  to: o.to,
                  transactionHash: o.transactionHash,
                  alias: o.alias,
                  uid: track.uid,
                  id: token.id,
                })
                .onConflict(["uid", "id", "transactionHash", "to"])
                .merge(),
            ),
          );
        }),
      );

      const inputs = [track, blockNumber];

      await this.log.put(
        `${track.platform.name}/${this.encodeNumber(blockNumber)}/${hashCode(
          JSON.stringify(inputs),
        )}`,
        {
          operation: "newTrack",
          inputs,
        },
      );
    });
  };

  upsertOwner = async (
    uid: string,
    tokenId: string,
    owner: Owner,
    platform: string,
    blockNumber: number,
  ) => {
    const inputs = [uid, tokenId, owner, blockNumber];
    await this.db("tracks").update({ lastUpdatedAt: blockNumber }).where("uid", "=", uid);

    await this.db("owners")
      .insert({
        from: owner.from,
        to: owner.to,
        blockNumber: owner.blockNumber,
        transactionHash: owner.transactionHash,
        alias: owner.alias,
        id: tokenId,
        uid,
      })
      .onConflict(["uid", "id", "transactionHash", "to"])
      .merge();

    await this.log.put(
      `${platform}/${this.encodeNumber(blockNumber)}/${hashCode(JSON.stringify(inputs))}`,
      {
        operation: "upsertOwner",
        inputs,
      },
    );
  };

  getTrack = async (uid: string): Promise<Track> => {
    const tokensRaw = await this.db("tokens")
      .select("*")
      .leftJoin("owners", function () {
        this.on("tokens.uid", "=", "owners.uid");
        this.on("tokens.id", "=", "owners.id");
      })
      .where("tokens.uid", "=", uid);

    const tokens: Token[] = Object.values(
      tokensRaw.reduce((tokens: { [k: string]: Token }, row) => {
        if (tokens[row.id])
          tokens[row.id].owners.push({
            from: row.from,
            to: row.to,
            blockNumber: row.blockNumber,
            transactionHash: row.transactionHash,
            alias: row.alias,
          });
        else
          tokens[row.id] = {
            id: row.id,
            uri: row.uri,
            metadata: row.metadata && JSON.parse(row.metadata),
            owners: [
              {
                from: row.from,
                to: row.to,
                blockNumber: row.blockNumber,
                transactionHash: row.transactionHash,
                alias: row.alias,
              },
            ],
          };

        return tokens;
      }, {}),
    );

    const manifestations = await this.db("manifestations")
      .select("*")
      .where("manifestations.uid", "=", uid);

    const tracksRaw = await this.db("tracks").select("*").where("tracks.uid", "=", uid).limit(1);
    const r = tracksRaw[0];

    return {
      version: r.version,
      title: r.title,
      uid: r.uid,
      duration: r.duration,
      artist: {
        version: r.artist_version,
        name: r.artist_name,
        address: r.artist_address,
      },
      platform: {
        version: r.platform_version,
        name: r.platform_name,
        uri: r.platform_uri,
      },
      erc721: {
        version: r.erc721_version,
        tokens: tokens,
        uri: r.erc721_uri,
        address: r.erc721_address,
        metadata: r.erc721_metadata && JSON.parse(r.erc721_metadata),
      },
      manifestations: manifestations.map((m) => ({
        version: m.version,
        uri: m.uri,
        mimetype: m.mimetype,
      })),
    };
  };

  getTracksChanged = async (from: number, to: number, platform: string): Promise<Track[]> => {
    const uids = await this.db("tracks")
      .select("uid")
      .where("lastUpdatedAt", ">=", from)
      .andWhere("lastUpdatedAt", "<=", to)
      .andWhere("platform_name", "=", platform);

    console.log(uids);

    const tracks = await Promise.all(
      uids.map(async ({ uid }) => {
        return await this.getTrack(uid);
      }),
    );

    return tracks;
  };

  // LevelDB stores keys in lexicographical order. Therefore,
  // 1 < 10 < 9. This is unlike natural order where 1 < 9 < 10.
  //
  // The solution is to pad numbers with zero such that lexicographical
  // order is the same as natural order. For example, if we pad
  // numbers upto two digits they will become 01 < 09 < 10.
  //
  // The above solution will only work for postive numbers and
  // will break for numbers greater than maximum digits. In the
  // above example, the solution will break for numbers greater than 100.
  encodeNumber(num: Number) {
    const MAX_LENGTH = 10; // TODO: increase this number for polygon
    if (num.toString().length > MAX_LENGTH)
      throw new Error(`Database cannot encode number greater than 10 digits`);
    return num.toString().padStart(MAX_LENGTH, "0");
  }

  decodeNumber(num: string) {
    return Number(num).toString();
  }
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export const tracksDB = new Tracks();
// console.dir(await tracksDB.getTrack("polygon/106643/194"), { depth: null });
