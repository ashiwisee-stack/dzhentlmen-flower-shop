import { consentStatement } from "@/lib/consent";
import { database, getDb } from "@/db";
import { limitRequest } from "@/lib/security";
import { notificationStatement } from "@/lib/telegram";
import { customRequests } from "@/db/schema";
import { normalizePhone } from "@/lib/customer-auth";

export async function POST(request: Request) {
  try {
    await limitRequest(request,"custom-request",5,3600);
    const payload = await request.json() as { name?: string; phone?: string; comment?: string;consent?:boolean };
    if(payload.consent!==true)return Response.json({error:"Подтвердите согласие на обработку заявки"},{status:400});
    const name = String(payload.name ?? "").trim();
    const phone = normalizePhone(String(payload.phone ?? ""));
    const comment = String(payload.comment ?? "").trim();
    if (!phone || comment.length < 10) return Response.json({ error: "Укажите телефон и расскажите о букете чуть подробнее" }, { status: 400 });
    if(name.length>100||comment.length>3000)throw new Error("Слишком длинный текст");
    const id=crypto.randomUUID();
    await database().batch([database().prepare("INSERT INTO custom_requests(id,name,phone,comment) VALUES(?,?,?,?)").bind(id,name,phone,comment),consentStatement(id,"custom-request"),notificationStatement("request:"+id,"Новая индивидуальная заявка. Подробности в админке.")]);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("requests:create", error);
    return Response.json({ error: "Не удалось отправить заявку" }, { status: 500 });
  }
}
