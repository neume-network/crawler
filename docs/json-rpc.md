# JSON RPC Server

Using the daemon command neume creates a JSON RPC server which can be used to consume data. The following RPC methods are supported.

### `getIdsChanged_fill`

`getIdsChanged_fill` is a method that returns inserts/updates to the database in the given block range. Also see the ["How to consume the indexed data"](/Readme.md) section.

#### Example

Let's suppose a new NFT was minted at block number 16572314.

Curl
```bash
curl -X POST https://sync1.neume.network/ -H 'Content-Type: application/json' --data '
{
  "jsonrpc": "2.0",
  "method": "getIdsChanged_fill",
  "id": "1",
  "params": [
    16572314,
    16572314
  ]
}
'
```

The result is a list of NFTs that was inserted or updated at 16572314. In our case, the result contains only one NFT. If other NFTs were also minted or updated in this block we should see them in the result.

`id` is the ID given to the NFT and `value` is the NFT itself.
```js
[
  {
    id: {
      chainId: "1",
      address: "0xa6c4df945dbb1d71fe9a8d71ae93b8d5c2bbebe4",
      tokenId: "6975",
      blockNumber: 16572314,
    },
    value: {
      version: "2.0.0",
      title: "XYZ",
      artist: {
        version: "2.0.0",
        name: "Snoop Dogg",
        address: "0xE0036fb4B5A3B232aCfC01fEc3bD1D787a93da75",
      },
      platform: {
        version: "2.0.0",
        name: "Sound Protocol",
        uri: "https://sound.xyz",
      },
      erc721: {
        version: "2.0.0",
        createdAt: 16563504,
        transaction: {
          from: "0x59975dFE25845bF9C0eFf1102Ac650599c3f491a",
          to: "0x7Dd7fd8ACd39e557A6c570965eeA2b4008c4Dd1c",
          blockNumber: 16572314,
          transactionHash: "0xa80214bad12482943020cd539c099b45c2acc86373bd28d0173303d6042049c0",
        },
        address: "0xa6c4df945dbb1d71fe9a8d71ae93b8d5c2bbebe4",
        tokenId: "6975",
        tokenURI: "ar://T5aZ_6FYBIRnvMX7O6qbE4ZSEnysMlZbHhlnFmUvAMk/0",
        metadata: {
          animation_url: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          artist: "Snoop Dogg",
          artwork: {
            mimeType: "image/png",
            uri: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
            nft: null,
          },
          attributes: [
            {
              trait_type: "XYZ",
              value: "Song Edition",
            },
          ],
          bpm: null,
          credits: null,
          description:
            "Music OEs. Buy as many as U want\n\n.00420Ξ (8$)\u0003--> Open 72 Hours \n\nGonna give 1 of my vintage cars from tha compound 2 tha golden egg winner... Only If we hit 42,000 mints\n\nClaimable only in Inglewood California",
          duration: 129,
          external_url: "https://www.sound.xyz/snoopdogg/xyz",
          genre: "Hip-hop & Rap",
          image: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
          isrc: null,
          key: null,
          license: null,
          locationCreated: null,
          losslessAudio: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          lyrics: null,
          mimeType: "audio/mpeg",
          nftSerialNumber: null,
          name: "XYZ",
          originalReleaseDate: null,
          project: null,
          publisher: null,
          recordLabel: null,
          tags: null,
          title: "XYZ",
          trackNumber: 1,
          version: "sound-edition-20220930",
          visualizer: null,
        },
      },
      manifestations: [
        {
          version: "2.0.0",
          uri: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          mimetype: "audio",
        },
        {
          version: "2.0.0",
          uri: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
          mimetype: "image",
        },
      ],
    },
  },
];
```

Let's suppose the previously minted was NFT was transfered at block number 16572315 from `0x7Dd7fd8ACd39e557A6c570965eeA2b4008c4Dd1c` to `0x076D520333b2163C51897FAC8939a3606e5b4a95`. We will get the following updated NFT as the result.

