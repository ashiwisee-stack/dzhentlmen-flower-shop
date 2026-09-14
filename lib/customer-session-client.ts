"use client";
type Mode="cookie"|"token";
const memory:Record<string,string>={};
function read(key:string){try{return sessionStorage.getItem(key)||memory[key]||"";}catch{return memory[key]||"";}}
function write(key:string,value:string){memory[key]=value;try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}}
export function authMode():Mode{return read("dm_auth_mode")==="cookie"?"cookie":"token";}
export function setAuthMode(mode:Mode){write("dm_auth_mode",mode);}
export async function customerFetch(input:string|URL,init:RequestInit={}) {
 const url=new URL(String(input),window.location.origin);
 if(url.origin!==window.location.origin || !url.pathname.startsWith("/api/"))throw new Error("Недопустимый адрес запроса");
 const tokenMode=authMode()==="token", h=new Headers(init.headers);
 h.set("x-auth-mode",tokenMode?"token":"cookie");
 if(tokenMode && read("dm_session_token"))h.set("authorization","Bearer "+read("dm_session_token"));
 const flow=url.pathname==="/api/auth/call"?"call":url.pathname==="/api/auth/telegram"?"telegram":"";
 if(tokenMode && flow && read("dm_challenge_"+flow))h.set("x-auth-challenge",read("dm_challenge_"+flow));
 const response=await fetch(url,{...init,headers:h,credentials:tokenMode?"omit":"same-origin"});
 if(tokenMode) {
   try {const data=await response.clone().json();if(data.authToken)write("dm_session_token",data.authToken);if(flow && data.challengeToken)write("dm_challenge_"+flow,data.challengeToken);if(flow && (data.clearChallenge||data.authToken))write("dm_challenge_"+flow,"");} catch {}
 }
 if(url.pathname==="/api/auth" && init.method==="DELETE" && response.ok)write("dm_session_token","");
 return response;
}
