/**
 * Strategy to crawl Noizd songs at 0xf5819e27b9bad9f97c177bf007c1f96f26d91ca6.
 *
 * Noizd also has a NFT collection on Polygon. The collection on Ethereum is known
 * as Noizd.
 *
 */
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
export default class Noizd {
    constructor(worker, config) {
        this.crawl = async (nft) => {
            nft.erc721.token.uri = await callTokenUri(this.worker, this.config, nft.erc721.blockNumber, nft);
            try {
                nft.erc721.token.uriContent = await getIpfsTokenUri(nft.erc721.token.uri, this.worker, this.config);
            }
            catch (err) {
                if (err.message.includes("Invalid CID")) {
                    console.warn("Invalid CID: Ignoring the given track.", JSON.stringify(nft, null, 2));
                    return null;
                }
                if (err.message.includes("504") || err.message.includes("AbortError")) {
                    console.warn("Couldn't find CID on the IPFS network: Ignoring NFT", JSON.stringify(nft, null, 2));
                    return null;
                }
                throw err;
            }
            const datum = nft.erc721.token.uriContent;
            let duration;
            if (datum?.duration) {
                duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
            }
            return {
                version: Noizd.version,
                title: datum.name,
                duration,
                artist: {
                    version: Noizd.version,
                    name: datum.artist_name,
                    address: datum.artist_address,
                },
                platform: {
                    version: Noizd.version,
                    name: "Noizd",
                    uri: "https://noizd.com",
                },
                erc721: {
                    transaction: {
                        from: nft.erc721.transaction.from,
                        to: nft.erc721.transaction.to,
                        blockNumber: nft.erc721.transaction.blockNumber,
                        transactionHash: nft.erc721.transaction.transactionHash,
                    },
                    version: Noizd.version,
                    createdAt: nft.erc721.blockNumber,
                    tokenId: nft.erc721.token.id,
                    address: nft.erc721.address,
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
                        version: Noizd.version,
                        uri: datum.audio_url,
                        mimetype: "audio",
                    },
                    {
                        version: Noizd.version,
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
Noizd.version = "1.0.0";
// Oldest NFT mint found using OpenSea: https://etherscan.io/tx/0x9cd2b56dadc49a3c6ddb5f130de9c932a78a0ccb21c930ab978ce51cc5819901
Noizd.createdAtBlock = 13493464;
Noizd.deprecatedAtBlock = null;
