import path from "path";
import { Level } from "level";
export class DB {
    constructor(dbPath) {
        this.level = new Level(path.resolve(dbPath, "./tracks"), {
            valueEncoding: "json",
        });
        this.changeIndex = new Level(path.resolve(dbPath, "./changes"), {
            valueEncoding: "json",
        });
    }
    datumToKey(datum) {
        // prettier-ignore
        return `${datum.chainId || ''}/${datum.address || ''}/${datum.tokenId || ''}/${datum.blockNumber || ''}`;
    }
    keyToDatum(id) {
        const [chainId, address, tokenId, blockNumber] = id.split("/");
        return { chainId, address, tokenId, blockNumber };
    }
    async *getMany(datum) {
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
                if (result.id.blockNumber <= tillBlockNumber)
                    yield result;
                result = { id, value };
            }
            else if (tillBlockNumber >= id.blockNumber) {
                result = { id, value };
            }
        }
        if (result.id.blockNumber <= tillBlockNumber)
            yield result;
    }
    async getOne(datum) {
        const { chainId, address, tokenId, blockNumber } = datum;
        if (chainId && address && tokenId && blockNumber) {
            const id = `${datum.chainId}/${datum.address}/${datum.tokenId}/${blockNumber}`;
            return { id: this.keyToDatum(id), value: await this.level.get(id) };
        }
        else if (chainId && address && tokenId) {
            for await (const [id, value] of this.level.iterator({
                lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/~`,
                reverse: true,
                limit: 1,
            })) {
                return { id: this.keyToDatum(id), value };
            }
        }
        throw new Error(`Insufficient parametrs provided to DB.getOne function ${JSON.stringify(datum)}`);
    }
    async getIdsChanged(from, to) {
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
    async getIdsChanged_fill(from, to) {
        const idsChanged = await this.getIdsChanged(from, to);
        return Promise.all(idsChanged.map(async (id) => {
            const value = await this.level.get(id);
            return {
                id: this.keyToDatum(id),
                value,
            };
        }));
    }
    async insert(datum, data) {
        await this.level.put(this.datumToKey(datum), data);
        await this.changeIndex.put(`${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`, "");
    }
    async del(datum) {
        await this.level.del(this.datumToKey(datum));
        await this.changeIndex.del(`${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`);
    }
    async createChangeIndex() {
        let count = 0;
        for await (const [_id, value] of this.level.iterator()) {
            const datum = this.keyToDatum(_id);
            await this.changeIndex.put(`${datum.blockNumber}/${datum.chainId}/${datum.address}/${datum.tokenId}`, "");
            count++;
        }
        console.log("Change index updated", count);
    }
    async flush() { }
}
export const db = new DB(path.resolve("./data"));
