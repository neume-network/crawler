import { toHex, encodeFunctionCall, decodeParameters } from "eth-fun";
import { randomItem } from "../../utils.js";
import Lens from "./lens.js";
export async function getHandle(profileId, blockNumber) {
    const rpcHost = randomItem(this.config.chain[this.chain].rpc);
    const data = encodeFunctionCall({
        name: "getHandle",
        type: "function",
        inputs: [
            {
                type: "uint256",
                name: "<input>",
            },
        ],
    }, [profileId]);
    const msg = await this.worker({
        type: "json-rpc",
        commissioner: "",
        method: "eth_call",
        options: {
            url: rpcHost.url,
            headers: {
                ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
            },
            retry: {
                retries: 3,
            },
        },
        params: [
            {
                to: Lens.LENS_HUB_ADDRESS,
                data,
            },
            toHex(blockNumber),
        ],
        version: "0.0.1",
    });
    if (msg.error)
        throw new Error(`Error while calling getHandle   on contract: ${JSON.stringify(msg, null, 2)}`);
    const handle = decodeParameters(["string"], msg.results)[0];
    if (typeof handle !== "string")
        throw new Error(`Invalid result of getHandle for contract: ${JSON.stringify(msg, null, 2)}`);
    return handle;
}
export async function getCollectNFT(profileId, pubId, blockNumber) {
    const rpcHost = randomItem(this.config.chain[this.chain].rpc);
    const data = encodeFunctionCall({
        name: "getCollectNFT",
        type: "function",
        inputs: [
            {
                type: "uint256",
                name: "<input>",
            },
            {
                type: "uint256",
                name: "<input>",
            },
        ],
    }, [profileId, pubId]);
    const msg = await this.worker({
        type: "json-rpc",
        commissioner: "",
        method: "eth_call",
        options: {
            url: rpcHost.url,
            headers: {
                ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
            },
            retry: {
                retries: 3,
            },
        },
        params: [
            {
                to: Lens.LENS_HUB_ADDRESS,
                data,
            },
            toHex(blockNumber),
        ],
        version: "0.0.1",
    });
    if (msg.error)
        throw new Error(`Error while calling getContractNFT on contract: ${JSON.stringify(msg, null, 2)}`);
    const address = decodeParameters(["address"], msg.results)[0];
    if (typeof address !== "string")
        throw new Error(`invalid result of getContractNFT for contract: ${JSON.stringify(msg, null, 2)}`);
    return address;
}
// The address may own multiple profiles but we are currently
// only interested in one of them. Hence, the zero index.
export async function getHandleByAddress(address, blockNumber) {
    const rpcHost = randomItem(this.config.chain[this.chain].rpc);
    const data = encodeFunctionCall({
        name: "tokenOfOwnerByIndex",
        type: "function",
        inputs: [
            {
                type: "address",
                name: "<input>",
            },
            {
                type: "uint256",
                name: "<input>",
            },
        ],
    }, [address, 0]);
    const msg = await this.worker({
        type: "json-rpc",
        commissioner: "",
        method: "eth_call",
        options: {
            url: rpcHost.url,
            headers: {
                ...(rpcHost.key && { Authorization: `Bearer ${rpcHost.key}` }),
            },
            retry: {
                retries: 3,
            },
        },
        params: [
            {
                to: Lens.LENS_HUB_ADDRESS,
                data,
            },
            toHex(blockNumber),
        ],
        version: "0.0.1",
    });
    if (msg.error)
        throw new Error(`Error while calling tokenOwnerByIndex on contract: ${JSON.stringify(msg, null, 2)} \n ${address}`);
    const tokenId = parseInt(decodeParameters(["uint256"], msg.results)[0]);
    if (typeof tokenId !== "number" || Number.isNaN(tokenId))
        throw new Error(`Invalid result of tokenOwnerByIndex for contract: ${JSON.stringify(msg, null, 2)}`);
    const handle = await getHandle.call(this, tokenId, blockNumber);
    return handle;
}
export async function getAlias(nft) {
    let handle = null;
    // Not every address will have an alias. Therefore, ignoring
    // failures
    try {
        handle = await getHandleByAddress.call(this, nft.erc721.transaction.to, nft.erc721.blockNumber);
    }
    catch (err) { }
    return handle;
}
