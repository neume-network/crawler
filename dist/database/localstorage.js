import path from "path";
import { Level } from "level";
export class LocalStorage {
    constructor(dbPath) {
        this.level = new Level(path.resolve(dbPath, "./localstorage"), {
            valueEncoding: "json",
        });
    }
    async insert(key, value, prefix) {
        prefix = prefix ?? "";
        return this.level.put(`${prefix}-${key}`, value);
    }
    async del(key, prefix) {
        return this.level.del(`${prefix}-${key}`);
    }
    async get(key, prefix) {
        prefix = prefix ?? "";
        return this.level.get(`${prefix}-${key}`);
    }
}
export const localStorage = new Level(path.resolve("./data", "./localstorage"), {
    valueEncoding: "json",
});
export async function getLocalStorage(sublevelName) {
    const sublevel = localStorage.sublevel(sublevelName, { valueEncoding: "json" });
    const all = await sublevel.iterator({}).all();
    return all;
}
export async function saveLocalStorage(sublevelName, entries) {
    const sublevel = localStorage.sublevel(sublevelName, { valueEncoding: "json" });
    const operations = entries.map((e) => {
        return {
            type: "put",
            key: e[0],
            value: e[1],
        };
    });
    await sublevel.batch(operations);
}
process.on("exit", async () => {
    await localStorage.close();
});
