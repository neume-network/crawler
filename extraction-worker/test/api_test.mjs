//@format
import { env } from "process";

import test from "ava";
import esmock from "esmock";
import createWorker from "expressively-mocked-fetch";

import { messages, AbortSignal } from "../src/api.mjs";
import { ValidationError } from "../src/errors.mjs";

test("sending a json-rpc request that times out", async (t) => {
  const pauseMilliseconds = 1000;
  const worker = await createWorker(
    `
    app.post('/', async (req, res) => {
      res.status(200).send("hello world");
    });
  `,
    { pauseMilliseconds }
  );

  const timeoutMilliseconds = 500;
  const message = {
    options: {
      timeout: timeoutMilliseconds,
      url: `http://localhost:${worker.port}`,
    },
    version: messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };

  const response = await messages.route(message);
  t.true(response.error.includes("AbortError"));
});

test("sending an https request timeout through message", async (t) => {
  const pauseMilliseconds = 1000;
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).send("hello world");
    });
  `,
    { pauseMilliseconds }
  );

  const timeoutMilliseconds = 500;
  const message = {
    type: "https",
    version: messages.version,
    options: {
      timeout: timeoutMilliseconds,
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.true(res.error.includes("AbortError"));
});

test("sending an https request timeout through config", async (t) => {
  const pauseMilliseconds = 1000;
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).send("hello world");
    });
  `,
    { pauseMilliseconds }
  );

  const endpointStore = new Map();
  endpointStore.set(`http://localhost:${worker.port}`, { timeout: 500 });

  const { messages } = await esmock("../src/api.mjs", {
    "../src/endpoint_store.mjs": {
      endpointStore: endpointStore,
    },
  });

  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.true(res.error.includes("AbortError"));
});

test("setting a timeout that isn't triggered", async (t) => {
  const timeout = 1000;
  const signal = AbortSignal.timeout(timeout);
  t.plan(1);
  let called = false;
  signal.addEventListener("abort", () => {
    called = true;
  });
  await new Promise((resolve) => setTimeout(resolve, timeout - timeout / 2));
  t.false(called);
});

test("setting a timeout", async (t) => {
  const timeout = 100;
  const signal = AbortSignal.timeout(timeout);
  t.plan(1);
  let called = false;
  signal.addEventListener("abort", () => {
    called = true;
  });
  await new Promise((resolve) => setTimeout(resolve, timeout + 5));
  t.true(called);
});

test("sending a graphql message", (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    commissioner: "soundxyz",
    options: {
      url: "https://example.com",
      body: JSON.stringify({
        query: `{ nfts(first: 1, skip: 0) { id } }`,
      }),
    },
  };

  t.true(messages.validate(message));
});

test("sending invalid json as response", async (t) => {
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(200).send("hello world");
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.is(res.results, "hello world");
});

test("failing https request with status and body", async (t) => {
  const httpStatus = 401;
  const httpMessage = "bad request";
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(${httpStatus}).send("${httpMessage}");
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.true(res.error.includes(message.options.url));
  t.true(res.error.includes(message.options.method));
  t.true(res.error.includes(httpMessage));
  t.true(res.error.includes(httpStatus));
});

test("failing https request with status", async (t) => {
  const httpStatus = 401;
  const worker = await createWorker(`
    app.get('/', function (req, res) {
      res.status(${httpStatus}).send();
    });
  `);
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: `http://localhost:${worker.port}`,
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.true(res.error.includes(httpStatus));
});

// TODO: Sandbox request with fetchMock
test("failing https request", async (t) => {
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: "https://thisdomaindoesntrespond.com",
      method: "GET",
    },
  };

  const res = await messages.route(message);
  t.true(res.error.includes("FetchError"));
});

// TODO: Sandbox request with fetchMock
test("executing https job", async (t) => {
  const message = {
    type: "https",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      method: "POST",
      body: JSON.stringify({
        query: `{ nfts(first: 1000) { id } }`,
      }),
    },
  };

  const response = await messages.route(message);
  t.truthy(response);
  t.truthy(response.results.data);
  t.truthy(response.results.data.nfts);
  t.true(response.results.data.nfts.length > 0);
});

test("fail to execute a graphql job", async (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      body: JSON.stringify({
        query: `nonsense query`,
      }),
    },
  };

  const res = await messages.route(message);
  t.true(typeof res.error === "string");
});

test("executing a graphql job", async (t) => {
  const message = {
    type: "graphql",
    version: messages.version,
    options: {
      url: "https://api.thegraph.com/subgraphs/name/timdaub/web3musicsubgraph",
      body: JSON.stringify({
        query: `{ nfts(first: 1000) { id } }`,
      }),
    },
  };

  const response = await messages.route(message);
  t.truthy(response);
  t.truthy(response.results.data);
  t.truthy(response.results.data.nfts);
  t.true(response.results.data.nfts.length > 0);
});

test("validating version of message", (t) => {
  messages.validate({ type: "exit", version: messages.version });
  t.throws(() => messages.validate({ type: "exit", version: "1337.0.0" }));
});

test("validating schema `type` prop", (t) => {
  const message0 = {
    type: "exit",
    version: messages.version,
  };
  t.true(messages.validate(message0));

  const message1 = {
    type: "false type",
    version: messages.version,
  };
  t.throws(() => messages.validate(message1), { instanceOf: ValidationError });

  const message2 = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    commissioner: "soundxyz",
    version: messages.version,
    type: "json-rpc",
    method: "eth_getBlockByNumber",
    params: [],
  };
  t.true(messages.validate(message2));
});

