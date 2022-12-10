import path from "path";
import { Level } from "level";
import { AbstractSublevel } from "abstract-level";

export type Datum = {
  chainId: string;
  address: string;
  tokenId: string;
  blockNumber: string;
};

export type ReturnValue = {
  id: Datum;
  value: Record<string, any>;
};

export class DB {
  level: Level<string, Record<string, any>>;

  constructor(indexPath: string) {
    this.level = new Level<string, any>(path.resolve(indexPath), {
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
      const id = `${datum.chainId}/${datum.address}/${datum.tokenId}/${blockNumber}`;
      return { id: this.keyToDatum(id), value: await this.level.get(id) };
    } else if (chainId && address && tokenId) {
      for await (const [id, value] of this.level.iterator({
        lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/~`,
        reverse: true,
        limit: 1,
      })) {
        return { id: this.keyToDatum(id), value };
      }
    }

    throw new Error(
      `Insufficient parametrs provided to DB.getOne function ${JSON.stringify(
        datum
      )}`
    );
  }

  async insert(datum: Datum, data: any) {
    return this.level.put(this.datumToKey(datum), data);
  }

  async del(datum: Datum) {
    return this.level.del(this.datumToKey(datum));
  }

  async flush() {}
}
