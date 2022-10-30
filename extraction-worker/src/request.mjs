import fetch from "cross-fetch";

export async function request(url, method, body, headers, signal) {
  let options = {
    method,
  };

  if (body) {
    options.body = body;
  }
  if (headers) {
    options.headers = headers;
  }
  if (signal) {
    options.signal = signal;
  }

  // NOTE: We let `fetch` throw. Error must be caught on `request` user level.
  const results = await fetch(url, options);
  const answer = await results.text();

  if (results.status >= 400) {
    throw new Error(
      `Request to url "${url}" with method "${method}" and body "${JSON.stringify(
        body
      )}" unsuccessful with status: ${results.status} and answer: "${answer}"`
    );
  }

  try {
    return JSON.parse(answer);
  } catch (err) {
    if (results.headers.get("Content-Type")?.toLowerCase().includes("json")) {
      throw new Error(
        `Encountered error when trying to parse JSON body result: "${answer}", error: "${err.toString()}"`
      );
    }

    return answer;
  }
}
