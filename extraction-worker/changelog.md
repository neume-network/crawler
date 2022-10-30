# Changelog

## 0.7.1

- Pass `headers` in ipfs message to gateway

## 0.7.0

- (breaking) For unparsable JSON, we now return the text response as a
  `results` in case the HTTP header `Content-Type` includes `json`.
- Add `type: ipfs` worker message handling
- Add `type: arweave` worker message handling

## 0.6.1

- `workerData` is now evaluated using
  [@neume-network/schema@0.5.0](https://github.com/neume-network/schema/blob/main/src/schema.mjs#L4-L49).

## 0.6.0

- (breaking) Switch from better-queue to fastq. Whereas extraction worker users
  pinning a version below 0.6.0 had to expect string-only errors in return
  messages, this deviation was now fixed through fastq that always provides the
  message and a potential error message in case of failure. The [`function panic(...)`](https://github.com/neume-network/extraction-worker/blob/2426513292ed27cd994e97c3fc5f271b77dc0007/src/worker.mjs#L13)
  implementation shows it.

## 0.5.2 (mistake and later unpublished)

- Switch from better-queue to fastq

## 0.5.1

- Add `endpoints` property that allows setting an endpoint-specific `timeout`
  and rate limit

## 0.5.0

- (breaking) Upon failures in the worker/queue, extraction-worker attempts to
  return as much context back to the user by e.g. sending the augmented message
  object (with the `error` property filled out). This may have been broken in
  earlier versions.

## 0.4.0

- (breaking) Upgrade to eth-fun@0.9.0

## 0.3.2

- Add `eth_getLogs` translation

## 0.3.1

- Properly pass numerical timeout value in milliseconds to `setTimeout`.

## 0.3.0

- (breaking) Pass entire queue `options` configuration through `workerData`.
- (breaking) Make `eth-fun` a peerDependency.
- Through `DEBUG` environment variable, allow inspecting queue's statistics.
- Improve internal error handling.
- Upgrade to @neume-network/message-schema@0.3.1 that includes the `timeout`
  property and implement timeouts with `AbortSignal`.
- Improve error messages for messages of type `https`

## 0.2.0

- Updated to [neume-network/message-schema@0.3.0](https://github.com/neume-network/message-schema/blob/78bb2cc566403d733df20d6c2ab5b86cfcc11e17/changelog.md#030)

## 0.1.0

- Re-release as `@neume-network/extraction-worker`

## 0.0.3

- Upgrade eth-fun@0.6.0

## 0.0.2

- Add `graphql` job type

## 0.0.1

- Initial release
