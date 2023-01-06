import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { Config, Contract, NFT } from "../types.js";

export declare class Strategy {
  public static version: string;
  /**
   * Neume will not include the strategy in the crawl
   * if the range of the crawl is not included in between
   * createdAtBlock and deprecatedAtBlock, both inclusive.
   */
  public static createdAtBlock: number;
  /**
   * Neume will not include the strategy in the crawl
   * if the range of the crawl is not included in between
   * createdAtBlock and deprecatedAtBlock, both inclusive.
   */
  public static deprecatedAtBlock: number | null;

  constructor(worker: ExtractionWorkerHandler, config: Config);

  /**
   * Find new contracts to crawl for the given block range.
   * Particularly useful for factory patterns.
   *
   * @returns Array of new contracts found
   */
  filterContracts?: (from: number, to: number) => Promise<Contract[]>;

  /**
   * Given an incomplete NFT, query the blockchain to complete it.
   *
   * @returns A neume schema compatible track. null is returned if the
   * NFT needs to be skipped.
   */
  crawl: (nft: NFT) => Promise<Track | null>;

  updateOwner: (nft: NFT) => void;
}
