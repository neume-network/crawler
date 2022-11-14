import { decodeLog } from "eth-fun";
import { callTokenUri } from "../components/call-tokenuri.mjs";
import { getTokenUri } from "../components/get-tokenuri.mjs";

export const editionCreatedSelector =
  "0x405098db99342b699216d8150e930dbbf2f686f5a43485aed1e69219dafd4935";

export function isSoundProtocolCreateEvent(log) {
  if (log.topics[0] === editionCreatedSelector) {
    return true;
  }
}

export function extractSoundProtocolContract(log) {
  const topics = log.topics;
  topics.shift();
  const result = decodeLog(
    [
      {
        type: "address",
        name: "soundEdition",
        indexed: true,
      },
      {
        type: "address",
        name: "deployer",
        indexed: true,
      },
      {
        type: "bytes",
        name: "initData",
      },
      {
        type: "address[]",
        name: "contracts",
      },
      {
        type: "bytes[]",
        name: "data",
      },
      {
        type: "bytes[]",
        name: "results",
      },
    ],
    log.data,
    topics
  );
  return result.soundEdition.toLowerCase();
}

export async function crawl(nft) {
  await callTokenUri(nft);
  await getTokenUri(nft);

  const datum = nft.erc721.token.tokenURIContent;

  return {
    version,
    title: datum.name,
    artist: {
      version,
      name: datum.artist,
    },
    platform: {
      version,
      name: "Sound Protocol",
      uri: "https://sound.xyz",
    },
    erc721: {
      version,
      // TODO: Stop hard coding this value
      // owner: "0x4456AE02EA5534cEd3A151e41a715bBA685A7CAb",
      createdAt: nft.erc721.createdAt,
      tokenId: nft.erc721.token.id,
      address: nft.erc721.address,
      tokenURI: nft.erc721.token.tokenURI,
      metadata: {
        ...datum,
      },
    },
    manifestations: [
      {
        version,
        uri: datum.losslessAudio,
        mimetype: "audio",
      },
      {
        version,
        uri: datum.image,
        mimetype: "image",
      },
    ],
  };
}
