import ExtractionWorker from "@neume-network/extraction-worker";
import { toHex } from "eth-fun";
import { db } from "../database/index.js";
import { getAllContracts, randomItem } from "../src/utils.js";
const TRANSFER_EVENT_SELECTOR = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const FROM_EVENT_SELECTOR = "0x0000000000000000000000000000000000000000000000000000000000000000";
const CHAIN_ID = "1";
export default async function (from, to, recrawl, config, _strategies) {
    const allContracts = await getAllContracts();
    const contracts = Object.entries(allContracts).reduce((prevValue, [addr, info]) => {
        if (_strategies.filter((s) => s.name === info.name).length)
            prevValue = { ...prevValue, ...{ [addr]: info } };
        return prevValue;
    }, {});
    const worker = ExtractionWorker(config.worker);
    const strategies = _strategies.map((s) => new s(worker, config));
    for (let i = from; i <= to; i += config.step.block) {
        const fromBlock = i;
        const toBlock = Math.min(to, i + config.step.block);
        console.log("Crawling from", fromBlock, "to", toBlock);
        for (let j = 0; j < Object.keys(contracts).length; j += config.step.contract) {
            const contractsSlice = Object.keys(contracts).slice(j, j + config.step.contract);
            const rpcHost = randomItem(config.rpc);
            const msg = await worker({
                type: "json-rpc",
                commissioner: "",
                method: "eth_getLogs",
                options: {
                    url: rpcHost.url,
                    headers: {
                        ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
                    },
                    retry: {
                        retries: 3,
                    },
                },
                params: [
                    {
                        fromBlock: toHex(fromBlock),
                        toBlock: toHex(toBlock),
                        address: contractsSlice,
                        topics: [TRANSFER_EVENT_SELECTOR],
                    },
                ],
                version: "0.0.1",
            });
            if (msg.error) {
                console.error(msg);
                throw new Error(`Error occured while fetching Transfer events`);
            }
            const logs = msg.results;
            await Promise.all(logs.map(async (log) => {
                if (!log.blockNumber) {
                    console.log(`log.blockNumber not found for ${msg}`);
                    return;
                }
                if (!log.topics[3]) {
                    console.log(`log.topics[3] should not be undefined`);
                    return;
                }
                const nft = {
                    platform: {
                        ...contracts[log.address],
                    },
                    erc721: {
                        blockNumber: parseInt(log.blockNumber, 16),
                        address: log.address,
                        token: {
                            minting: {
                                transactionHash: log.transactionHash,
                            },
                            id: BigInt(log.topics[3]).toString(10),
                        },
                    },
                    metadata: {},
                };
                let nftExists = false;
                try {
                    nftExists = !!(await db.getOne({
                        chainId: CHAIN_ID,
                        address: nft.erc721.address,
                        tokenId: nft.erc721.token.id,
                        blockNumber: nft.erc721.blockNumber.toString(),
                    }));
                }
                catch (err) {
                    if (err.code !== "LEVEL_NOT_FOUND")
                        throw err;
                }
                if (!recrawl && nftExists)
                    return;
                const strategy = strategies.find((s) => s.constructor.name === nft.platform.name);
                if (!strategy) {
                    throw new Error(`Couldn't find any strategy with the name of ${nft.platform.name} for address ${nft.erc721.address}`);
                }
                if (log.topics[1] === FROM_EVENT_SELECTOR) {
                    let track = null;
                    try {
                        track = await strategy?.crawl(nft);
                    }
                    catch (err) {
                        console.error(`Error occurured while crawling\n`, err, JSON.stringify(nft, null, 2));
                        throw err; // Re-throwing to stop the application
                    }
                    if (track !== null) {
                        await db.insert({
                            chainId: CHAIN_ID,
                            address: nft.erc721.address,
                            tokenId: nft.erc721.token.id,
                            blockNumber: nft.erc721.blockNumber.toString(),
                        }, track);
                        console.log("Found track:", track?.title, track?.platform.name, "at", track?.erc721.createdAt);
                    }
                }
                else {
                    strategy?.updateOwner(nft);
                }
            }));
        }
    }
    console.log("Exiting from crawl command");
}
