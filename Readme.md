# Neume Crawler

> Crawl all music NFTs; supersedes
> [neume-network/core](https://github.com/neume-network/core). (Work in
> Progress)

## Usage

### Requirements

- Unix-like operating system
- Access to an archive node
- Access to an IPFS gateway
- Access to an Arweave gateway

### Setup

#### Create a new npm project

`npm init -y`

#### Install crawler as a dependency.

`npm install github:neume-network/crawler`

#### Initialize the project

`npx neume init`

The `init` command will create files and folders at the current working
directory. The files and folders are required by neume for its configuration and
data storage.

### Developement

Developers of neume can clone the repo and run the `init` command inside the
repo and start crawling.

```
node --loader ts-node/esm neume.ts init
```

In fact, all commands can be run using `ts-node`.

```
node --loader ts-node/esm neume.ts daemon
```

## Commands

This section provides a brief introduction of all the available commands. For
all the options supported by each command use the `--help` option.

- General help: `npx neume --help`
- Command specific help: `npx neume <command> --help`. For eg.
  `npx neume daemon --help`.

### `daemon`

The daemon starts crawling new NFTs from the last crawled block and listens for
JSON-RPC requests.

### `filter-contracts`

Neume includes a list of hardcoded contracts to be crawled. However, some
platforms use the factory pattern to create new contracts. `filter-contracts`
finds the new contracts to be crawled.

### `crawl`

Given a list of ERC721 contracts, neume will find all **NFTs** minted by the
given contracts in the given block range.

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
