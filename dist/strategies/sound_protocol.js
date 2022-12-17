import { decodeLog, toHex } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getArweaveTokenUri } from "../components/get-arweave-tokenuri.js";
import { randomItem } from "../utils.js";
export default class SoundProtocol {
    constructor(worker, config) {
        this.filterContracts = async (from, to) => {
            const editionCreatedSelector = "0x405098db99342b699216d8150e930dbbf2f686f5a43485aed1e69219dafd4935";
            const rpcHost = randomItem(this.config.rpc);
            const options = {
                url: rpcHost.url,
                headers: {
                    ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
                },
                retry: {
                    retries: 3,
                },
            };
            const fromBlock = toHex(from);
            const toBlock = toHex(to);
            const message = await this.worker({
                type: "json-rpc",
                method: "eth_getLogs",
                commissioner: SoundProtocol.name,
                params: [
                    {
                        fromBlock,
                        toBlock,
                        topics: [[editionCreatedSelector]],
                    },
                ],
                version: "0.0.1",
                options,
            });
            if (message.error) {
                throw new Error(`Error occured while filtering ${SoundProtocol.name} contracts: \n${JSON.stringify(message, null, 2)}`);
            }
            const logs = message.results;
            return logs.map((log) => {
                const topics = log.topics;
                topics.shift();
                const result = decodeLog([
                    { type: "address", name: "soundEdition", indexed: true },
                    { type: "address", name: "deployer", indexed: true },
                    { type: "bytes", name: "initData" },
                    { type: "address[]", name: "contracts" },
                    { type: "bytes[]", name: "data" },
                    { type: "bytes[]", name: "results" },
                ], log.data, topics);
                return {
                    address: result.soundEdition.toLowerCase(),
                    name: SoundProtocol.name,
                    version: SoundProtocol.version,
                };
            });
        };
        this.crawl = async (nft) => {
            if (SoundProtocol.invalidIDs.filter((id) => `${nft.erc721.address}/${nft.erc721.token.id}`.match(id)).length != 0) {
                console.log(`Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because it is blacklisted`);
                return null;
            }
            nft = await callTokenUri(this.worker, this.config, nft.erc721.createdAt, nft);
            nft = await getArweaveTokenUri(this.worker, this.config, nft);
            if (!nft.erc721.token.uri)
                throw new Error(`tokenURI shouldn't be empty ${JSON.stringify(nft, null, 2)}`);
            if (!nft.erc721.token.uriContent)
                throw new Error(`tokenURI content shouldn't be empty ${JSON.stringify(nft, null, 2)}`);
            const datum = nft.erc721.token.uriContent;
            return {
                version: SoundProtocol.version,
                title: datum.name,
                artist: {
                    version: SoundProtocol.version,
                    name: datum.artist,
                },
                platform: {
                    version: SoundProtocol.version,
                    name: "Sound Protocol",
                    uri: "https://sound.xyz",
                },
                erc721: {
                    version: SoundProtocol.version,
                    createdAt: nft.erc721.createdAt,
                    // TODO: Stop hard coding this value
                    owner: "0x4456AE02EA5534cEd3A151e41a715bBA685A7CAb",
                    address: nft.erc721.address,
                    tokenId: nft.erc721.token.id,
                    tokenURI: nft.erc721.token.uri,
                    metadata: {
                        ...datum,
                        name: datum.name,
                        description: datum.description,
                        image: datum.image,
                    },
                },
                manifestations: [
                    {
                        version: SoundProtocol.version,
                        uri: datum.losslessAudio,
                        mimetype: "audio",
                    },
                    {
                        version: SoundProtocol.version,
                        uri: datum.image,
                        mimetype: "image",
                    },
                ],
            };
        };
        this.worker = worker;
        this.config = config;
    }
}
SoundProtocol.version = "1.0.0";
SoundProtocol.createdAtBlock = 15570834;
SoundProtocol.deprecatedAtBlock = null;
SoundProtocol.invalidIDs = [
    /^0xdf4f25cd13567a74572063dcf15f101c22be1af0\/321$/,
    /^0x9f396644ec4b2a2bc3c6cf665d29165dde0e83f1\/\d+$/, // tokenURI is not properly formatted and is not Arweave
];
