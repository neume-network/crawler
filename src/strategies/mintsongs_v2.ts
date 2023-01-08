/**
 * Strategy to crawl MintSongs V2 songs at 0x2b5426a5b98a3e366230eba9f95a24f09ae4a584.
 *
 * MintSongs also has a NFT collection on Polygon. The collection on Ethereum is known
 * as MintSongsV2.
 *
 * MintSongsV2 no longer mints new songs as of Sept 2022.
 * Last mint: https://etherscan.io/tx/0xccc0e691a5a509e731e76f2218f70637ed90edc1752015c4ba94fc01a205f761
 */

import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { callTokenUri } from "../components/call-tokenuri.js";
import { getIpfsTokenUri } from "../components/get-ipfs-tokenuri.js";
import { Config, NFT } from "../types.js";
import { Strategy } from "./strategy.types.js";

export default class MintSongsV2 implements Strategy {
  public static version = "2.0.0";
  public static createdAtBlock = 0;
  public static deprecatedAtBlock = null;
  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  crawl = async (nft: NFT) => {
    nft.erc721.token.uri = await callTokenUri(
      this.worker,
      this.config,
      nft.erc721.blockNumber,
      nft
    );
    nft.erc721.token.uriContent = await getIpfsTokenUri(
      nft.erc721.token.uri,
      this.worker,
      this.config
    );

    const datum = nft.erc721.token.uriContent;

    let duration;
    if (datum?.duration) {
      duration = `PT${Math.floor(datum.duration / 60)}M${(
        datum.duration % 60
      ).toFixed(0)}S`;
    }

    return {
      version: MintSongsV2.version,
      title: datum.title,
      duration,
      artist: {
        version: MintSongsV2.version,
        name: datum.artist,
      },
      platform: {
        version: MintSongsV2.version,
        name: "Mint Songs",
        uri: "https://www.mintsongs.com/",
      },
      erc721: {
        // TODO: Remove hardcoded owner value
        owner: "0x681452d95caef97a88d25a452dc1bc2b62d7f134",
        version: MintSongsV2.version,
        createdAt: nft.erc721.blockNumber,
        tokenId: nft.erc721.token.id,
        address: nft.erc721.address,
        tokenURI: nft.erc721.token.uri,
        metadata: {
          ...datum,
          name: datum.title,
          description: datum.description,
          image: datum.image,
        },
      },
      manifestations: [
        {
          version: MintSongsV2.version,
          uri: datum.losslessAudio,
          mimetype: datum.mimeType,
        },
        {
          version: MintSongsV2.version,
          uri: datum.artwork.uri,
          mimetype: datum.artwork.mimeType,
        },
      ],
    };
  };

  updateOwner(nft: NFT) {}
}
