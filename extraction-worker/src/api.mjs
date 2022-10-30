// @format
import Ajv from "ajv";
import { workerMessage } from "@neume-network/schema";
import AbortController from "abort-controller";
import { CID } from "multiformats/cid";

import logger from "./logger.mjs";
import { ValidationError, NotImplementedError } from "./errors.mjs";
import { translate } from "./eth.mjs";
import { endpointStore } from "./endpoint_store.mjs";
import { request } from "./request.mjs";
import addFormats from "ajv-formats";

const log = logger("api");
const ajv = new Ajv();
const version = "0.0.1";

addFormats(ajv);
const check = ajv.compile(workerMessage);
function validate(value) {
  const valid = check(value);
  if (!valid) {
    log(check.errors);
    throw new ValidationError(
      "Found 1 or more validation error when checking worker message"
    );
  }

  if (value.version !== version) {
    throw new ValidationError(
      `Difference in versions. Worker: "${version}", Message: "${value.version}"`
    );
  }

  return true;
}

// NOTE: `AbortSignal.timeout` isn't yet supported:
// https://github.com/mysticatea/abort-controller/issues/35
export const AbortSignal = {
  timeout: function (value) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), value);
    return controller.signal;
  },
};

async function route(message) {
  const { type } = message;

  if (type === "json-rpc") {
    const { method, params, options } = message;

    const { origin } = new URL(options.url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    if (options.timeout || timeoutFromConfig) {
      options.signal = AbortSignal.timeout(
        options.timeout ?? timeoutFromConfig
      );
      delete options.timeout;
    }

    let results;
    try {
      results = await translate(options, method, params);
    } catch (error) {
      return { ...message, error: error.toString() };
    }

    return { ...message, results };
  } else if (type === "https") {
    const {
      url,
      method,
      body,
      headers,
      timeout: timeoutFromMsg,
    } = message.options;

    const { origin } = new URL(url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    let signal;
    if (timeoutFromMsg || timeoutFromConfig) {
      signal = AbortSignal.timeout(timeoutFromMsg ?? timeoutFromConfig);
    }

    let data;
    try {
      data = await request(url, method, body, headers, signal);
    } catch (error) {
      return { ...message, error: error.toString() };
    }
    return { ...message, results: data };
  } else if (type === "arweave") {
    const { headers, uri, gateway, timeout: timeoutFromMsg } = message.options;

    const url = `${gateway}/${uri.split("ar://").pop()}`;

    const { origin } = new URL(url);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    let signal;
    if (timeoutFromMsg || timeoutFromConfig) {
      signal = AbortSignal.timeout(timeoutFromMsg ?? timeoutFromConfig);
    }

    let data;
    try {
      const method = "GET";
      const body = null;
      data = await request(url, method, body, headers, signal);
    } catch (error) {
      return { ...message, error: error.toString() };
    }
    return { ...message, results: data };
  } else if (type === "graphql") {
    const { url, body, headers } = message.options;
    const method = "POST";

    let data;
    try {
      data = await request(url, method, body, headers);
    } catch (error) {
      return { ...message, error: error.toString() };
    }

    if (data.errors) {
      // NOTE: For now, we're only returning the first error message.
      return { ...message, error: data.errors[0].message };
    }

    return { ...message, results: data };
  } else if (type === "ipfs") {
    let { headers, uri, gateway, timeout: timeoutFromMsg } = message.options;

    const nativeIPFSPattern = /^(ipfs:\/\/)([^/?#]+)(.*)/;
    const match = uri.match(nativeIPFSPattern);

    if (match === null) return { ...message, error: "Invalid IPFS URL" };
    const [_, protocol, hash, path] = match;

    if (!protocol) return { ...message, error: "Invalid protcol" };
    if (!hash) return { ...message, error: "Could not find CID" };

    try {
      CID.parse(hash);
    } catch (error) {
      return { ...message, error: "Invalid CID" };
    }

    uri = `${gateway}${hash}${path}`; // gateway will contain a trailing slash

    const { origin } = new URL(uri);
    const { rateLimiter, timeout: timeoutFromConfig } =
      endpointStore.get(origin) ?? {};

    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    let signal;
    if (timeoutFromMsg || timeoutFromConfig) {
      signal = AbortSignal.timeout(timeoutFromMsg ?? timeoutFromConfig);
    }

    let data;
    try {
      const body = null;
      data = await request(uri, "GET", body, headers, signal);
    } catch (error) {
      return { ...message, error: error.toString() };
    }

    return { ...message, results: data };
  } else {
    return { ...message, error: new NotImplementedError().toString() };
  }
}

export const messages = {
  route,
  validate,
  version,
};
