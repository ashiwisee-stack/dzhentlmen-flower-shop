import { env } from "cloudflare:workers";
import { requireAdminApi } from "@/lib/admin-auth";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const started = Date.now();
  try {
    const response = await fetch("https://sms.ru/auth/check", {
      method: "POST",
      body: new URLSearchParams({ api_id: String(env.SMS_RU_API_ID || ""), json: "1" }),
      signal: AbortSignal.timeout(12000), redirect: "manual",
    });
    const data = await response.json() as Record<string, unknown>;
    return Response.json({ httpStatus: response.status, providerCode: data.status_code, authenticated: data.status === "OK" && Number(data.status_code) === 100, elapsedMs: Date.now() - started }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // No request body, credential, phone number or provider response is returned.
    const message = error instanceof Error ? error.message.replaceAll(String(env.SMS_RU_API_ID || "[unset]"), "[redacted]").slice(0, 300) : "Unknown error";
    return Response.json({ error: message, kind: error instanceof Error ? error.name : "Error", elapsedMs: Date.now() - started }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
