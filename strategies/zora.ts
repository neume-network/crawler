// @ts-nocheck

/**
 * Note: The platform Catalog used to use Zora to mint music NFTs
 * Since, Zora is a marketplace we will find non-music NFTs which
 * we will have to filter after crawl.
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { anyIpfsToNativeIpfs } from "ipfs-uri-utils";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { NFT, Config } from "../types.js";

import { Strategy } from "./strategy.types.js";

export default class Zora implements Strategy {
  public static version = "1.0.0";
  public static createdAtBlock = 11565020;
  public static deprecatedAtBlock = null;
  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  async crawl(nft: NFT) {
    nft = await callTokenUri(
      this.worker,
      this.config,
      nft.erc721.blockNumber,
      nft
    );

    if (!nft.erc721.token.uri)
      throw new Error(
        `tokenURI shouldn't be empty ${JSON.stringify(nft, null, 2)}`
      );

    nft.erc721.token.uri = anyIpfsToNativeIpfs(nft.erc721.token.uri);

    nft = await getIpfsTokenUri(nft);

    if (!nft.erc721.token.uriContent)
      throw new Error(
        `tokenURI content shouldn't be empty ${JSON.stringify(nft, null, 2)}`
      );

    const datum = nft.erc721.token.uriContent;

    const title = datum?.body?.title || datum?.name;
    const artist = datum?.body?.artist;
    const description = datum?.body?.notes;
    const artwork = datum?.body?.artwork?.info?.uri;
    let duration;
    if (datum.body && datum.body.duration) {
      duration = `PT${Math.floor(datum.body.duration / 60)}M${(
        datum.body.duration % 60
      ).toFixed(0)}S`;
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
