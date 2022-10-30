//@format
import { env } from "process";
import { resolve, dirname } from "path";
import { Worker } from "worker_threads";
import { once } from "events";
import process from "process";
import { fileURLToPath } from "url";

import test from "ava";

import { messages } from "../src/api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extractorPath = resolve(__dirname, "../test/start.mjs");

test("sending a throwing job to worker", async (t) => {
  const workerData = {
    queue: {
      options: {
        concurrent: 1,
      },
    },
  };
  const w = new Worker(extractorPath, {
    workerData,
  });
  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    commissioner: "soundxyz",
    version: messages.version,
    type: "json-rpc",
    method: "willmakeworkerthrow",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };

  w.postMessage(message);
  const [response] = await once(w, "message");
  t.is(response.error, "NotImplementedError");
  w.postMessage({ type: "exit", version: messages.version });
  t.deepEqual(await once(w, "exit"), [0]);
});

test("shutting down extractor worker", async (t) => {
  const workerData = {
    queue: {
      options: {
        concurrent: 1,
      },
    },
  };
  const w = new Worker(extractorPath, {
    workerData,
  });
  w.postMessage({ type: "exit", version: messages.version });
  t.deepEqual(await once(w, "exit"), [0]);
});

// TODO: Sandbox call with fetch-mock
test("running script in worker queue", async (t) => {
  const workerData = {
    queue: {
      options: {
        concurrent: 1,
      },
    },
  };
  const w = new Worker(extractorPath, {
    workerData,
  });
  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    commissioner: "soundxyz",
    version: messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };

  w.postMessage(message);
  const [response] = await once(w, "message");
  t.truthy(response);
  t.truthy(response.results);
  t.is(response.type, "json-rpc");
  t.deepEqual(response.params, message.params);
  t.is(response.method, "eth_getTransactionReceipt");
  w.postMessage({ type: "exit", version: messages.version });
  t.deepEqual(await once(w, "exit"), [0]);
});
