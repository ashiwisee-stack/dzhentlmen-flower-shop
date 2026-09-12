import { database } from "@/db";
import { requireAdminApi } from "@/lib/admin-auth";
import { processReceipts } from "@/lib/fiscal";
import { sameOrigin } from "@/lib/security";
export async function GET(request:Request) {
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  const id=new URL(request.url).searchParams.get("order");
  const row=await database().prepare("SELECT status,response FROM fiscal_jobs WHERE order_id=?").bind(id).first();
  return Response.json({receipt:row});
}
export async function POST(request:Request) {
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  sameOrigin(request);await processReceipts();return Response.json({ok:true});
}
