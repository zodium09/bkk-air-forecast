type ResponseSnapshot = {
  body: ArrayBuffer;
  headers: [string, string][];
  status: number;
  statusText: string;
};

function requestKey(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  return request.method === "GET" ? request.url : null;
}

export function createDeduplicatedFetch(fetchImpl: typeof fetch): typeof fetch {
  const requests = new Map<string, Promise<ResponseSnapshot>>();
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = requestKey(input, init);
    if (!key) return fetchImpl(input, init);
    let pending = requests.get(key);
    if (!pending) {
      pending = fetchImpl(input, init).then(async (response) => ({
        body: await response.arrayBuffer(),
        headers: [...response.headers.entries()],
        status: response.status,
        statusText: response.statusText,
      }));
      requests.set(key, pending);
    }
    const snapshot = await pending;
    return new Response(snapshot.body.slice(0), {
      headers: snapshot.headers,
      status: snapshot.status,
      statusText: snapshot.statusText,
    });
  }) as typeof fetch;
}