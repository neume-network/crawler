import { env } from "process";
import SoundProtocol from "./strategies/sound_protocol.js";
const rpcApiKeys = env.RPC_API_KEYS?.split(",");
const rpcHosts = env.RPC_HTTP_HOSTS?.split(",").map((host, i) => ({
    url: host,
    key: rpcApiKeys?.[i],
}));
if (!rpcHosts)
    throw new Error("Atleast one RPC host is required");
/**
 * New strategies should be added here.
 *
 * For development if you wish to run only a few selected strategies
 * then modify this function.
 */
export function getStrategies(from, to) {
    const strategies = [SoundProtocol];
    return strategies.filter((s) => s.createdAtBlock <= from &&
        to <= (s.deprecatedAtBlock ?? Number.MAX_VALUE));
}
export const config = {
    rpc: rpcHosts,
    arweave: {
        httpsGateway: "https://arweave.net",
    },
    step: {
        block: 799,
        contract: 100,
    },
    worker: {
        queue: {
            options: {
                concurrent: parseInt(env.EXTRACTION_WORKER_CONCURRENCY ?? "100"),
            },
        },
        endpoints: {
            ...rpcHosts.reduce((prevValue, host) => {
                prevValue[host.url] = {
                    timeout: 120000,
                    requestsPerUnit: 300,
                    unit: "second",
                };
                return prevValue;
            }, {}),
            ...(env.ARWEAVE_HTTPS_GATEWAY && {
                [env.ARWEAVE_HTTPS_GATEWAY]: {
                    timeout: 120000,
                    requestsPerUnit: 1000,
                    unit: "second",
                },
            }),
        },
    },
};
