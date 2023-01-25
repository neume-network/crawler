import { ExtractionWorkerHandler } from '@neume-network/extraction-worker';
import { decodeLog, toHex } from 'eth-fun';
import { callTokenUri } from '../components/call-tokenuri.js';
import { fetchTokenUri } from '../components/fetch-tokenuri.js';
import { callOwner } from '../components/call-owner.js';

import { Config, JsonRpcLog, NFT } from '../types.js';
import { Strategy } from './strategy.types.js';
import { randomItem, ifIpfsConvertToNativeIpfs } from '../utils.js';

// Instead of querying at the block number soundxyz NFT
// was minted, we query at a higher block number because
// soundxyz changed their tokenURI and the previous one
// doesn't work anymore. https://github.com/neume-network/data/issues/19
//
// createdAtBlock           13725566 (https://etherscan.io/tx/0xfa325f74eb6c7f5e6bb60a264404543d6158f79de01bc5aab35180354e554dce)
// workingAfterBlockNumber  15050010

export default class Sound implements Strategy {
  public static version = '1.0.0';
  public static createdAtBlock = 15050010;
  public static deprecatedAtBlock = null;
  public static invalidIDs = [];

  private worker: ExtractionWorkerHandler;
  private config: Config;

  constructor(worker: ExtractionWorkerHandler, config: Config) {
    this.worker = worker;
    this.config = config;
  }

  filterContracts = async (from: number, to: number) => {
    const artistCreatedSelector =
      '0x23748b43b77f98380e738976c6324996908ffc1989994dd3c68631c87a65a7c0';

    const rpcHost = randomItem(this.config.rpc);
    const options = {
      url: rpcHost.url,
      headers: {
        ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
      },
      retry: {
        retries: 3,
      },
    };

    const fromBlock = toHex(from);
    const toBlock = toHex(to);

    const message = await this.worker({
      type: 'json-rpc',
      method: 'eth_getLogs',
      commissioner: Sound.name,
      params: [
        {
          fromBlock,
          toBlock,
          topics: [[artistCreatedSelector]],
        },
      ],
      version: '0.0.1',
      options,
    });

    if (message.error) {
      throw new Error(
        `Error occured while filtering ${Sound.name} contracts: \n${JSON.stringify(
          message,
          null,
          2,
        )}`,
      );
    }

    const logs = message.results as any as Array<JsonRpcLog>;

    const l = logs.map((log) => {
      const topics = log.topics;
      topics.shift();
      const result = decodeLog(
        [
          {
            type: 'uint256',
            name: 'artistId',
          },
          {
            type: 'string',
            name: 'name',
          },
          {
            type: 'string',
            name: 'symbol',
          },
          {
            type: 'address',
            name: 'artistAddress',
            indexed: true,
          },
        ],
        log.data,
        topics,
      );
      return {
        address: result.artistAddress.toLowerCase(),
        name: Sound.name,
        version: Sound.version,
      };
    });

    console.log(l);

    return l;
  };

  crawl = async (nft: NFT) => {
    if (
      Sound.invalidIDs.filter((id) => `${nft.erc721.address}/${nft.erc721.token.id}`.match(id))
        .length != 0
    ) {
      console.log(
        `Ignoring ${nft.erc721.address}/${nft.erc721.token.id} because it is blacklisted`,
      );
      return null;
    }

    nft.erc721.token.uri = await callTokenUri(
      this.worker,
      this.config,
      nft.erc721.blockNumber,
      nft,
    );

    nft.erc721.token.uriContent = await fetchTokenUri(nft.erc721.token.uri, this.worker);

    nft.creator = await callOwner(
      this.worker,
      this.config,
      nft.erc721.address,
      nft.erc721.blockNumber,
    );

    console.log('nft', nft);

    const datum = nft.erc721.token.uriContent;

    let duration;
    if (datum?.duration) {
      duration = `PT${Math.floor(datum.duration / 60)}M${(datum.duration % 60).toFixed(0)}S`;
    }

    return {
      version: Sound.version,
      title: datum.name,
      artist: {
        version: Sound.version,
        name: datum.artist_name,
        address: nft.creator,
      },
      platform: {
        version: Sound.version,
        name: 'Sound',
        uri: 'https://sound.xyz',
      },
      erc721: {
        version: Sound.version,
        createdAt: nft.erc721.blockNumber,
        // TODO: Stop hard coding this value
        owner: '0x4456AE02EA5534cEd3A151e41a715bBA685A7CAb',
        address: nft.erc721.address,
        tokenId: nft.erc721.token.id,
        tokenURI: nft.erc721.token.uri,
        metadata: {
          ...datum,
          name: datum.name,
          description: datum.description,
          image: datum.image,
        },
      },
      manifestations: [
        {
          version: Sound.version,
          uri: ifIpfsConvertToNativeIpfs(datum.audio_url),
          mimetype: 'audio',
        },
        {
          version: Sound.version,
          uri: ifIpfsConvertToNativeIpfs(datum.image),
          mimetype: 'image',
        },
        {
          version: Sound.version,
          uri: ifIpfsConvertToNativeIpfs(datum.animation_url),
          mimetype: 'image',
        },
      ],
    };
  };

  updateOwner(nft: NFT) {}
}
