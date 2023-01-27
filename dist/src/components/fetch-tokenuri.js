export async function fetchTokenUri(url, worker) {
    const msg = await worker({
        type: "https",
        version: "0.0.1",
        commissioner: "",
        options: {
            url,
            method: "GET",
            retry: {
                retries: 3,
            },
        },
    });
    if (msg.error)
        throw new Error(`Error while fetching JSON URI: ${JSON.stringify(msg, null, 2)}`);
    return msg.results;
}
