# Neume Crawler

> Crawl all music NFTs; supersede [neume-network/core](https://github.com/neume-network/core). (Work in Progress)

## Usage

- Install dependencies: `npm install`
- Configure the project:
  - Configure RPC, IPFS endpoints etc. by copying the `.env` and adding the required values
    `cp .env-copy .env`
  - Configure timeout and rate limit the calls by changing the value in [`/config.ts`](/config.ts).

### Production
- Build the project: `npm run build`
- Run the project: `npm run start -- <CLI options>`. Example: `npm run start -- crawl --from 16029571 --to 16079363`.

### Developement

- Run the project: `node --loader ts-node/esm neume.mjs <CLI options>`. Example: `node --loader ts-node/esm neume.mjs crawl --from 16029571 --to 16079363`.

## Commands

All commands require a from (`--from`) and to (`--to`) block number.

### `filter-contracts`

Neume includes a list of hardcoded contracts to be crawled. However, some platforms use the factory pattern to create new contracts. `filter-contracts` finds the new contracts to be crawled.

### `crawl`

Given a list of ERC721 contracts, Neume will find all **NFTs** minted by the given contracts in the given block range.

## Architecture Overview

Neume heavily depends on a RPC node and avoids centralized servers.

### Pseudocode for crawl command

```c
from = process.argv[2]
to = process.argv[4]

constracts = import('./contracts.json')

for contract in contracts:
  // use eth_getLog to find all transfer events
  // in the given block range
  logs = getLogs(Transfer, from ,to)
  for log in logs:
    nft = {}
    // extract tokenId from log
    nft.tokenId = decodeLog(log)
    // use eth_call to get 
    nft.tokenUri = callTokenUri(tokenId)
    // get the data behind the tokenURI
    nft.tokenUriContent = getTokenUri(tokenUri)
    // transform all the collected data according
    // to neume schema
    nft = transform(nft)

    saveToDB(nft)
```

