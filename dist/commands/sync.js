import { JSONRPCClient } from "json-rpc-2.0";
import ExtractionWorker from "@neume-network/extraction-worker";
import { localStorage, saveLocalStorage } from "../database/localstorage.js";
import { tracksDB } from "../database/tracks.js";
const sync = async function (_since, url, config, strategies) {
    const worker = ExtractionWorker(config.worker);
    const storage = localStorage.sublevel("sync", {});
    const normalizedUrl = new URL(url).host;
    let client;
    let id = 0;
    client = new JSONRPCClient((jsonRPCRequest) => worker({
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
        if (msg.error)
            return Promise.reject(new Error(JSON.stringify(msg.error)));
        return client.receive(msg.results);
    }), () => (++id).toString());
    // Assuming localstorage won't be too big in size. We can
    // ask for everything and update our localstorage.
    const syncLocalStorage = async (platform) => {
        const localStorage = await client.request("getLocalStorage", {
            platform,
        });
        await saveLocalStorage(platform, localStorage);
    };
    const syncTracks = async (platform, since) => {
        const { tracks, nextTimestamp } = (await client.request("getTracks", {
            since,
            platform,
        }));
        // This will either create a new track or merge with the existing track
        await Promise.all(tracks.map(async (track) => tracksDB.upsertTrack(track)));
        console.log(`Upserted ${tracks.length} tracks for ${platform}. startTimestamp=${since} nextTimestamp=${nextTimestamp}`);
        if (nextTimestamp) {
            await storage.put(`${normalizedUrl}-${platform}`, nextTimestamp);
            return nextTimestamp;
        }
    };
    await Promise.all(strategies.map(async (strategy) => {
        let lastSync;
        try {
            lastSync = await storage.get(`${normalizedUrl}-${strategy.name}`);
        }
        catch (err) {
            if (err.code !== "LEVEL_NOT_FOUND")
                throw err;
        }
        let since = _since ?? lastSync ?? 0;
        syncLocalStorage(strategy.name);
        do {
            since = await syncTracks(strategy.name, since);
        } while (since);
    }));
};
export default sync;
