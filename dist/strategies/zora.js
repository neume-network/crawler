// @ts-nocheck
import { anyIpfsToNativeIpfs } from "ipfs-uri-utils";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
export default class Zora {
    constructor(worker, config) {
        this.worker = worker;
        this.config = config;
    }
    async crawl(nft) {
        nft = await callTokenUri(this.worker, this.config, nft.erc721.createdAt, nft);
        if (!nft.erc721.token.uri)
            throw new Error(`tokenURI shouldn't be empty ${JSON.stringify(nft, null, 2)}`);
        nft.erc721.token.uri = anyIpfsToNativeIpfs(nft.erc721.token.uri);
        nft = await getIpfsTokenUri(nft);
        if (!nft.erc721.token.uriContent)
            throw new Error(`tokenURI content shouldn't be empty ${JSON.stringify(nft, null, 2)}`);
        const datum = nft.erc721.token.uriContent;
        const title = datum?.body?.title || datum?.name;
        const artist = datum?.body?.artist;
        const description = datum?.body?.notes;
        const artwork = datum?.body?.artwork?.info?.uri;
        let duration;
        if (datum.body && datum.body.duration) {
            duration = `PT${Math.floor(datum.body.duration / 60)}M${(datum.body.duration % 60).toFixed(0)}S`;
        }
        return JSON.stringify({
            version,
            title,
            duration,
            artist: {
                version,
                name: artist,
            },
            platform: {
                version,
                name: "Catalog",
                uri: "https://beta.catalog.works",
            },
            erc721: {
                version,
                // TODO
                //address: nft[1],
                //tokenId: nft[2],
                tokenURI: metadata.tokenURI,
                metadata: {
                    ...datum,
                    name: title,
                    description,
                },
            },
            manifestations: [
                {
                    version,
                    // TODO: Zora's file URL can be retrieved when calling tokenURI
                    //uri: "https://example.com/file",
                    //mimetype: datum.body.mimeType,
                },
                {
                    version,
                    uri: artwork,
                    mimetype: "image",
                },
            ],
        });
    }
}
Zora.version = "1.0.0";
Zora.createdAtBlock = 11565020;
Zora.deprecatedAtBlock = null;
