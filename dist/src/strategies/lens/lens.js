/**
 * Current lens first song - 33474641
 */
import { decodeLog, encodeParameters } from "eth-fun";
import { CHAINS, PROTOCOLS } from "../../types.js";
import { getProtocol } from "../../utils.js";
import { localStorage } from "../../../database/localstorage.js";
import { getArweaveTokenUri } from "../../components/get-arweave-tokenuri.js";
import { getIpfsTokenUri } from "../../components/get-ipfs-tokenuri.js";
import { fetchTokenUri } from "../../components/fetch-tokenuri.js";
import { ethGetLogs } from "../../components/eth-get-logs.js";
import { tracksDB } from "../../../database/tracks.js";
import { handleTransfer } from "../../components/handle-transfer.js";
import { getAlias, getCollectNFT, getHandle } from "./components.js";
import { z } from "zod";
export default class Lens {
    constructor(worker, config) {
        this.createdAtBlock = Lens.createdAtBlock;
        this.deprecatedAtBlock = null;
        this.chain = CHAINS.polygon;
        // This is called when a new NFT is minted in Lens
        this.fetchMetadata = async (nft) => {
            let uid;
            try {
                uid = await this.addressToId.get(nft.erc721.address);
            }
            catch (err) {
                console.log("Error for", nft);
                throw err;
            }
            const alias = await getAlias.call(this, nft);
            return {
                id: nft.erc721.token.id,
                owners: [
                    {
                        from: nft.erc721.transaction.from,
                        to: nft.erc721.transaction.to,
                        blockNumber: nft.erc721.blockNumber,
                        transactionHash: nft.erc721.transaction.transactionHash,
                        alias: alias ?? undefined,
                    },
                ],
            };
        };
        this.nftToUid = async (nft) => {
            return this.addressToId.get(nft.erc721.address);
        };
        this.worker = worker;
        this.config = config;
        this.localStorage = localStorage.sublevel(Lens.name, {
            valueEncoding: "json",
        });
        this.contracts = this.localStorage.sublevel("contracts", {
            valueEncoding: "json",
        });
        this.trackedIds = this.localStorage.sublevel("trackedIds", {
            valueEncoding: "json",
        });
        this.addressToId = this.localStorage.sublevel("addressToId", {
            valueEncoding: "json",
        });
        this.seenPosts = this.localStorage.sublevel("crawledPosts", {
            valueEncoding: "json",
        });
    }
    async crawl(from, to, recrawl) {
        console.time(`${Lens.name} handlePostCreated: ${from}-${to}`);
        await this.handlePostCreated(from, to, recrawl);
        console.timeEnd(`${Lens.name} handlePostCreated: ${from}-${to}`);
        console.time(`${Lens.name} handleCollectNftDeployed: ${from}-${to}`);
        await this.handleCollectNftDeployed(from, to, recrawl);
        console.timeEnd(`${Lens.name} handleCollectNftDeployed: ${from}-${to}`);
        console.time(`${Lens.name} handleTransfer: ${from}-${to}`);
        await handleTransfer.call(this, from, to, recrawl);
        console.timeEnd(`${Lens.name} handleTransfer: ${from}-${to}`);
    }
    async handleCollectNftDeployed(from, to, recrawl) {
        const promises = [];
        const { getLogsBlockSpanSize, getLogsAddressSize } = this.config.chain[this.chain];
        const MAX_TOPICS = getLogsAddressSize;
        for (let i = from; i <= to; i += getLogsBlockSpanSize + 1) {
            const fromBlock = i;
            const toBlock = Math.min(to, i + getLogsBlockSpanSize);
            const iter = this.trackedIds.iterator();
            const pendingEnteries = [];
            while (true) {
                const entries = [...pendingEnteries, ...(await iter.nextv(MAX_TOPICS))];
                if (entries.length === 0) {
                    break;
                }
                // prepare topics filter. we have to take care of max topics.
                const profileIds = new Set();
                const pubIds = new Set();
                for (let j = 0; j < entries.length; j++) {
                    const [profileId, pubId] = entries[j][0].split("-");
                    if (profileIds.size >= MAX_TOPICS - 1 || pubIds.size >= MAX_TOPICS - 1) {
                        pendingEnteries.push(entries[j]);
                    }
                    else {
                        profileIds.add(profileId);
                        pubIds.add(pubId);
                    }
                }
                const promise = ethGetLogs
                    .call(this, fromBlock, toBlock, [
                    Lens.COLLECT_NFT_DEPLOYED,
                    Array.from(profileIds).map((i) => encodeParameters(["uint256"], [i])),
                    Array.from(pubIds).map((i) => encodeParameters(["uint256"], [i])),
                ], [Lens.LENS_HUB_ADDRESS])
                    .then(async (logs) => {
                    await Promise.all(logs.map(async (log) => {
                        if (!log.transactionHash || !log.blockNumber) {
                            throw new Error(`log doesn't contain the required fields: ${JSON.stringify(log, null, 2)}`);
                        }
                        const decodedTopics = decodeLog([
                            { indexed: true, name: "profileId", type: "uint256" },
                            { indexed: true, name: "pubId", type: "uint256" },
                            { indexed: true, name: "collectNFT", type: "address" },
                            { indexed: false, name: "timestamp", type: "uint256" },
                        ], log.data, log.topics.slice(1));
                        let { profileId, pubId, collectNFT } = decodedTopics;
                        collectNFT = collectNFT.toLowerCase();
                        try {
                            await this.trackedIds.get(`${profileId}-${pubId}`);
                        }
                        catch (err) {
                            if (err.code === "LEVEL_NOT_FOUND") {
                                // We have ignored this particular track but a combination of this
                                // profileId and pubId is present in topics that is why we are here
                                return;
                            }
                            throw err;
                        }
                        await this.contracts.put(collectNFT, {
                            name: Lens.name,
                            version: Lens.version,
                        });
                        await this.addressToId.put(collectNFT, `${this.chain}/${profileId}/${pubId}`);
                        await this.trackedIds.del(`${profileId}-${pubId}`);
                        const track = await tracksDB.getTrack(`${this.chain}/${profileId}/${pubId}`);
                        track.erc721.address = collectNFT; // We didn't have erc721.address at the time of crawl. Updating it now.
                        await tracksDB.upsertTrack(track);
                    }));
                });
                promises.push(promise);
            }
        }
        await Promise.all(promises);
    }
    async handlePostCreated(from, to, recrawl) {
        // We are searching for PostCreatedEvents and not directly for
        // CollectedNFTDeployed event because a song maybe posted that
        // does not have any collectors
        const _handlePostCreated = async (from, to, recrawl) => {
            const logs = await ethGetLogs.call(this, from, to, [Lens.POST_CREATED_EVENT_SELECTOR], [Lens.LENS_HUB_ADDRESS]);
            const posts = (await Promise.all(logs.map(async (log) => {
                if (!log.transactionHash || !log.blockNumber) {
                    throw new Error(`log doesn't contain the required fields: ${JSON.stringify(log, null, 2)}`);
                }
                if (Lens.ignoredTransactions.includes(log.transactionHash)) {
                    return null;
                }
                const decodedTopics = decodeLog([
                    { indexed: true, name: "profileId", type: "uint256" },
                    { indexed: true, name: "pubId", type: "uint256" },
                    { indexed: false, name: "contentURI", type: "string" },
                    { indexed: false, name: "collectModule", type: "address" },
                    { indexed: false, name: "collectModuleReturnData", type: "bytes" },
                    { indexed: false, name: "referenceModule", type: "address" },
                    { indexed: false, name: "referenceModuleReturnData", type: "bytes" },
                    { indexed: false, name: "timestamp", type: "uint256" },
                ], log.data, log.topics.slice(1));
                return {
                    profileId: parseInt(decodedTopics[0]),
                    pubId: parseInt(decodedTopics[1]),
                    contentURI: decodedTopics[2],
                    collectModule: decodedTopics[3],
                    collectModuleReturnData: decodedTopics[4],
                    referenceModule: decodedTopics[5],
                    referenceModuleReturnData: decodedTopics[6],
                    timestamp: parseInt(decodedTopics[7]),
                    blockNumber: parseInt(log.blockNumber),
                };
            }))).filter((post) => post !== null);
            await Promise.all(posts.map(async (post) => {
                let trackAlreadyPresent = await this.seenPosts
                    .get(`${post.profileId}-${post.pubId}`)
                    .then(() => true)
                    .catch(() => false);
                let track;
                try {
                    if (!recrawl && trackAlreadyPresent)
                        return;
                    track = await this.processPost(post);
                    await this.seenPosts.put(`${post.profileId}-${post.pubId}`, {});
                }
                catch (err) {
                    console.log(post);
                    throw err;
                }
                if (track) {
                    await tracksDB.upsertTrack(track);
                    await this.trackedIds.put(`${post.profileId}-${post.pubId}`, 1);
                    console.dir(track, { depth: null });
                }
            }));
        };
        const { getLogsBlockSpanSize } = this.config.chain[this.chain];
        const promises = [];
        for (let i = from; i <= to; i += getLogsBlockSpanSize + 1) {
            const fromBlock = i;
            const toBlock = Math.min(to, i + getLogsBlockSpanSize);
            promises.push(_handlePostCreated(fromBlock, toBlock, recrawl));
        }
        await Promise.all(promises);
    }
    async processPost(post) {
        // console.log("Processing new post with contentURI", post.contentURI);
        if (Lens.ignoredPosts.includes(`${post.profileId}-${post.pubId}`)) {
            console.log("This post is ignored; skipping");
            return null;
        }
        // Regex for valid URIs; from: https://github.com/ajv-validator/ajv-formats/blob/4dd65447575b35d0187c6b125383366969e6267e/src/formats.ts#L229C12
        const URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
        if (!post.contentURI || !URI.test(post.contentURI))
            return null;
        const protocol = getProtocol(post.contentURI);
        if (!protocol) {
            // console.log("Invalid protocol; skipping", post.contentURI);
            return null;
        }
        let datum;
        try {
            if (protocol === PROTOCOLS.arweave) {
                if (!/ar:\/\/[a-zA-Z0-9-_]{43}.*/.test(post.contentURI)) {
                    console.log(`Ignoring post id: ${post.profileId}-${post.pubId} because the content URI is invalid:`, post.contentURI);
                    return null;
                }
                datum = await getArweaveTokenUri(post.contentURI, this.worker, this.config);
            }
            else if (protocol === PROTOCOLS.ipfs) {
                datum = await getIpfsTokenUri.call(this, post.contentURI);
            }
            else if (protocol === PROTOCOLS.https) {
                datum = await fetchTokenUri(post.contentURI, this.worker);
            }
            else {
                throw new Error(`Invalid Protocol for ${post.contentURI}`);
            }
        }
        catch (err) {
            if (err.message.includes("status: 4") ||
                err.message.includes("Invalid CID") ||
                err.message.includes("ECONNREFUSED")) {
                return null;
            }
            throw err;
        }
        if (!datum || !datum.media || datum.version !== "2.0.0") {
            // console.log("No media; skipping", datum.media, datum.version);
            return null;
        }
        const media = datum.media.find?.((m) => m?.type?.includes("audio"));
        if (!media) {
            // console.log("No audio in media; skipping");
            return null;
        }
        const collectNftAdsress = (await getCollectNFT.call(this, post.profileId, post.pubId, post.blockNumber)).toLowerCase();
        const artistHandle = await getHandle.call(this, post.profileId, post.blockNumber);
        try {
            const schema = z.object({
                name: z.string(),
                content: z.string(),
                image: z.string().optional(),
            });
            schema.passthrough().parse(datum);
        }
        catch {
            // The required fields are not present in the metadata. Hence, ignoring it.
            return null;
        }
        const track = {
            version: Lens.version,
            title: datum.name,
            uid: `${this.chain}/${post.profileId}/${post.pubId}`,
            artist: {
                version: Lens.version,
                name: artistHandle,
                address: post.profileId.toString(),
            },
            platform: {
                version: Lens.version,
                name: Lens.name,
                uri: "https://lens.xyz",
            },
            erc721: {
                version: Lens.version,
                address: collectNftAdsress,
                tokens: [],
                metadata: {
                    ...datum,
                    name: datum.name,
                    description: datum.content,
                    image: datum.image,
                },
            },
            manifestations: [
                {
                    version: Lens.version,
                    uri: media.item,
                    mimetype: "audio",
                },
            ],
        };
        // datum.image can be undefined
        if (datum?.image)
            track.manifestations.push({
                version: Lens.version,
                uri: datum.image,
                mimetype: "image",
            });
        return track;
    }
}
Lens.version = "1.0.0";
// The lens hub was created at this block: https://polygonscan.com/tx/0xca69b18b7e2daf4695c6d614e263d6aa9bdee44bee91bee7e0e6e5e5e4262fca
Lens.createdAtBlock = 28384641;
Lens.LENS_HUB_ADDRESS = "0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d";
Lens.POST_CREATED_EVENT_SELECTOR = "0xc672c38b4d26c3c978228e99164105280410b144af24dd3ed8e4f9d211d96a50";
Lens.COLLECT_NFT_DEPLOYED = "0x0b227b550ffed48af813b32e246f787e99581ee13206ba8f9d90d63615269b3f";
Lens.TRANSFER_EVENT_SELECTOR = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// `${post.profileId}-${post.pubId}`
Lens.ignoredPosts = [
    "39133-682",
    "88863-16",
    "18497-28",
    "3834-24",
    "40863-4",
    "40635-1",
    "49754-2",
];
// The following transactions can't be decoded
Lens.ignoredTransactions = [
    "0x52c63367c36eb24a08654c89dc647267a9f1171af3962dafe5cefab31e21293d",
];
