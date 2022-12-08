import test from "ava";
import { fileURLToPath } from "url";
import { DB } from "./index.js";

const db = new DB(fileURLToPath(new URL("./db", import.meta.url)));
const chainId = "1";

test.serial("should be able insert values", async (t) => {
  await t.notThrowsAsync(async () =>
    db.insert(
      { chainId, address: "0x13", tokenId: "5", blockNumber: "95" },
      { test: "data" }
    )
  );
});

test.serial("should be able to delete values by id", async (t) => {
  await t.notThrowsAsync(async () =>
    db.del({ chainId, address: "0x13", tokenId: "5", blockNumber: "95" })
  );
});

test.serial("should be able to get values by id", async (t) => {
  const datum = { chainId, address: "0x9b", tokenId: "2", blockNumber: "110" };
  const value = { test: "data" };
  await db.insert(datum, value);
  const ret = await db.get(datum);
  t.deepEqual(ret.id, datum);
  t.deepEqual(ret.value, value);
});

test.serial(
  "should get value at latest block number if no block number is specified",
  async (t) => {
    const values = [
      {
        id: { chainId, address: "0x01", tokenId: "1", blockNumber: "100" },
        value: { test: "data" },
      },
      {
        id: { chainId, address: "0x01", tokenId: "1", blockNumber: "101" },
        value: { test: "updated-data" },
      },
    ];
    await Promise.all(values.map((v) => db.insert(v.id, v.value)));
    const { blockNumber, ...datum } = values[0].id;
    const ret = await db.get(datum);
    t.deepEqual(ret.id, values[1].id);
    t.deepEqual(ret.value, values[1].value);
  }
);

test.serial.skip(
  "should get all tokenIds with the latest value if not block number is specied",
  async (t) => {}
);

test.serial("should rewrite data if id is same", async (t) => {
  const values = [
    {
      id: { chainId, address: "0xa0", tokenId: "1", blockNumber: "110" },
      value: { test: "data" },
    },
    {
      id: { chainId, address: "0xa0", tokenId: "1", blockNumber: "110" },
      value: { test: "updated-data" },
    },
  ];
  await Promise.all(values.map((v) => db.insert(v.id, v.value)));
  const { blockNumber, ...datum } = values[0].id;
  const ret = await db.get(datum);
  t.deepEqual(ret.id, values[0].id);
  t.deepEqual(ret.value, values[1].value);
});

test.after("clear database", async (t) => {
  await db.level.clear();
  await db.level.close();
});
