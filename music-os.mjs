const version = "0.1.0";

export function musicOs(nfts) {
  nfts = Object.values(nfts);

  return nfts
    .map((nft) => {
      const datum = nft.erc721.tokens[0].tokenURIContent;

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
          tokenId: nft.erc721.tokens[0].id,
          address: nft.erc721.address,
          tokenURI: nft.erc721.tokens[0].tokenURI,
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
    })
    .reduce((tracks, track) => {
      const id = `${track.erc721.address}/${track.erc721.tokenId}`;
      tracks[id] = track;
      return tracks;
    }, {});
}
