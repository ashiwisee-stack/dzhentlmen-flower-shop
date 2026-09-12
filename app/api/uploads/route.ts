import { sameOrigin } from "@/lib/security";
import { env } from "cloudflare:workers";
import { requireAdminApi } from "@/lib/admin-auth";

type Bucket = {
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    sameOrigin(request);
    const bucket = (env as unknown as { BUCKET?: Bucket }).BUCKET;
    if (!bucket) return Response.json({ error: "Хранилище фотографий пока не подключено" }, { status: 503 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !["image/jpeg","image/png","image/webp"].includes(file.type)) {
      return Response.json({ error: "Выберите изображение" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ error: "Файл должен быть не больше 8 МБ" }, { status: 400 });
    }
    const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const signature=Array.from(head).map(b=>b.toString(16).padStart(2,"0")).join("");
    const valid=file.type==="image/jpeg"?signature.startsWith("ffd8ff"):file.type==="image/png"?signature.startsWith("89504e470d0a1a0a"):signature.startsWith("52494646")&&signature.slice(16,24)==="57454250";
    if(!valid)return Response.json({error:"Содержимое файла не соответствует формату фотографии"},{status:400});
    const extension = ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as Record<string,string>)[file.type];
    const key = `products/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: auth.user.email },
    });
    return Response.json({ url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
  } catch (error) {
    console.error("uploads:create", error);
    return Response.json({ error: "Не удалось загрузить фотографию" }, { status: 500 });
  }
}
