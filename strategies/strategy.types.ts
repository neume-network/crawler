import { ExtractionWorkerHandler } from "@neume-network/extraction-worker";
import { Track } from "@neume-network/schema";
import { Config, Contract, NFT } from "../types";

export declare class Strategy {
  public name: string;
  constructor(worker: ExtractionWorkerHandler, config: Config);
  filterContracts: (from: number, to: number) => Promise<Contract[]>;
  crawl: (nft: NFT) => Promise<Track>;
}
