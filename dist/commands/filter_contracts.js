import ExtractionWorker from "@neume-network/extraction-worker";
import path from "path";
import { writeFile } from "fs/promises";
import { getUserContracts } from "../src/utils.js";
export default async function (from, to, recrawl, config, _strategies) {
  if (!config.rpc.length) throw new Error("Atleast one RPC host is required");
  const userContracts = await getUserContracts();
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
          userContracts[contract.address] = {
            name: contract.name,
            version: contract.version,
          };
        });
      }),
    );
  }
  await writeFile(path.resolve("./data/contracts.json"), JSON.stringify(userContracts, null, 2));
  console.log("Exiting from filter-contracts command");
}
