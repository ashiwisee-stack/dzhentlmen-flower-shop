"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/phone-input";

type Challenge = { phone: string; callPhone: string; expires: number };
async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/auth/call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  return { response, data };
}

export function CallLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  const [phone, setPhone] = useState("+7"), [name, setName] = useState("");
  const [consent, setConsent] = useState(false), [ready, setReady] = useState<boolean | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  const locked = useRef(false), mounted = useRef(false), login = useRef(onLogin);
  login.current = onLogin;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void send({ action: "current" }).then(({ response, data }) => {
      if (!active) return;
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить вход по звонку");
      setReady(data.ready); setClock(Date.now()); setChallenge(data.challenge);
    }).catch(() => { if (active) { setReady(null); setError("Не удалось загрузить вход по звонку. Закройте и снова откройте личный кабинет."); } });
    return () => { active = false; mounted.current = false; };
  }, []);

  async function action(kind: "start" | "check" | "cancel") {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const { response, data } = await send({ action: kind, ...(kind === "start" ? { phone, name, consent } : {}) });
      if (!mounted.current) return;
      if (data.expired) setChallenge(null);
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
      if (kind === "start") { setClock(Date.now()); setChallenge(data.challenge); setMessage(""); }
      else if (kind === "cancel") { setChallenge(null); setMessage(""); }
      else if (data.pending) setMessage("Пока ждём звонка. Позвоните именно с указанного вами номера.");
      else { setChallenge(null); setMessage("Номер подтверждён."); await login.current(); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Не удалось войти"); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const currentAction = useRef(action); currentAction.current = action;
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const poll = setInterval(() => { if (document.visibilityState === "visible" && Date.now() < challenge.expires) void currentAction.current("check"); }, 15000);
    const focus = () => { if (Date.now() < challenge.expires) void currentAction.current("check"); };
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); clearInterval(poll); window.removeEventListener("focus", focus); };
  }, [challenge]);
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.expires - clock) / 1000)) : 0;
  function submit(event: FormEvent) { event.preventDefault(); void action("start"); }
  return <div className="auth-form call-login">
    <div className="auth-icon"><Phone /></div><h3>Войти по звонку</h3>
    <p>Укажите свой номер. Мы покажем, куда позвонить с него для подтверждения входа.</p>
    {ready === false ? <p role="status">Вход по звонку пока не подключён. Выберите Telegram или оформите заказ без входа.</p> : challenge ? <>
      <p>Позвоните с номера <strong>{challenge.phone}</strong>:</p>
      {remaining > 0 ? <a className="call-number" href={`tel:${challenge.callPhone}`}><Phone />{challenge.callPhone}</a> : <p role="status">Время на звонок истекло. Начните заново.</p>}
      <p className="call-timer">Осталось {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>
      <small>При двух SIM-картах выберите ту, чей номер указали. После звонка вернитесь в этот браузер. Статус проверяется автоматически.</small>
      <Button disabled={busy || remaining === 0} onClick={() => void action("check")}>{busy && <Loader2 className="spin" />}Я позвонил — проверить</Button>
      <Button variant="outline" disabled={busy} onClick={() => void action("cancel")}>Отменить / изменить номер</Button>
    </> : <form onSubmit={submit} className="call-login-form">
      <label><span>Имя</span><input required minLength={2} maxLength={100} autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} /></label>
      <label><span>Ваш телефон</span><PhoneInput value={phone} onChange={setPhone} /></label>
      <label className="check-row"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Даю <a href="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку данных</a> для входа. Номер передаётся SMS.RU для подтверждения звонком. <a href="/privacy" target="_blank" rel="noopener noreferrer">Политика</a>.</span></label>
      <Button type="submit" disabled={busy || !consent || ready !== true}>{busy ? <Loader2 className="spin" /> : <Phone />}Получить номер для звонка</Button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="tg-error">{error}</p>}
    <small>Заказ можно оформить без входа.</small>
  </div>;
}
