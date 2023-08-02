import { Track } from "@neume-network/schema";
import test from "ava";
import runMigration from "./runMigration.js";
import { tracksDB } from "./tracks.js";

test.beforeEach(async (t) => {
  await runMigration("up");
  await runMigration("down");
  await runMigration("up");
});

const sample = [
  {
    version: "1.0.0",
    title: "Blast",
    uid: "polygon/106643/194",
    duration: "PT05S",
    artist: { version: "1.0.0", name: "jburn.lens", address: "106643" },
    platform: { version: "1.0.0", name: "Lens", uri: "https://lens.xyz" },
    erc721: {
      version: "1.0.0",
      tokens: [
        {
          id: "1",
          uri: null,
          metadata: null,
          owners: [
            {
              from: "0x0000000000000000000000000000000000000000",
              to: "0x77a395A6f7c6E91192697Abb207ea3c171F4B338",
              blockNumber: 41988367,
              transactionHash: "0xd622364913527f2d19ac5a09cba872df88a1bc8d37661bccac98ec2d38130787",
              alias: "n0madz.lens",
            },
          ],
        },
      ],
      address: "0xe8ebad85fe7eb36ed5b6f12ac95048c7d9bff15b",
      uri: "ar://BCfUm5TsFP8VPpRtxtJq8Ue7mm_L-hhldRo3XrD-8Ck",
      metadata: {
        version: "2.0.0",
        metadata_id: "dfa5863d-b325-47f4-93c7-d8af3d12e48e",
        content:
          "1 Wmatic to collect\n" +
          "25% referral reward\n" +
          "Nonexclusive Unlimited Usage Rights for owners\n" +
          "\n" +
          "Thanks everyone for the support on the beats lately, its been inspirational.",
        external_url: "https://beatsapp.xyz/profile/jburn.lens",
        image: "ipfs://bafybeieiuz7xqlrs4aq7gfd3h2ttkt5sjjw43dm57xk3cmpneeiadql4qa",
        imageMimeType: "image/png",
        name: "Blast",
        tags: ["Song", ""],
        animation_url: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
        mainContentFocus: "AUDIO",
        contentWarning: null,
        attributes: [
          { traitType: "type", displayType: "string", value: "audio" },
          { traitType: "genre", displayType: "string", value: "" },
          { traitType: "author", displayType: "string", value: "Jburn" },
        ],
        media: [
          {
            type: "audio/mpeg",
            altTag: "Audio file",
            item: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
          },
        ],
        locale: "en",
        appId: "beats",
        description:
          "1 Wmatic to collect\n" +
          "25% referral reward\n" +
          "Nonexclusive Unlimited Usage Rights for owners\n" +
          "\n" +
          "Thanks everyone for the support on the beats lately, its been inspirational.",
      },
    },
    manifestations: [
      {
        version: "1.0.0",
        uri: "ipfs://bafybeieiuz7xqlrs4aq7gfd3h2ttkt5sjjw43dm57xk3cmpneeiadql4qa",
        mimetype: "image",
      },
      {
        version: "1.0.0",
        uri: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
        mimetype: "audio",
      },
    ],
  },
  {
    version: "1.0.0",
    title: "Blast",
    uid: "polygon/9999/0011",
    duration: "PT05S",
    artist: { version: "1.0.0", name: "jburn.lens", address: "106643" },
    platform: { version: "1.0.0", name: "Lens", uri: "https://lens.xyz" },
    erc721: {
      version: "1.0.0",
      tokens: [
        {
          id: "1",
          uri: null,
          metadata: null,
          owners: [
            {
              from: "0x0000000000000000000000000000000000000000",
              to: "0x77a395A6f7c6E91192697Abb207ea3c171F4B338",
              blockNumber: 41988367,
              transactionHash: "0xd622364913527f2d19ac5a09cba872df88a1bc8d37661bccac98ec2d38130787",
              alias: "n0madz.lens",
            },
          ],
        },
      ],
      address: "0xe8ebad85fe7eb36ed5b6f12ac95048c7d9bff15b",
      uri: "ar://BCfUm5TsFP8VPpRtxtJq8Ue7mm_L-hhldRo3XrD-8Ck",
      metadata: {
        version: "2.0.0",
        metadata_id: "dfa5863d-b325-47f4-93c7-d8af3d12e48e",
        content:
          "1 Wmatic to collect\n" +
          "25% referral reward\n" +
          "Nonexclusive Unlimited Usage Rights for owners\n" +
          "\n" +
          "Thanks everyone for the support on the beats lately, its been inspirational.",
        external_url: "https://beatsapp.xyz/profile/jburn.lens",
        image: "ipfs://bafybeieiuz7xqlrs4aq7gfd3h2ttkt5sjjw43dm57xk3cmpneeiadql4qa",
        imageMimeType: "image/png",
        name: "Blast",
        tags: ["Song", ""],
        animation_url: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
        mainContentFocus: "AUDIO",
        contentWarning: null,
        attributes: [
          { traitType: "type", displayType: "string", value: "audio" },
          { traitType: "genre", displayType: "string", value: "" },
          { traitType: "author", displayType: "string", value: "Jburn" },
        ],
        media: [
          {
            type: "audio/mpeg",
            altTag: "Audio file",
            item: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
          },
        ],
        locale: "en",
        appId: "beats",
        description:
          "1 Wmatic to collect\n" +
          "25% referral reward\n" +
          "Nonexclusive Unlimited Usage Rights for owners\n" +
          "\n" +
          "Thanks everyone for the support on the beats lately, its been inspirational.",
      },
    },
    manifestations: [
      {
        version: "1.0.0",
        uri: "ipfs://bafybeieiuz7xqlrs4aq7gfd3h2ttkt5sjjw43dm57xk3cmpneeiadql4qa",
        mimetype: "image",
      },
      {
        version: "1.0.0",
        uri: "ipfs://bafybeifgvqlonwa3m3rzgdzdix34ob57bap56fmiypsujewm74jruoonli",
        mimetype: "audio",
      },
    ],
  },
];

