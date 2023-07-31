/**
 * Sound is the predecessor to sound-protocol
 */
import { decodeLog, toHex } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { fetchTokenUri } from "../components/fetch-tokenuri.js";
import { callOwner } from "../components/call-owner.js";
import { CHAINS } from "../types.js";
import { randomItem } from "../utils.js";
import { ifIpfsConvertToNativeIpfs } from "ipfs-uri-utils";
import { localStorage } from "../../database/localstorage.js";
import { handleTransfer } from "../components/handle-transfer.js";
export default class Sound {
    constructor(worker, config) {
        this.createdAtBlock = Sound.createdAtBlock;
        this.deprecatedAtBlock = null;
        this.chain = CHAINS.eth;
        this.crawl = async (from, to, recrawl) => {
            const { getLogsBlockSpanSize } = this.config.chain[this.chain];
            const handleArtistCreatedPromises = [];
            for (let i = from; i <= to; i += getLogsBlockSpanSize + 1)
                handleArtistCreatedPromises.push(this.handleArtistCreated(i, i + getLogsBlockSpanSize));
            await Promise.all(handleArtistCreatedPromises);
            await handleTransfer.call(this, from, to, recrawl);
        };
        this.handleArtistCreated = async (from, to) => {
            const artistCreatedSelector = "0x23748b43b77f98380e738976c6324996908ffc1989994dd3c68631c87a65a7c0";
            const rpcHost = randomItem(this.config.chain[this.chain].rpc);
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
            await Promise.all(contracts.map(async (c) => {
                // Save contract address that is to be checked for NFTs in future
                await this.contracts.put(c.address, { name: c.name, version: c.version });
            }));
        };
        this.nftToUid = async (nft) => `${this.chain}/${Sound.name}/${nft.erc721.address.toLowerCase()}`;
        this.fetchMetadata = async (nft) => {
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
            nft.erc721.token.uri = (await callTokenUri.call(this, Math.max(nft.erc721.blockNumber, WORKING_AFTER_BLOCK), nft));
            nft.erc721.token.uriContent = await fetchTokenUri(nft.erc721.token.uri, this.worker);
            nft.creator = await callOwner.call(this, nft.erc721.address, nft.erc721.blockNumber);
            const datum = nft.erc721.token.uriContent;
            return {
                version: Sound.version,
                title: datum.name,
                uid: await this.nftToUid(nft),
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
                    address: nft.erc721.address,
                    tokens: [
                        {
                            id: nft.erc721.token.id,
                            uri: nft.erc721.token.uri,
                            metadata: {
                                ...datum,
                                name: datum.name,
                                description: datum.description,
                                image: datum.image,
                            },
                            owners: [
                                {
                                    from: nft.erc721.transaction.from,
                                    to: nft.erc721.transaction.to,
                                    blockNumber: nft.erc721.blockNumber,
                                    transactionHash: nft.erc721.transaction.transactionHash,
                                    alias: undefined,
                                },
                            ],
                        },
                    ],
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
        this.localStorage = localStorage.sublevel(Sound.name, {
            valueEncoding: "json",
        });
        this.contracts = this.localStorage.sublevel("contracts", {
            valueEncoding: "json",
        });
    }
}
Sound.version = "1.0.0";
Sound.createdAtBlock = 13725566;
Sound.invalidIDs = [];
