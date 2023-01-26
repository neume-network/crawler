/**
 * Sound is the predecessor to sound-protocol
 */
import { decodeLog, toHex } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { fetchTokenUri } from "../components/fetch-tokenuri.js";
import { callOwner } from "../components/call-owner.js";
import { randomItem } from "../utils.js";
import { ifIpfsConvertToNativeIpfs } from "ipfs-uri-utils";
export default class Sound {
    constructor(worker, config) {
        this.filterContracts = async (from, to) => {
            const artistCreatedSelector = "0x23748b43b77f98380e738976c6324996908ffc1989994dd3c68631c87a65a7c0";
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
                commissioner: Sound.name,
                params: [
                    {
                        fromBlock,
                        toBlock,
                        topics: [[artistCreatedSelector]],
                    },
                ],
                version: "0.0.1",
                options,
            });
            if (message.error) {
                throw new Error(`Error occured while filtering ${Sound.name} contracts: \n${JSON.stringify(message, null, 2)}`);
            }
            const logs = message.results;
            const contracts = logs.map((log) => {
                const topics = log.topics;
                topics.shift();
                const result = decodeLog([
                    {
                        type: "uint256",
                        name: "artistId",
                    },
                    {
                        type: "string",
                        name: "name",
                    },
                    {
                        type: "string",
                        name: "symbol",
                    },
                    {
                        type: "address",
                        name: "artistAddress",
                        indexed: true,
                    },
                ], log.data, topics);
                return {
                    address: result.artistAddress.toLowerCase(),
                    name: Sound.name,
                    version: Sound.version,
                };
            });
            return contracts;
        };
        this.crawl = async (nft) => {
            // Instead of querying at the block number soundxyz NFT
            // was minted, we query at a higher block number because
            // soundxyz changed their tokenURI and the previous one
            // doesn't work anymore. https://github.com/neume-network/data/issues/19
            //
            // createdAtBlock           13725566 (https://etherscan.io/tx/0xfa325f74eb6c7f5e6bb60a264404543d6158f79de01bc5aab35180354e554dce)
            // workingAfterBlockNumber  15050010
            const WORKING_AFTER_BLOCK = 15050010;
            if (Sound.invalidIDs.filter((id) => `${nft.erc721.address}/${nft.erc721.token.id}`.match(id))
                .length != 0) {
                console.log(`Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because it is blacklisted`);
                return null;
            }
            nft.erc721.token.uri = await callTokenUri(this.worker, this.config, Math.max(nft.erc721.blockNumber, WORKING_AFTER_BLOCK), nft);
            nft.erc721.token.uriContent = await fetchTokenUri(nft.erc721.token.uri, this.worker);
            nft.creator = await callOwner(this.worker, this.config, nft.erc721.address, nft.erc721.blockNumber);
            const datum = nft.erc721.token.uriContent;
            return {
                version: Sound.version,
                title: datum.name,
                artist: {
                    version: Sound.version,
                    name: datum.artist_name,
                    address: nft.creator,
                },
                platform: {
                    version: Sound.version,
                    name: "Sound",
                    uri: "https://sound.xyz",
                },
                erc721: {
                    version: Sound.version,
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
                        version: Sound.version,
                        uri: ifIpfsConvertToNativeIpfs(datum.audio_url),
                        mimetype: "audio",
                    },
                    {
                        version: Sound.version,
                        uri: ifIpfsConvertToNativeIpfs(datum.image),
                        mimetype: "image",
                    },
                    {
                        version: Sound.version,
                        uri: ifIpfsConvertToNativeIpfs(datum.animation_url),
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
Sound.version = "1.0.0";
Sound.createdAtBlock = 13725566;
Sound.deprecatedAtBlock = null;
Sound.invalidIDs = [];
