import { JSONRPCClient } from "json-rpc-2.0";
import ExtractionWorker from "@neume-network/extraction-worker";
import { db } from "../database/index.js";
export default async function (url, latestBlockNumber, config) {
    const worker = ExtractionWorker(config.worker);
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
    }), () => (++id).toString() // HACK because of a bug in JSON-RPC-Client
    );
    const lastId = await db.changeIndex
        .iterator({ reverse: true, limit: 1 })
        .next();
    const lastSyncedBlock = lastId ? parseInt(lastId[0].split("/")[0]) : 1500000;
    for (let syncedTill = lastSyncedBlock; syncedTill <= latestBlockNumber; syncedTill += 5000) {
        console.log(`Syncing from ${syncedTill} to ${syncedTill + 5000}`);
        const returnValues = (await client.request("getIdsChanged_fill", [
            syncedTill,
            syncedTill + 5000,
        ]));
        await Promise.all(returnValues.map(async (r) => {
            await db.insert(r.id, r.value);
        }));
        console.log(`Wrote ${returnValues.length} entries to database`);
    }
}
