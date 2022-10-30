//@format
import test from "ava";
import { RateLimiter } from "limiter";

import { populateEndpointStore } from "../src/endpoint_store.mjs";

test("should be able to populate endpoint store", async (t) => {
  const store = new Map();

  populateEndpointStore(store, {
    "https://infura.io/": {
      timeout: 500,
      requestPerUnit: 50,
      unit: "second",
    },
  });

  const endpoint = store.get("https://infura.io");

  t.truthy(endpoint);
  t.assert(endpoint.rateLimiter instanceof RateLimiter);
  t.is(endpoint.timeout, 500);
});
