import path from "path";
import { Level } from "level";
import { Track } from "@neume-network/schema";

export type Datum = {
  chainId: string;
  address: string;
  tokenId: string;
  blockNumber: string;
};

export type ReturnValue = {
  id: Datum;
  value: Track;
};

export class DB {
  level: Level<string, Track>;
  changeIndex: Level<string, string>;

  constructor(dbPath: string) {
    this.level = new Level<string, Track>(path.resolve(dbPath, "./tracks"), {
      valueEncoding: "json",
    });
    this.changeIndex = new Level(path.resolve(dbPath, "./changes"), {
      valueEncoding: "json",
    });
  }

  datumToKey(datum: Partial<Datum>) {
    // prettier-ignore
    return `${datum.chainId || ''}/${datum.address || ''}/${datum.tokenId || ''}/${datum.blockNumber || ''}`;
  }

  keyToDatum(id: string) {
    const [chainId, address, tokenId, blockNumber] = id.split("/");
    return { chainId, address, tokenId, blockNumber };
  }

  getMany(datum: {
    chainId: string;
    address: string;
    blockNumber?: string;
  }): AsyncGenerator<ReturnValue>;
  getMany(datum: {
    chainId: string;
    blockNumber?: string;
  }): AsyncGenerator<ReturnValue>;
  async *getMany(datum: Partial<Datum>): AsyncGenerator<ReturnValue> {
    const { chainId, address, tokenId, blockNumber } = datum;
    const tillBlockNumber = blockNumber || String(Number.MAX_SAFE_INTEGER);
    const filter = address
      ? {
          gte: `${chainId}/${address}/`,
          lte: `${chainId}/${address}/~`,
        }
      : {
          gte: `${chainId}/`,
          lte: `${chainId}/~`,
        };
    const iter = this.level.iterator(filter);
    const firstResult = await iter.next();

    if (!firstResult)
      throw new Error("Couldn't find any items for the given DB query");

    let lastId = this.keyToDatum(firstResult[0]);
    let result = { id: this.keyToDatum(firstResult[0]), value: firstResult[1] };

    for await (const [_id, value] of iter) {
      const id = this.keyToDatum(_id);
      const idPrefix = `${id.chainId}/${id.address}/${id.tokenId}`;
      const lastIdPrefix = `${lastId.chainId}/${lastId.address}/${lastId.tokenId}`;

      lastId = id;
      if (lastIdPrefix !== idPrefix) {
        if (result.id.blockNumber <= tillBlockNumber) yield result;
        result = { id, value };
      } else if (tillBlockNumber >= id.blockNumber) {
        result = { id, value };
      }
    }

    if (result.id.blockNumber <= tillBlockNumber) yield result;
  }

  async getOne(datum: Datum): Promise<ReturnValue>;
  async getOne(datum: Omit<Datum, "blockNumber">): Promise<ReturnValue>;
  async getOne(datum: Partial<Datum>): Promise<ReturnValue> {
    const { chainId, address, tokenId, blockNumber } = datum;

    if (chainId && address && tokenId && blockNumber) {
      for await (const [id, value] of this.level.iterator({
        gte: `${datum.chainId}/${datum.address}/${datum.tokenId}/`,
        lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/${blockNumber}`,
        reverse: true,
        limit: 1,
      })) {
        return { id: this.keyToDatum(id), value };
      }
      const error: any = new Error(
        `Level not found for ${JSON.stringify(datum)}`
      );
      error.code = "LEVEL_NOT_FOUND"; // We use this code because level also uses it
      throw error;
    } else if (chainId && address && tokenId) {
      for await (const [id, value] of this.level.iterator({
        gte: `${datum.chainId}/${datum.address}/${datum.tokenId}/`,
        lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/~`,
        reverse: true,
        limit: 1,
      })) {
        return { id: this.keyToDatum(id), value };
      }

      const error: any = new Error(
        `Level not found for ${JSON.stringify(datum)}`
      );
      error.code = "LEVEL_NOT_FOUND"; // We use this code because level also uses it
      throw error;
    }

    throw new Error(
      `Insufficient parametrs provided to DB.getOne function ${JSON.stringify(
        datum
      )}`
    );
  }

  async getIdsChanged(from: string, to?: string): Promise<string[]> {
    to = to ?? from;
    const ids = new Map();

    for await (const [_id, value] of this.changeIndex.iterator({
      gte: `${from}/`,
      lte: `${to}/~`,
    })) {
      const [blockNumber, chainId, address, tokenId] = _id.split("/");
      const id = `${chainId}/${address}/${tokenId}/${blockNumber}`;
      const nid = `${chainId}/${address}/${tokenId}`;
      ids.set(nid, id);
    }

    return Array.from(ids, ([nid, id]) => id);
  }

  async getIdsChanged_fill(from: string, to?: string): Promise<ReturnValue[]> {
    const idsChanged = await this.getIdsChanged(from, to);

    return Promise.all(
      idsChanged.map(async (id) => {
        const value = await this.level.get(id);

        return {
          id: this.keyToDatum(id),
          value,
        };
      })
    );
  }

  async insert(datum: Datum, data: any) {
    await this.level.put(this.datumToKey(datum), data);
    await this.changeIndex.put(
      `${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`,
      ""
    );
  }

  async del(datum: Datum) {
    await this.level.del(this.datumToKey(datum));
    await this.changeIndex.del(
      `${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`
    );
  }

  async createChangeIndex() {
    let count = 0;
    for await (const [_id, value] of this.level.iterator()) {
      const datum = this.keyToDatum(_id);
      await this.changeIndex.put(
        `${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`,
        ""
      );
      count++;
    }

    console.log("Change index updated", count);
  }

  async flush() {}
}

export const db = new DB(path.resolve("./data"));

process.on("exit", async () => {
  await Promise.all([db.level.close(), db.changeIndex.close()]);
});
