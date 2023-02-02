import { decodeLog, toHex } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getArweaveTokenUri } from "../components/get-arweave-tokenuri.js";
import { callOwner } from "../components/call-owner.js";
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
            nft.erc721.token.uri = await callTokenUri(this.worker, this.config, nft.erc721.blockNumber, nft);
            nft.erc721.token.uriContent = await getArweaveTokenUri(nft.erc721.token.uri, this.worker, this.config);
            nft.creator = await callOwner(this.worker, this.config, nft.erc721.address, nft.erc721.blockNumber);
            const datum = nft.erc721.token.uriContent;
            return {
                version: SoundProtocol.version,
                title: datum.name,
                artist: {
                    version: SoundProtocol.version,
                    name: datum.artist,
                    address: nft.creator,
                },
                platform: {
                    version: SoundProtocol.version,
                    name: "Sound Protocol",
                    uri: "https://sound.xyz",
                },
                erc721: {
                    version: SoundProtocol.version,
                    createdAt: nft.erc721.blockNumber,
                    transaction: {
                        from: nft.erc721.transaction.from,
                        to: nft.erc721.transaction.to,
                        blockNumber: nft.erc721.transaction.blockNumber,
                        transactionHash: nft.erc721.transaction.transactionHash,
                    },
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
    updateOwner(nft) { }
}
SoundProtocol.version = "1.0.0";
SoundProtocol.createdAtBlock = 15570834;
SoundProtocol.deprecatedAtBlock = null;
SoundProtocol.invalidIDs = [
    /^0x55ba34d4f0283d1ad0d09502a5b8c1b8886ee724\/1$/,
    /^0x92e44e151508b21eb1a03244f0ddf1a59deb160f\/3$/,
    /^0x92e44e151508b21eb1a03244f0ddf1a59deb160f\/2$/,
    /^0x92e44e151508b21eb1a03244f0ddf1a59deb160f\/1$/,
    /^0x3f4ef39f0e6bf344f7c503095c877deb32dad055\/2$/,
    /^0x3f4ef39f0e6bf344f7c503095c877deb32dad055\/1$/,
    /^0x92e44e151508b21eb1a03244f0ddf1a59deb160f\/4$/,
    /^0x3f4ef39f0e6bf344f7c503095c877deb32dad055\/3$/,
    /^0x11b4e83bc3e9605f03e2a4c34bd09567be5aebbe\/1$/,
    /^0x11b4e83bc3e9605f03e2a4c34bd09567be5aebbe\/2$/,
    /^0xdf4f25cd13567a74572063dcf15f101c22be1af0\/321$/,
    /^0x9f396644ec4b2a2bc3c6cf665d29165dde0e83f1\/\d+$/,
    /^0xd80e33b9a9276458bf3b115e3d7924ea3663bb84\/\d+$/,
    /^0x81c8c35fcb7ac4803812106c594b40c716a260d2\/\d+$/, // tokenURI is not properly formatted
];
