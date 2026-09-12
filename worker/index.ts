/** Cloudflare Worker entry point for the vinext-starter template. */
import { localImageSource } from "../lib/image-source";
import handler from "vinext/server/app-router-entry";
import { flushNotifications } from "../lib/telegram";
import { processReceipts } from "../lib/fiscal";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Original images are already compressed. No paid image service is required.

const worker = {
  async scheduled(_controller:unknown,_env:Env,ctx:ExecutionContext) {
    ctx.waitUntil(Promise.all([flushNotifications(),processReceipts()]));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const source = localImageSource(url.searchParams.get("url"));
      if (!source) return new Response("Image not found", { status: 404 });
      return Response.redirect(new URL(source, url.origin).href, 302);
    }

    const response=await handler.fetch(request, env, ctx);
    if(response.ok && request.method!=="GET" && ["/api/orders","/api/requests","/api/payment/result"].includes(url.pathname)) ctx.waitUntil(flushNotifications());
    return response;
  },
};

export default worker;
