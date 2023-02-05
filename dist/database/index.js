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
        const blockNumber = datum.blockNumber ? this.encodeNumber(datum.blockNumber) : '';
        return `${datum.chainId || ""}/${datum.address || ""}/${datum.tokenId || ""}/${blockNumber}`;
    }
    keyToDatum(id) {
        const [chainId, address, tokenId, blockNumber] = id.split("/");
        return { chainId, address, tokenId, blockNumber: Number(blockNumber) };
    }
    datumToChangeKey(datum) {
        return `${this.encodeNumber(datum.blockNumber)}/${datum.chainId}/${datum.address}/${datum.tokenId}`;
    }
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
    encodeNumber(num) {
        const MAX_LENGTH = 10;
        if (num.toString().length > MAX_LENGTH)
            throw new Error(`Database cannot encode number greater than 10 digits`);
        return num.toString().padStart(MAX_LENGTH, "0");
    }
    decodeNumber(num) {
        return Number(num).toString();
    }
    async *getMany(datum) {
        const { chainId, address, tokenId, blockNumber } = datum;
        const tillBlockNumber = blockNumber || Number.MAX_SAFE_INTEGER;
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
            for await (const [id, value] of this.level.iterator({
                gte: `${datum.chainId}/${datum.address}/${datum.tokenId}/`,
                lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/${this.encodeNumber(blockNumber)}`,
                reverse: true,
                limit: 1,
            })) {
                return { id: this.keyToDatum(id), value };
            }
            const error = new Error(`Level not found for ${JSON.stringify(datum)}`);
            error.code = "LEVEL_NOT_FOUND"; // We use this code because level also uses it
            throw error;
        }
        else if (chainId && address && tokenId) {
            for await (const [id, value] of this.level.iterator({
                gte: `${datum.chainId}/${datum.address}/${datum.tokenId}/`,
                lte: `${datum.chainId}/${datum.address}/${datum.tokenId}/~`,
                reverse: true,
                limit: 1,
            })) {
                return { id: this.keyToDatum(id), value };
            }
            const error = new Error(`Level not found for ${JSON.stringify(datum)}`);
            error.code = "LEVEL_NOT_FOUND"; // We use this code because level also uses it
            throw error;
        }
        throw new Error(`Insufficient parametrs provided to DB.getOne function ${JSON.stringify(datum)}`);
    }
    async getIdsChanged(from, to) {
        to = to ?? from;
        const ids = new Map();
        for await (const [_id, value] of this.changeIndex.iterator({
            gte: `${this.encodeNumber(from)}/`,
            lte: `${this.encodeNumber(to)}/~`,
        })) {
            const [blockNumber, chainId, address, tokenId] = _id.split("/");
            const id = { chainId, address, tokenId, blockNumber: Number(blockNumber) };
            const nid = `${chainId}/${address}/${tokenId}`;
            ids.set(nid, id);
        }
        return Array.from(ids, ([nid, id]) => id);
    }
    async getIdsChanged_fill(from, to) {
        const idsChanged = await this.getIdsChanged(from, to);
        return Promise.all(idsChanged.map(async (id) => {
            const returnValue = await this.getOne(id);
            return {
                id: returnValue.id,
                value: returnValue.value,
            };
        }));
    }
    async insert(datum, data) {
        await this.level.put(this.datumToKey(datum), data);
        await this.changeIndex.put(this.datumToChangeKey(datum), "");
    }
    async del(datum) {
        await this.level.del(this.datumToKey(datum));
        await this.changeIndex.del(this.datumToChangeKey(datum));
    }
    async createChangeIndex() {
        let count = 0;
        for await (const [_id, value] of this.level.iterator()) {
            const datum = this.keyToDatum(_id);
            await this.changeIndex.put(this.datumToChangeKey(datum), "");
            count++;
        }
        console.log("Change index updated", count);
    }
    async flush() { }
}
export const db = new DB(path.resolve("./data"));
process.on("exit", async () => {
    await Promise.all([db.level.close(), db.changeIndex.close()]);
});
