export function tokenAuth(request:Request){return request.headers.get("x-auth-mode")==="token";}
export function sessionToken(headers:Pick<Headers,"get">){
 const bearer=headers.get("authorization")?.match(/^Bearer ([a-f0-9-]{64,100})$/)?.[1];
 if(headers.get("x-auth-mode")==="token")return bearer||"";
 return bearer||headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("dm_customer="))?.slice(12)||"";
}
export function challengeToken(request:Request,name:string){
 if(tokenAuth(request))return request.headers.get("x-auth-challenge")?.match(/^[a-f0-9-]{64,100}$/)?.[0]||"";
 return request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="))?.slice(name.length+1)||"";
}
