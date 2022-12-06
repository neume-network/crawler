import path, { resolve } from "path";
import { Level } from "level";
import { AbstractSublevel } from "abstract-level";

export type Datum = {
  chainId: string;
  address: string;
  tokenId: string;
  blockNumber: string;
};

export type ReturnValue = {
  id: string;
  value: Record<string, any>;
};

export class DB {
  level: Level<string, Record<string, any>>;

  constructor(indexPath: string) {
    this.level = new Level<string, any>(path.resolve(indexPath), {
      valueEncoding: "json",
    });
  }

  datumToKey(datum: Datum) {
    return `${datum.chainId}/${datum.address}/${datum.tokenId}/${datum.blockNumber}`;
  }

  async get(datum: Partial<Datum>): Promise<ReturnValue[] | ReturnValue> {
    const { chainId, address, tokenId, blockNumber } = datum;
    if (chainId && address && tokenId && blockNumber) {
      const id = `${datum.chainId}/${datum.address}/${datum.tokenId}/${blockNumber}`;
      return { id, value: this.level.get(id) };
    } else if (chainId && address && tokenId) {
      for await (const [id, value] of this.level.iterator({
        lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/~`,
        reverse: true,
        limit: 1,
      })) {
        return { id, value };
      }
    } else if (chainId && address) {
      const results: Record<string, ReturnValue> = {};
      const tillBlockNumber = blockNumber || String(Number.MAX_SAFE_INTEGER);

      for await (const [id, value] of this.level.iterator({
        gte: `${datum.chainId}/${datum.address}/`,
        lte: `${datum.chainId}/${datum.address}/~`,
      })) {
        const idPrefix = id.substring(0, id.lastIndexOf("/"));

        if (idPrefix in results) {
          const prevBlockNumber = results[idPrefix].id.split("/")[3];
          const currBlockNumber = id.split("/")[3];
          if (
            prevBlockNumber < currBlockNumber &&
            currBlockNumber <= tillBlockNumber
          ) {
            results[idPrefix].value = value;
            results[idPrefix].id = id;
          }
        } else {
          results[idPrefix] = { id, value };
        }
      }

      return Object.keys(results).reduce(
        (finalArray: ReturnValue[], idPrefix: string) => {
          return [...finalArray, results[idPrefix]];
        },
        []
      );
    }

    throw new Error("Incomplete");
  }

  async insert(datum: Datum, data: any) {
    return this.level.put(this.datumToKey(datum), data);
  }

  async del(datum: Datum) {
    return this.level.del(this.datumToKey(datum));
  }

  async flush() {}
}
