import { ExtractionWorkerHandler } from '@neume-network/extraction-worker';
import { toHex, encodeFunctionSignature, decodeParameters } from 'eth-fun';
import { Config } from '../types.js';
import { randomItem } from '../utils.js';

export async function callOwner(
  worker: ExtractionWorkerHandler,
  config: Config,
  to: string,
  blockNumber: number,
): Promise<string> {
  if (!config.rpc.length) throw new Error('Atleast one RPC host is required');

  const rpc = randomItem(config.rpc);
  const data = encodeFunctionSignature('owner()');
  const msg = await worker({
    type: 'json-rpc',
    commissioner: '',
    version: '0.0.1',
    method: 'eth_call',
    options: {
      url: rpc.url,
      retry: {
        retries: 3,
      },
    },
    params: [
      {
        to,
        data,
      },
      toHex(blockNumber),
    ],
  });

  if (msg.error)
    throw new Error(`Error while calling owner on contract: ${to} ${JSON.stringify(msg, null, 2)}`);

  const owner = decodeParameters(['address'], msg.results)[0];

  if (typeof owner !== 'string')
    throw new Error(`typeof owner invalid ${JSON.stringify(msg, null, 2)}`);

  return owner;
}
