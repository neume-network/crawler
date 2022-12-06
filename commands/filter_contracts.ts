import ExtractionWorker from "@neume-network/extraction-worker";
import { env } from "process";
import { readFile, writeFile } from "fs/promises";

import SoundProtocol from "../strategies/sound_protocol.js";
import { Strategy } from "../strategies/strategy.types.js";
import { Config } from "../types.js";

const STEP = 799;

const rpcApiKeys = env.RPC_API_KEYS?.split(",");
const rpcHosts = env.RPC_HTTP_HOSTS?.split(",").map((host, i) => ({
  url: host,
  key: rpcApiKeys?.[i],
}));

export default async function (from: number, to: number, config: Config) {
  if (!rpcHosts) throw new Error("Atleast one RPC host is required");

  const contractsFilePath = new URL("../contracts.json", import.meta.url);
  const contracts: Record<string, any> = JSON.parse(
    await readFile(contractsFilePath, "utf-8")
  );

  const worker = ExtractionWorker(config.worker);

  const strategies: Array<Strategy> = [new SoundProtocol(worker, config)];

  for (let i = from; i <= to; i += STEP) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + STEP);

    await Promise.all(
      strategies.map(async (strategy) => {
        const newContracts = await strategy.filterContracts(fromBlock, toBlock);
        newContracts.forEach((contract) => {
          contracts[contract.address] = {
            name: contract.name,
            version: contract.version,
          };
        });
      })
    );
  }

  await writeFile(contractsFilePath, JSON.stringify(contracts, null, 2));
  console.log("done");
}
