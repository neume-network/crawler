import { Worker, isMainThread, workerData } from "worker_threads";

import { run } from "../src/worker.mjs";

const module = {
  defaults: {
    workerData: {
      queue: {
        options: {
          concurrency: 1,
        },
      },
    },
  },
};

if (isMainThread) {
  console.log("Detected mainthread: Respawning extractor as worker_thread");
  // INFO: We're launching this file as a `Worker` when the mainthread is
  // detected as this can be useful when running it without an accompanying
  // other process.
  new Worker(__filename, { workerData: module.defaults.workerData });
} else {
  run();
}
