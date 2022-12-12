import ExtractionWorker from "@neume-network/extraction-worker";
import path from "path";
import { readFile, writeFile } from "fs/promises";

import { Config } from "../types.js";
import { Strategy } from "../strategies/strategy.types.js";
import { getContracts } from "../utils.js";

export default async function (
  from: number,
  to: number,
  config: Config,
  _strategies: typeof Strategy[]
) {
  if (!config.rpc.length) throw new Error("Atleast one RPC host is required");

  const contracts = await getContracts();
  const worker = ExtractionWorker(config.worker);
  const strategies = _strategies.map((s) => new s(worker, config));

  for (let i = from; i <= to; i += config.step.block) {
    const fromBlock = i;
    const toBlock = Math.min(to, i + config.step.block);
    console.log("Finding contracts from", fromBlock, toBlock);

    await Promise.all(
      strategies.map(async (strategy) => {
        if (!strategy.filterContracts) return;

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

  await writeFile(
    path.resolve("./contracts.json"),
    JSON.stringify(contracts, null, 2)
  );
  console.log("Exiting from filter-contracts command");
  process.exit(0);
}