Curl
```bash
curl -X POST https://sync1.neume.network/ -H 'Content-Type: application/json' --data '
{
  "jsonrpc": "2.0",
  "method": "getIdsChanged_fill",
  "id": "1",
  "params": [
    16572315,
    16572315
  ]
}
'
```

Notice, how the NFT is completely same with the execption of `value.erc721.transaction` as the NFT was transferred.
```js
[
  {
    id: {
      chainId: "1",
      address: "0xa6c4df945dbb1d71fe9a8d71ae93b8d5c2bbebe4",
      tokenId: "6975",
      blockNumber: 16572314,
    },
    value: {
      version: "2.0.0",
      title: "XYZ",
      artist: {
        version: "2.0.0",
        name: "Snoop Dogg",
        address: "0xE0036fb4B5A3B232aCfC01fEc3bD1D787a93da75",
      },
      platform: {
        version: "2.0.0",
        name: "Sound Protocol",
        uri: "https://sound.xyz",
      },
      erc721: {
        version: "2.0.0",
        createdAt: 16563504,
        /* Note: only the transaction object has changed */
        transaction: {
          from: "0x7Dd7fd8ACd39e557A6c570965eeA2b4008c4Dd1c",
          to: "0x076D520333b2163C51897FAC8939a3606e5b4a95",
          blockNumber: 16572315,
          transactionHash: "0xA3B232aCfC01fE943020cd539c099b45c2acc86373bd28d0173303d6042049c0",
        },
        address: "0xa6c4df945dbb1d71fe9a8d71ae93b8d5c2bbebe4",
        tokenId: "6975",
        tokenURI: "ar://T5aZ_6FYBIRnvMX7O6qbE4ZSEnysMlZbHhlnFmUvAMk/0",
        metadata: {
          animation_url: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          artist: "Snoop Dogg",
          artwork: {
            mimeType: "image/png",
            uri: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
            nft: null,
          },
          attributes: [
            {
              trait_type: "XYZ",
              value: "Song Edition",
            },
          ],
          bpm: null,
          credits: null,
          description:
            "Music OEs. Buy as many as U want\n\n.00420Ξ (8$)\u0003--> Open 72 Hours \n\nGonna give 1 of my vintage cars from tha compound 2 tha golden egg winner... Only If we hit 42,000 mints\n\nClaimable only in Inglewood California",
          duration: 129,
          external_url: "https://www.sound.xyz/snoopdogg/xyz",
          genre: "Hip-hop & Rap",
          image: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
          isrc: null,
          key: null,
          license: null,
          locationCreated: null,
          losslessAudio: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          lyrics: null,
          mimeType: "audio/mpeg",
          nftSerialNumber: null,
          name: "XYZ",
          originalReleaseDate: null,
          project: null,
          publisher: null,
          recordLabel: null,
          tags: null,
          title: "XYZ",
          trackNumber: 1,
          version: "sound-edition-20220930",
          visualizer: null,
        },
      },
      manifestations: [
        {
          version: "2.0.0",
          uri: "ar://_VUsZCeJQWVD4hFcgb5w39GqekARiN8ff-ptw63lH28",
          mimetype: "audio",
        },
        {
          version: "2.0.0",
          uri: "ar://gB04RsiCpgEbwxKs-tRh5gsycsUo-tGDdWQIkM51f6U",
          mimetype: "image",
        },
      ],
    },
  },
];
```

### `getUserContracts`

neume maintains a list of contracts that need to be crawled. Some of these contracts are hardcoded and others are found from on-chain data. `getUserContracts` returns the list of contracts found from on-chain data. This function is not required to consume indexed data. It is currently used for the _sync_ feature.

## JSON RPC Schema

The schema for the JSON RPC server can be found at [`/commands/daemon/daemon-jsonrpc-schema.js`](/commands/daemon/daemon-jsonrpc-schema.js).