test.serial("should be able to add new track", async (t) => {
  await tracksDB.upsertTrack(sample[0], 0);
  const ret = await tracksDB.getTrack(sample[0].uid);
  t.like(ret, sample[0]);
});

test.serial("should be able to add owner", async (t) => {
  await tracksDB.upsertTrack(sample[0], 0);
  const newOwner = {
    from: "0x77a395A6f7c6E91192697Abb207ea3c171F4B338",
    to: "0xAc177a395A6f7c6E91192bb207ea369771F4B338",
    blockNumber: 1,
    transactionHash: "0xd622364913527f2d19ac5a09cba872df88a1bc8d37661bccac98ec2d38130787",
    alias: "neume.lens",
  };
  await tracksDB.upsertOwner(sample[0].uid, "1", newOwner, "neume", 1);
  const ret = await tracksDB.getTrack(sample[0].uid);
  const retToken = ret.erc721.tokens.find((t) => t.id === "1");

  t.deepEqual(retToken?.owners, [
    ...(sample[0].erc721.tokens.find((t) => t.id === "1")?.owners ?? []),
    newOwner,
  ]);
});

test.serial("should be able to get changed tracks", async (t) => {
  await tracksDB.upsertTrack(sample[0], 0);
  await tracksDB.upsertTrack(sample[1], 5);

  let { tracks } = await tracksDB.getTracksChanged(0, sample[0].platform.name);
  t.is(tracks.length, 2);
  t.deepEqual(tracks[0], sample[0]);

  ({ tracks } = await tracksDB.getTracksChanged(5, sample[0].platform.name));
  t.is(tracks.length, 1);
  t.deepEqual(tracks[0], sample[1]);

  ({ tracks } = await tracksDB.getTracksChanged(6, sample[1].platform.name));
  t.is(tracks.length, 0);

  const newOwner = {
    from: "0x77a395A6f7c6E91192697Abb207ea3c171F4B338",
    to: "0xAc177a395A6f7c6E91192bb207ea369771F4B338",
    blockNumber: 1,
    transactionHash: "0xd622364913527f2d19ac5a09cba872df88a1bc8d37661bccac98ec2d38130787",
    alias: "neume.lens",
  };
  tracksDB.upsertOwner(
    sample[0].uid,
    sample[0].erc721.tokens[0].id,
    newOwner,
    sample[0].platform.name,
    6,
  );
  ({ tracks } = await tracksDB.getTracksChanged(6, sample[0].platform.name));
  t.is(tracks.length, 1);
});

test.serial("should be able to update track", async (t) => {
  await tracksDB.upsertTrack(sample[0], 0);
  // adding a new owner to sample[0]
  const newTrack: Track = {
    ...sample[0],
    erc721: {
      ...sample[0].erc721,
      tokens: [
        ...sample[0].erc721.tokens,
        {
          ...sample[0].erc721.tokens[0],
          id: "2",
        },
      ],
    },
  };
  await tracksDB.upsertTrack(newTrack, 0);
  const ret = await tracksDB.getTrack(sample[0].uid);
  t.deepEqual(ret, newTrack);
});

test.serial("should be able upsert token", async (t) => {
  await tracksDB.upsertTrack(sample[0], 0);
  const newToken = {
    ...sample[0].erc721.tokens[0],
    id: "2",
  };
  const expectedTrack: Track = {
    ...sample[0],
    erc721: {
      ...sample[0].erc721,
      tokens: [...sample[0].erc721.tokens, newToken],
    },
  };
  await tracksDB.upsertToken(sample[0].uid, newToken, 1);
  const ret = await tracksDB.getTrack(sample[0].uid);
  t.deepEqual(ret, expectedTrack);
});
