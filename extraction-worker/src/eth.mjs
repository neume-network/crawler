//@format
import {
  call,
  blockNumber,
  getBlockByNumber,
  getTransactionReceipt,
  getLogs,
} from "eth-fun";

import { NotImplementedError } from "./errors.mjs";

export async function translate(options, method, params) {
  if (method === "eth_getTransactionReceipt") {
    return await getTransactionReceipt(options, params[0]);
  } else if (method === "eth_getBlockByNumber") {
    // NOTE: `getBlockByNumber` expects the `blockNumber` input to be an
    // hexadecimal (`0x...`) value.
    return await getBlockByNumber(options, ...params);
  } else if (method === "eth_blockNumber") {
    return await blockNumber(options);
  } else if (method === "eth_call") {
    const { from, to, data } = params[0];
    return await call(options, from, to, data, params[1]);
  } else if (method === "eth_getLogs") {
    const { fromBlock, toBlock, address, topics, limit } = params[0];
    return await getLogs(options, {
      fromBlock,
      toBlock,
      address,
      topics,
      limit,
    });
  } else {
    throw new NotImplementedError();
  }
}
