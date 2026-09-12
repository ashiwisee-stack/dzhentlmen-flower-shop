import { clearAdminCookie, createAdminCookie } from "@/lib/admin-auth";
import { limitRequest, sameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  try { await limitRequest(request,"admin-login",10,900); } catch { return Response.json({error:"Слишком много попыток входа"},{status:429}); }
  const { password } = await request.json() as { password?: string };
  const cookie = await createAdminCookie(String(password ?? ""), request);
  if (!cookie) return Response.json({ error: "Неверный пароль или не настроены ADMIN_PASSWORD и ADMIN_SESSION_SECRET" }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
}

export async function DELETE(request: Request) {
  sameOrigin(request);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearAdminCookie() } });
}
