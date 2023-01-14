/**
 * Strategy to crawl Catalog songs on 0x0bC2A24ce568DAd89691116d5B34DEB6C203F342.
 * Also known as Catalog V2 as they used to use Zora initially.
 */
import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { randomItem } from "../utils.js";
export default class CatalogV2 {
    constructor(worker, config) {
        this.crawl = async (nft) => {
            console.log("crawling catalog");
            nft.erc721.token.uri = await callTokenUri(this.worker, this.config, nft.erc721.blockNumber, nft);
            try {
                nft.erc721.token.uriContent = await getIpfsTokenUri(nft.erc721.token.uri, this.worker, this.config);
            }
            catch (err) {
                if (err.message.includes("Invalid CID")) {
                    console.warn("Invalid CID: Ignoring the given track.", JSON.stringify(nft, null, 2));
                    return null;
                }
                throw err;
            }
            nft.creator = await this.callCreator(nft.erc721.address, nft.erc721.blockNumber, nft.erc721.token.id);
            const datum = nft.erc721.token.uriContent;
            let duration;
            if (datum?.duration) {
                duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
            }
            return {
                version: CatalogV2.version,
                title: datum.title,
                duration,
                artist: {
                    version: CatalogV2.version,
                    name: datum.artist,
                    address: nft.creator,
                },
                platform: {
                    version: CatalogV2.version,
                    name: "Catalog",
                    uri: "https://catalog.works",
                },
                erc721: {
                    // TODO: Stop hard coding this value
                    owner: "0x489e043540ff11ec22226ca0a6f6f8e3040c7b5a",
                    version: CatalogV2.version,
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
                        version: CatalogV2.version,
                        uri: datum.image,
                        mimetype: "image",
                    },
                    {
                        version: CatalogV2.version,
                        uri: datum.losslessAudio,
                        mimetype: datum.mimeType,
                    },
                ],
            };
        };
        this.callCreator = async (to, blockNumber, tokenId) => {
            const rpc = randomItem(this.config.rpc);
            const data = encodeFunctionCall({
                name: "creator",
                type: "function",
                inputs: [
                    {
                        type: "uint256",
                        name: "_tokenId",
                    },
                ],
            }, [tokenId]);
            const msg = await this.worker({
                type: "json-rpc",
                commissioner: "",
                version: "0.0.1",
                method: "eth_call",
                options: {
                    url: rpc.url,
                    retry: {
                        retries: 3,
                    },
                },
                params: [
                    {
                        to,
                        data,
                    },
                    toHex(blockNumber),
                ],
            });
            if (msg.error)
                throw new Error(`Error while calling owner on contract: ${to} ${JSON.stringify(msg, null, 2)}`);
            const creator = decodeParameters(["address"], msg.results)[0];
            if (typeof creator !== "string")
                throw new Error(`typeof owner invalid ${JSON.stringify(msg, null, 2)}`);
            return creator;
        };
        this.worker = worker;
        this.config = config;
    }
    updateOwner(nft) { }
}
CatalogV2.version = "2.0.0";
CatalogV2.createdAtBlock = 0;
CatalogV2.deprecatedAtBlock = null;
