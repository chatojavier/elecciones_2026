export function jsonResponse(
  body: unknown,
  statusCode = 200,
  headers: Record<string, string> = {}
) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    },
    body: JSON.stringify(body)
  };
}
