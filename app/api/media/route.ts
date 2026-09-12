import { env } from "cloudflare:workers";

type StoredObject = {
  body: ReadableStream;
  httpEtag?: string;
  writeHttpMetadata(headers: Headers): void;
};

type Bucket = { get(key: string): Promise<StoredObject | null> };

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !key.startsWith("products/")) return new Response("Not found", { status: 404 });
  const bucket = (env as unknown as { BUCKET?: Bucket }).BUCKET;
  if (!bucket) return new Response("Storage unavailable", { status: 503 });
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
