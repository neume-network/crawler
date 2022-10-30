import test from "ava";
import createWorker from "expressively-mocked-fetch";

import { request } from "../src/request.mjs";

test("should be able to parse if content-type is json and body is parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).set('Content-Type', 'application/json').json({hello: "world"});
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");
  t.deepEqual(res, { hello: "world" });
  worker.process.terminate();
});

test("should be able to parse if content-type is undefined and body is parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).json({hello: "world"});
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");

  t.deepEqual(res, { hello: "world" });
  worker.process.terminate();
});

test("should not be able to parse if content-type is json and body is unparsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).set('Content-Type', 'application/json').send('hello');
    });
  `
  );

  await t.throwsAsync(
    async () => request(`http://localhost:${worker.port}`, "GET"),
    {
      message:
        'Encountered error when trying to parse JSON body result: "hello", error: "SyntaxError: Unexpected token h in JSON at position 0"',
    }
  );
  worker.process.terminate();
});

test("should return plaintext if content-type is undefined and body is not parsable", async (t) => {
  const worker = await createWorker(
    `
    app.get('/', async (req, res) => {
      res.status(200).send('hello');
    });
  `
  );

  const res = await request(`http://localhost:${worker.port}`, "GET");
  t.is(res, "hello");
  worker.process.terminate();
});
