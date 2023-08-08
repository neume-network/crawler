import { JSONRPCClient } from "json-rpc-2.0";
import ExtractionWorker from "@neume-network/extraction-worker";

import { Config } from "../src/types.js";
import { Strategy } from "../src/strategies/strategy.types.js";
import { localStorage, saveLocalStorage } from "../database/localstorage.js";
import { tracksDB } from "../database/tracks.js";
import { Track } from "@neume-network/schema";

const sync = async function (
  _since: number | undefined,
  url: string,
  config: Config,
  strategies: (typeof Strategy)[],
) {
  const worker = ExtractionWorker(config.worker);
  const storage = localStorage.sublevel<string, number>("sync", {});
  const normalizedUrl = new URL(url).host;
  let client: JSONRPCClient;
  let id = 0;
  client = new JSONRPCClient(
    (jsonRPCRequest) =>
      worker({
        type: "https",
        version: "0.0.1",
        commissioner: "",
        options: {
          url,
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(jsonRPCRequest),
          retry: {
            retries: 3,
          },
        },
      }).then((msg) => {
        if (msg.error) return Promise.reject(new Error(JSON.stringify(msg.error)));

        return client.receive(msg.results as any);
      }),
    () => (++id).toString(), // HACK because of a bug in JSON-RPC-Client
  );

  // Assuming localstorage won't be too big in size. We can
  // ask for everything and update our localstorage.
  const syncLocalStorage = async (platform: string) => {
    const localStorage = await client.request("getLocalStorage", {
      platform,
    });

    await saveLocalStorage(platform, localStorage);
  };

  const syncTracks = async (platform: string, since: number) => {
    const { tracks, nextTimestamp } = (await client.request("getTracks", {
      since,
      platform,
    })) as {
      tracks: Track[];
      nextTimestamp: number;
    };

    // This will either create a new track or merge with the existing track
    await Promise.all(tracks.map(async (track) => tracksDB.upsertTrack(track)));
    console.log(
      `Upserted ${tracks.length} tracks for ${platform}. startTimestamp=${since} nextTimestamp=${nextTimestamp}`,
    );
    if (nextTimestamp) {
      await storage.put(`${normalizedUrl}-${platform}`, nextTimestamp);
      return nextTimestamp;
    }
  };

  await Promise.all(
    strategies.map(async (strategy) => {
      let lastSync: number | undefined;

      try {
        lastSync = await storage.get(`${normalizedUrl}-${strategy.name}`);
      } catch (err: any) {
        if (err.code !== "LEVEL_NOT_FOUND") throw err;
      }

      let since: number | undefined = _since ?? lastSync ?? 0;
      syncLocalStorage(strategy.name);
      do {
        since = await syncTracks(strategy.name, since);
      } while (since);
    }),
  );
};

export default sync;
