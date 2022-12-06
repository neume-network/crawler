import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { Config, Contract, NFT } from "../types";

export declare class Strategy {
  public name: string;
  constructor(worker: ExtractionWorkerHandler, config: Config);

  /**
   * Find new contracts to crawl for the given block range.
   * Particularly useful for factory patterns.
   *
   * @returns Array of new contracts found
   */
  filterContracts: (from: number, to: number) => Promise<Contract[]>;

  /**
   * Given an incomplete NFT, query the blockchain to complete it.
   *
   * @returns A neume schema compatible track
   */
  crawl: (nft: NFT) => Promise<Track>;
}
