import { findAddresses, quoteDelivery, type Coordinates } from "@/lib/delivery";
import { limitRequest } from "@/lib/security";
export async function POST(request:Request) {
  try {
    await limitRequest(request,"delivery",60,3600);
    const p=await request.json() as {address?:string;coordinates?:Coordinates;action?:string};
    const address=String(p.address || "").trim();
    if(address.length<5 || address.length>300) throw new Error("Введите улицу и номер дома");
    if(p.action==="search") return Response.json({results:await findAddresses(address)});
    return Response.json(await quoteDelivery(address,p.coordinates));
  } catch(error) {return Response.json({error:error instanceof Error?error.message:"Расчёт временно недоступен"},{status:400});}
}
