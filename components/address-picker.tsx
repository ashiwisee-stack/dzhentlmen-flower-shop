"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { MapPin, Search } from "lucide-react";
import { BRANCHES, formatPrice } from "@/lib/catalog";
import type { AddressResult } from "@/lib/address-results";
type Point = [number, number];
export type Quote = { coordinates:Point; price: number; distanceKm: number; branch: typeof BRANCHES[number]; method: string; token: string; address: string; expires:number; tariff?:{base:number;perKm:number;includedKm:number} };

export function AddressPicker({ address, onAddress, onQuote, tileUrl, zone, children }: { address: string; onAddress: (value: string) => void; onQuote: (quote: Quote | null) => void; tileUrl: string; zone: number[][]; children?:ReactNode }) {
  const node = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), marker = useRef<Marker | null>(null);
  const placeMarker = useRef<(point:Point)=>void>(()=>{});
  const revision = useRef(0), inputId = useId(), hintId = useId();
  const [enabled, setEnabled] = useState(false), [point, setPoint] = useState<Point | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]), [listOpen, setListOpen] = useState(false);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<AddressResult | null>(null), [quote, setQuote] = useState<Quote | null>(null);
  const pointRef = useRef(point), quoteCallback = useRef(onQuote);
  pointRef.current = point; quoteCallback.current = onQuote;
  const addressReady = address.trim().length >= 5;
  function invalidate() { revision.current++; setBusy(false); setQuote(null); quoteCallback.current(null); setError(""); }

  useEffect(() => {
    if (!enabled || !node.current) return;
    let disposed = false;
    void import("leaflet").then(L => {
      if (disposed || !node.current) return;
      const m = L.map(node.current, { scrollWheelZoom: false }).setView(pointRef.current || [56.835, 60.59], pointRef.current ? 16 : 12);
      map.current = m;
      m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
      L.polygon(zone as Point[], { color: "#704083", weight: 2, fillOpacity: 0.04 }).addTo(m);
      BRANCHES.forEach(branch => L.circleMarker(branch.coordinates, { color: "#84601c", radius: 7 }).addTo(m).bindTooltip(branch.address));
      const place = (position: Point) => {
        if (marker.current) marker.current.setLatLng(position);
        else {
          marker.current = L.marker(position, { draggable: true, icon: L.divIcon({ className: "delivery-pin", html: "", iconSize: [24, 24], iconAnchor: [12, 24] }) }).addTo(m);
          marker.current.on("dragend", () => { const p = marker.current!.getLatLng(); invalidate(); setSelected(null); setPoint([p.lat, p.lng]); });
        }
      };
      placeMarker.current = place;
      m.on("click", event => { const position: Point = [event.latlng.lat, event.latlng.lng]; place(position); invalidate(); setSelected(null); setPoint(position); });
      m.on("locationfound", event => { const position: Point = [event.latlng.lat, event.latlng.lng]; place(position); m.setView(position, 16); invalidate(); setSelected(null); setPoint(position); });
      m.on("locationerror", () => setError("Не удалось определить местоположение. Выберите дом на карте."));
      // Initial placement must not invalidate a quote obtained from an address result.
      if (pointRef.current) place(pointRef.current);
    }).catch(() => setError("Карта не загрузилась. Попробуйте выбрать адрес через поиск."));
    return () => { disposed = true; map.current?.remove(); map.current = null; marker.current = null; placeMarker.current=()=>{}; };
  }, [enabled, tileUrl, zone, !!quote]);

  useEffect(() => {
    if (point && map.current) { placeMarker.current(point); map.current.setView(point, 16); }
    else if (!point && marker.current) { marker.current.remove(); marker.current=null; }
  }, [point]);
  useEffect(() => () => { revision.current++; quoteCallback.current(null); }, []);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(() => { invalidate(); setError("Расчёт устарел. Нажмите «Обновить стоимость доставки»."); }, Math.max(0, quote.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [quote]);

  async function request(action: "search" | "quote", coordinates?: Point, currentAddress = address) {
    if (currentAddress.trim().length < 5) { setError("Введите улицу и номер дома."); return; }
    const currentRevision = ++revision.current;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/delivery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, address: currentAddress, coordinates }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (currentRevision !== revision.current) return;
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
      if (action === "search") { setResults(data.results); setListOpen(data.results.length > 0); if (!data.results.length) setError("Адрес не найден в зоне доставки. Уточните улицу и дом или поставьте точку на карте."); }
      else { setQuote(data); onQuote(data); }
    } catch (failure) { if (currentRevision === revision.current) setError(failure instanceof Error ? failure.message : "Поиск временно недоступен"); }
    finally { if (currentRevision === revision.current) setBusy(false); }
  }
  function choose(result: AddressResult | null) {
    if (!result) return;
    invalidate(); setSelected(result); setPoint(result.coordinates); setListOpen(false); setEnabled(true);
    if (result.precision === "house") { onAddress(result.label); void request("quote", result.coordinates, result.label); }
    else { setError("Найдена только улица. Номер дома сохранён в поле: отметьте нужный дом на карте и подтвердите адрес."); }
  }
  return <div className="address-picker" ref={setPopupContainer}>
    {quote ? <><div className="delivery-confirmed"><strong>{quote.address}</strong><span>Доставка — {formatPrice(quote.price)}</span><small>{quote.method === "road" ? "По дорогам" : "Оценка расстояния"}: {quote.distanceKm} км от магазина {quote.branch.address}</small>{quote.tariff && <small>База {formatPrice(quote.tariff.base)} · первые {quote.tariff.includedKm} км включены · далее {formatPrice(quote.tariff.perKm)}/км</small>}{quote.method === "road" && <small>Маршрут: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">OSRM / FOSSGIS</a> · © OpenStreetMap · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Исправить карту</a>. Без учёта пробок.</small>}{quote.method !== "road" && <small>Расстояние по прямой × 1,28. Стоимость рассчитана по тарифу магазина.</small>}<Button type="button" variant="outline" onClick={()=>{invalidate();setEnabled(false);setPoint(null);setSelected(null);setResults([]);}}>Изменить адрес</Button></div>{children}</> : <>
    <label htmlFor={inputId}>Улица и номер дома *</label>
    <Combobox items={results} filter={null} value={selected} inputValue={address} open={listOpen} onOpenChange={open => setListOpen(open && results.length > 0)} itemToStringLabel={result => result.label} isItemEqualToValue={(a, b) => a.label === b.label && a.coordinates.join() === b.coordinates.join()} onValueChange={choose} onInputValueChange={(value, details) => {
      if (details.reason !== "input-change" && details.reason !== "input-clear") return;
      invalidate(); setBusy(false); setSelected(null); setPoint(null); setResults([]); setListOpen(false); onAddress(value);
    }}>
      <ComboboxInput id={inputId} required minLength={5} maxLength={300} autoComplete="street-address" aria-describedby={hintId} placeholder="Например, ул. Малышева, 51" showTrigger={results.length > 0} onKeyDown={event => { if (event.key === "Enter" && !listOpen) { event.preventDefault(); void request("search"); } }} />
      <ComboboxContent container={popupContainer} className="address-combobox"><ComboboxList>{(result: AddressResult) => <ComboboxItem key={result.label + result.coordinates.join()} value={result}>{result.label}{result.precision !== "house" && " — уточните дом на карте"}</ComboboxItem>}</ComboboxList></ComboboxContent>
    </Combobox>
    <Button type="button" variant="outline" disabled={busy || !addressReady} onClick={() => void request("search")}><Search />{busy ? "Проверяем адрес…" : "Найти адрес"}</Button>
    <small>Город — Екатеринбург. Введите только улицу и дом, выберите результат. Квартиру и подъезд можно уточнить после выбора дома.</small>
    {!enabled ? <div className="map-consent"><p>Можно также отметить дом на карте OpenStreetMap.</p><Button type="button" variant="outline" onClick={() => setEnabled(true)}><MapPin />Показать карту</Button></div> : <><div ref={node} className="delivery-map" aria-label="Карта выбора дома" /><div className="map-actions"><small>Фиолетовая граница — зона доставки. Метку можно передвинуть.</small><Button type="button" variant="outline" onClick={() => map.current?.locate()}>Моё местоположение</Button></div></>}
    <p id={hintId} className="address-step-hint" aria-live="polite">{quote ? "Адрес выбран, доставка рассчитана." : !point ? "Выберите адрес из списка или отметьте дом на карте." : "Проверьте улицу, номер дома и положение метки, затем рассчитайте доставку."}</p>
    {point && !quote && <Button type="button" disabled={busy || !addressReady} onClick={() => void request("quote", point)}>{busy ? "Рассчитываем…" : "Обновить стоимость доставки"}</Button>}
    {error && <p role="alert" className="form-error">{error}</p>}
    </>}
  </div>;
}
