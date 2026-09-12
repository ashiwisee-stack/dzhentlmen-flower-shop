import { database } from "@/db";
import { requireAdminApi } from "@/lib/admin-auth";
export async function GET(request:Request){
  const auth=await requireAdminApi();if(!auth.ok)return auth.response;
  const u=new URL(request.url),q=u.searchParams.get("q")||"",page=Math.max(0,Math.floor(Number(u.searchParams.get("page"))||0));
  const rows=await database().prepare("SELECT id,name,phone,bonus_balance AS bonusBalance FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT 51 OFFSET ?").bind("%"+q+"%","%"+q+"%",page*50).all();
  return Response.json({customers:rows.results.slice(0,50),hasMore:rows.results.length>50});
}
