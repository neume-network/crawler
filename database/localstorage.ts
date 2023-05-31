import path from "path";
import { Level } from "level";

export class LocalStorage {
  level: Level<string, any>;

  constructor(dbPath: string) {
    this.level = new Level<string, any>(path.resolve(dbPath, "./localstorage"), {
      valueEncoding: "json",
    });
  }

  async insert(key: string, value: any, prefix?: string) {
    prefix = prefix ?? "";
    return this.level.put(`${prefix}-${key}`, value);
  }

  async del(key: string, prefix?: string) {
    return this.level.del(`${prefix}-${key}`);
  }

  async get(key: string, prefix?: string) {
    prefix = prefix ?? "";
    return this.level.get(`${prefix}-${key}`);
  }
}

export const localStorage = new Level<string, any>(path.resolve("./data", "./localstorage"), {
  valueEncoding: "json",
});

export async function getLocalStorage(sublevelName: string) {
  const sublevel = localStorage.sublevel<string, any>(sublevelName, { valueEncoding: "json" });
  const all = await sublevel.iterator({}).all();
  return all;
}

export async function saveLocalStorage(sublevelName: string, entries: Array<[string, any]>) {
  const sublevel = localStorage.sublevel<string, any>(sublevelName, { valueEncoding: "json" });
  const operations = entries.map((e) => {
    return {
      type: "put" as "put",
      key: e[0],
      value: e[1],
    };
  });
  await sublevel.batch(operations);
}

process.on("exit", async () => {
  await localStorage.close();
});
