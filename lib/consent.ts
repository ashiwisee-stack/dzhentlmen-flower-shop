import { database } from "@/db";
export const CONSENT_VERSION="2026-09-12";
export function consentStatement(subject:string,purpose:string) {
  return database().prepare("INSERT INTO consent_events(id,subject,purpose,version) VALUES(?,?,?,?)").bind(crypto.randomUUID(),subject,purpose,CONSENT_VERSION);
}
