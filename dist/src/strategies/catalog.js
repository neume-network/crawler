// @ts-nocheck
// This file is incomplete
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
export async function crawl(nft) {
    console.log("crawling catalog");
    await callTokenUri(nft);
    await getIpfsTokenUri(nft);
    const datum = nft.erc721.token.tokenURIContent;
    const version = "2.0.0";
    let duration;
    if (datum?.duration) {
        duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
    }
    return {
        version,
        title: datum.title,
        duration,
        artist: {
            version,
            name: datum.artist,
        },
        platform: {
            version,
            name: "Catalog",
            uri: "https://beta.catalog.works",
        },
        erc721: {
            // TODO: Stop hard coding this value
            owner: "0x489e043540ff11ec22226ca0a6f6f8e3040c7b5a",
            version,
            createdAt: nft.erc721.createdAt,
            tokenId: nft.erc721.token.id,
            address: nft.erc721.address,
            tokenURI: nft.erc721.token.tokenURI,
            metadata: {
                ...datum,
                name: datum.name,
                description: datum.description,
            },
        },
        manifestations: [
            {
                version,
                uri: datum.image,
                mimetype: "image",
            },
            {
                version,
                uri: datum.losslessAudio,
                mimetype: datum.mimeType,
            },
        ],
    };
}
