"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || "Не удалось войти"); setLoading(false); return; }
    window.location.href = "/admin";
  }
  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-logo"><Image src="/brand/logo-watercolor.webp" alt="" fill sizes="84px" /></div>
        <span className="eyebrow">Панель управления</span>
        <h1>Вход администратора</h1>
        <p>Используйте пароль, заданный в переменных окружения.</p>
        <label><span>Пароль</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" className="admin-primary" disabled={loading}>{loading ? <Loader2 className="spin" /> : <LockKeyhole />}{loading ? "Проверяем…" : "Войти"}</Button>
      </form>
    </main>
  );
}
