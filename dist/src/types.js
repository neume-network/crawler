export var CHAINS;
(function (CHAINS) {
    CHAINS["eth"] = "eth";
    CHAINS["polygon"] = "polygon";
})(CHAINS = CHAINS || (CHAINS = {}));
export var PROTOCOLS;
(function (PROTOCOLS) {
    PROTOCOLS["arweave"] = "arweave";
    PROTOCOLS["https"] = "https";
    PROTOCOLS["ipfs"] = "ipfs";
})(PROTOCOLS = PROTOCOLS || (PROTOCOLS = {}));
export const CONSTANTS = {
    DATA_DIR: "data",
    STATE: {
        LAST_SYNC: "last_synced_block",
        LAST_CRAWL: "last_crawled_block",
    },
    FIRST_BLOCK: {
        [CHAINS.eth]: 11000000,
        [CHAINS.polygon]: 11000000,
    },
};
