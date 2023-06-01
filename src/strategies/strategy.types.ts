import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { AbstractSublevel } from "abstract-level";
import { Level } from "level";
import { CHAINS, Config, Contract, NFT } from "../types.js";

export declare class Strategy {
  public static version: string;

  // We have both static and non-static variable. Both should be equal.
  // static is used to get chain without initialising the class (eg. ClassName.chain)
  // non-static is used for `this.chain`
  // public static chain: keyof typeof CHAINS;
  public chain: keyof typeof CHAINS;
  /**
   * Neume will not include the strategy in the crawl
   * if the range of the crawl is not included in between
   * createdAtBlock and deprecatedAtBlock, both inclusive.
   */
  public createdAtBlock: number;
  /**
   * Neume will not include the strategy in the crawl
   * if the range of the crawl is not included in between
   * createdAtBlock and deprecatedAtBlock, both inclusive.
   */
  public deprecatedAtBlock: number | null;
  public worker: ExtractionWorkerHandler;
  public config: Config;
  public localStorage: AbstractSublevel<
    Level<string, any>,
    string | Buffer | Uint8Array,
    string,
    any
  >;

  constructor(worker: ExtractionWorkerHandler, config: Config);

  /**
   * This is the entrypoint for the strategy. It will be called periodically
   * with newer block numbers.
   *
   * @argument recrawl: If true, process all data even if it has been processed before
   */
  crawl: (from: number, to: number, recrawl: boolean) => Promise<void>;

  nftToUid: (nft: NFT) => Promise<string>;
}

export declare class ERC721Strategy extends Strategy {
  fetchMetadata: (nft: NFT) => Promise<Track | null>;
}
