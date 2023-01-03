/**
 * Note: Catalog (catalog.works) used to use Zora to mint music NFTs
 * Since, Zora is a marketplace we will find non-music NFTs which
 * we will have to filter.
 */
import { anyIpfsToNativeIpfs } from "ipfs-uri-utils";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
export default class Zora {
    constructor(worker, config) {
        this.worker = worker;
        this.config = config;
    }
    async crawl(nft) {
        nft.erc721.token.uri = await callTokenUri(this.worker, this.config, nft.erc721.blockNumber, nft);
        try {
            nft.erc721.token.uri = anyIpfsToNativeIpfs(nft.erc721.token.uri);
        }
        catch (err) {
            console.warn("Invalid tokenURI: Couldn't convert to IPFS URI. Ignoring the given track.", JSON.stringify(nft, null, 2));
            return null;
        }
        nft.metadata.uri = await callTokenUri(this.worker, this.config, nft.erc721.blockNumber, nft, {
            name: "tokenMetadataURI",
            type: "function",
            inputs: [
                {
                    name: "tokenId",
                    type: "uint256",
                },
            ],
        });
        try {
            nft.metadata.uri = anyIpfsToNativeIpfs(nft.metadata.uri);
        }
        catch (err) {
            console.warn("Invalid tokenURI: Couldn't convert to IPFS URI. Ignoring the given track.", JSON.stringify(nft, null, 2));
            return null;
        }
        nft.metadata.uriContent = await getIpfsTokenUri(nft.metadata.uri, this.worker, this.config);
        // Assumption that is specific to Catalog
        if (!nft.metadata.uriContent?.body?.version?.includes("catalog")) {
            return null;
        }
        const datum = nft.metadata.uriContent;
        const title = datum?.body?.title || datum?.name;
        const artist = datum?.body?.artist;
        const description = datum?.body?.notes;
        const artwork = datum?.body?.artwork?.info?.uri;
        let duration;
        if (datum.body && datum.body.duration) {
            duration = `PT${Math.floor(datum.body.duration / 60)}M${(datum.body.duration % 60).toFixed(0)}S`;
        }
        return {
            version: Zora.version,
            title,
            duration,
            artist: {
                version: Zora.version,
                name: artist,
            },
            platform: {
                version: Zora.version,
                name: "Catalog",
                uri: "https://catalog.works",
            },
            erc721: {
                version: Zora.version,
                createdAt: nft.erc721.blockNumber,
                owner: "0xhardcode",
                address: nft.erc721.address,
                tokenId: nft.erc721.token.id,
                tokenURI: nft.erc721.token.uri,
                metadata: {
                    ...datum,
                    name: title,
                    description,
                },
            },
            manifestations: [
                {
                    version: Zora.version,
                    uri: nft.erc721.token.uri,
                    mimetype: datum.body.mimeType,
                },
                {
                    version: Zora.version,
                    uri: artwork,
                    mimetype: "image",
                },
            ],
        };
    }
    updateOwner(nft) { }
}
Zora.version = "1.0.0";
Zora.createdAtBlock = 11996516; // First catalog song: https://etherscan.io/nft/0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7/1678
// Last song on Zora contract: https://beta.catalog.works/lucalush/velvet-girls
// https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fcatalog-prod.hasura.app%2Fv1%2Fgraphql&query=query+MyQuery+%7B%0A++tracks%28%0A++++where%3A+%7Bcontract_address%3A+%7B_iregex%3A+%220xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7%22%7D%7D%0A++++order_by%3A+%7Bcreated_at%3A+desc%7D%0A++%29+%7B%0A++++created_at%0A++++contract_address%0A++++short_url%0A++++title%0A++++nft_id%0A++%7D%0A%7D%0A
Zora.deprecatedAtBlock = null;
