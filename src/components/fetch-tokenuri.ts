import { ExtractionWorkerHandler } from '@neume-network/extraction-worker';

export async function fetchTokenUri(url: string, worker: ExtractionWorkerHandler) {
  const msg = await worker({
    type: 'https',
    version: '0.0.1',
    commissioner: '',
    options: {
      url,
      method: 'GET',
      retry: {
        retries: 3,
      },
    },
  });

  if (msg.error) throw new Error(`Error while fetching JSON URI: ${JSON.stringify(msg, null, 2)}`);

  return msg.results as Record<any, any>;
}