test("validating http job schema", (t) => {
  const message = {
    type: "https",
    commissioner: "soundxyz",
    version: "0.0.1",
    options: {
      url: "https://example.com",
      method: "GET",
    },
  };

  t.true(messages.validate(message));
});

test("sending a json-rpc job", async (t) => {
  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    version: messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };

  const res = await messages.route(message);
  t.falsy(res.error);
  t.truthy(res.results);
});

test("handling failed job", async (t) => {
  const apiMock = await esmock("../src/api.mjs", {
    "../src/eth.mjs": {
      translate: async () => {
        throw new Error("MockError");
      },
    },
  });

  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    version: apiMock.messages.version,
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };

  const cb = async (err, res) => {
    t.truthy(err);
    t.falsy(res);
  };
  const res = await apiMock.messages.route(message);
  t.truthy(res.error);
  t.true(res.error.includes("MockError"));
});

test("sending a valid ipfs request", async (t) => {
  const worker = await createWorker(
    `
    app.get('/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu', async (req, res) => {
      res.status(200).json({hello: "world"});
    });
  `
  );

  const message = {
    options: {
      uri: "ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu/",
      gateway: `http://localhost:${worker.port}/ipfs/`,
    },
    version: messages.version,
    type: "ipfs",
    commissioner: "test",
  };

  t.true(messages.validate(message));

  const res = await messages.route(message);
  t.falsy(res.error);
  t.deepEqual(res.results, { hello: "world" });

  worker.process.terminate();
});

test("sending a valid ipfs request with path", async (t) => {
  const worker = await createWorker(
    `
    app.get('/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu/wiki/index.html/', async (req, res) => {
      res.status(200).send("{}");
    });
  `
  );

  const message = {
    options: {
      uri: "ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu/wiki/index.html",
      gateway: `http://localhost:${worker.port}/ipfs/`,
    },
    version: messages.version,
    type: "ipfs",
    commissioner: "test",
  };

  t.true(messages.validate(message));

  const res = await messages.route(message);
  t.falsy(res.error);
  t.truthy(res.results);

  worker.process.terminate();
});

test("sending ipfs request that will timeout", async (t) => {
  const worker = await createWorker(
    `
    app.get('*', async (req, res) => {
      res.status(200).send("{}");
    });
  `,
    { pauseMilliseconds: 1000 }
  );

  const message = {
    options: {
      uri: "ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu",
      gateway: `http://localhost:${worker.port}/ipfs/`,
      timeout: 50,
    },
    version: messages.version,
    type: "ipfs",
  };

  const res = await messages.route(message);
  t.true(res.error.includes("AbortError"));

  worker.process.terminate();
});

test("sending ipfs request with invalid url", async (t) => {
  const message = {
    options: {
      uri: "ipfs:Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu",
      gateway: `http://localhost/ipfs/`,
    },
    version: messages.version,
    type: "ipfs",
  };

  const res = await messages.route(message);
  t.true(res.error.includes("Invalid IPFS URL"));
});

test("sending ipfs request with invalid cid", async (t) => {
  const message = {
    options: {
      uri: "ipfs://CZe7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu",
      gateway: `http://localhost/ipfs/`,
    },
    version: messages.version,
    type: "ipfs",
  };

  const res = await messages.route(message);
  t.true(res.error.includes("Invalid CID"));
});

test("sending a arweave message", async (t) => {
  const message = {
    type: "arweave",
    version: messages.version,
    options: {
      uri: "ar://ltmVC0dpe7_KxFHj0-S7mdvXSfmcJOec4_OfjwSzLRk/1",
      gateway: "https://arweave.net",
    },
  };

  const res = await messages.route(message);
  t.is(
    JSON.stringify(res.results),
    '{"animation_url":"ar://13x70jy8BhfbC7_Dvkptidyg7TJEMvpoEZV34PIn2Ek","artist":"Dot","artwork":{"mimeType":"image/png","uri":"ar://73AuO6WpSwqQTOzj-l5EIbkzfquIS1RDnlJroavLf24","nft":null},"attributes":[{"trait_type":"Make Me Believe","value":"Song Edition"}],"bpm":124,"description":"This song started from a quick voice memo I had recorded on my phone yesterday, and I wanted to see if it was possible to turn it into a fully-produced song live on my twitch stream. \\n\\n\\"Make Me Believe\\" was written, recorded, produced, mixed, mastered and released in less than 24 hours, and you can watch the production stream replay here: https://www.twitch.tv/dotmvsic","duration":238,"external_url":"https://www.sound.xyz/dot/make-me-believe","genre":"House","image":"ar://73AuO6WpSwqQTOzj-l5EIbkzfquIS1RDnlJroavLf24","license":null,"lyrics":{"text":"You remind me\\nTo take some time to breathe\\nYou can be human\\nAnd it\'s okay to feel\\nSay it out loud\\n\\nTake some time to breathe\\nYou can be human\\nAnd it\'s okay to feel\\n\\nYou make me believe\\nYou make me believe\\nBelieve in Love again ","nft":null},"key":null,"locationCreated":"us","losslessAudio":"ar://13x70jy8BhfbC7_Dvkptidyg7TJEMvpoEZV34PIn2Ek","mimeType":"audio/wave","name":"Make Me Believe #1","title":"Make Me Believe","trackNumber":1,"version":"sound-edition-20220222","credits":null,"isrc":null,"originalReleaseDate":null,"project":null,"publisher":null,"recordLabel":null,"tags":null,"visualizer":null}'
  );
});
