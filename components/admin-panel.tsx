"use client";

import { setProductAvailability } from "@/lib/product-editor";
import Image from "@/components/shop-image";
import { AdminRequests } from "@/components/admin-requests";
import { ZoneEditor } from "@/components/zone-editor";
import { AdminOrders } from "@/components/admin-orders";
import { CategoryEditor, VacancyEditor, ExtrasEditor, TelegramSettings, CustomersEditor } from "@/components/admin-tools";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, BriefcaseBusiness, ImagePlus, LayoutDashboard, Loader2,
  LogOut, MessageSquareText, Package, Pencil, Plus, RefreshCw, Save, Search, Settings,
  ShoppingBag, Star, Trash2, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_SETTINGS, formatPrice, type Category, type Extra, type Product } from "@/lib/catalog";

type OrderItem = { id: number; productName: string; variantName: string; extrasJson: string; price: number; quantity: number };
type Order = {
  id: string; orderNumber: string; customerName: string; phone: string; recipientName: string; recipientPhone: string;
  fulfillment: string; deliveryDate: string; deliveryTime: string; branchId: string; address: string; comment: string;
  subtotal: number; deliveryPrice: number; bonusSpent: number; total: number; status: string; paymentStatus: string; createdAt: string; items: OrderItem[];
};
type Customer = { id: string; name: string; phone: string; bonusBalance: number; createdAt: string };
type CustomRequest = { id: string; name: string; phone: string; comment: string; status: string; createdAt: string };
type Vacancy = { id: number; title: string; description: string; active: boolean; sortOrder: number };
type AdminSettings = typeof DEFAULT_SETTINGS;

const emptyProduct: Product = {
  id: 0, slug: "", name: "", category: "Букеты", price: 0, image: "", images: [],
  variants: [{ id: "one", name: "Один размер", price: 0, available: true }],
  description: "", composition: "", available: true, hidden: false, popular: false,
};
const orderStatus: Record<string, string> = { new: "Новый", confirmed: "Подтверждён", assembling: "Собирается", ready: "Готов", completed: "Завершён", cancelled: "Отменён" };
const paymentStatus: Record<string, string> = { not_required: "Без онлайн-оплаты", pending: "Ожидает оплаты", paid: "Оплачен", refunded: "Возврат" };

export function AdminPanel({ userName }: { userName: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [storeSettings, setStoreSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [hasSizes, setHasSizes] = useState(false);
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [totals,setTotals]=useState({newOrders:0,customers:0,requests:0,turnover:0});
  const [integrations,setIntegrations]=useState<Record<string,boolean>>({});
  const [newVacancy, setNewVacancy] = useState({ title: "", description: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productResponse, orderResponse, dataResponse] = await Promise.all([
        fetch("/api/products?admin=1", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/admin/data", { cache: "no-store" }),
      ]);
      const [productPayload, orderPayload, dataPayload] = await Promise.all([productResponse.json(), orderResponse.json(), dataResponse.json()]);
      if (!productResponse.ok || !orderResponse.ok || !dataResponse.ok) throw new Error(productPayload.error || orderPayload.error || dataPayload.error || "Не удалось загрузить данные");
      setProducts(productPayload.products || []);
      setOrders(orderPayload.orders || []);
      setCategories(dataPayload.categories || []);
      setCustomers(dataPayload.customers || []);
      setRequests(dataPayload.requests || []);
      setVacancies(dataPayload.vacancies || []);
      setStoreSettings({ ...DEFAULT_SETTINGS, ...(dataPayload.settings || {}) });
      setIntegrations(dataPayload.integrations||{});setTotals(dataPayload.totals||{newOrders:0,customers:0,requests:0,turnover:0});
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Initial data is loaded after hydration because the API requires the admin cookie.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => ({
    products: products.length,
    available: products.filter((item) => item.available && !item.hidden).length,
    newOrders: totals.newOrders,
    customers: totals.customers,
    requests: totals.requests,
    turnover: totals.turnover,
  }), [products, totals]);
  const filteredOrders = orders.filter((order) => (orderFilter === "all" || order.status === orderFilter) && (!orderQuery.trim() || `${order.orderNumber} ${order.phone} ${order.customerName}`.toLowerCase().includes(orderQuery.trim().toLowerCase())));

  function openNewProduct() { setHasSizes(false); setDraft({ ...emptyProduct, images: [], variants: emptyProduct.variants.map((item) => ({ ...item })) }); setEditorOpen(true); }
  function openProduct(product: Product) { setHasSizes(!product.singleFlower && (product.variants.length > 1 || product.variants[0]?.id !== "one")); setDraft({ ...product, images: [...product.images], variants: product.variants.map((item) => ({ ...item })) }); setEditorOpen(true); }

  async function saveProduct(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/products", { method: draft.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, pricingMode: hasSizes && !draft.singleFlower ? "variants" : "single", image: draft.images[0] || draft.image }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось сохранить товар");
      try { localStorage.setItem("dm_catalog_updated", String(Date.now())); } catch {}
      toast.success(draft.id ? "Товар обновлён" : "Товар добавлен"); setEditorOpen(false); await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить товар"); }
    finally { setSaving(false); }
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (draft.images.length >= 20) { toast.error("Максимум 20 фотографий на товар"); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Не удалось загрузить фото");
      setDraft((current) => ({ ...current, image: current.images[0] || payload.url, images: [...current.images, payload.url].slice(0,20) }));
      toast.success("Фотография добавлена");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось загрузить фото"); }
    finally { setUploading(false); }
  }
  function moveImage(index: number, direction: -1 | 1) {
    setDraft((current) => { const images = [...current.images]; const target = index + direction; if (target < 0 || target >= images.length) return current; [images[index], images[target]] = [images[target], images[index]]; return { ...current, images, image: images[0] }; });
  }
  function makeMainImage(index: number) {
    setDraft((current) => { const chosen = current.images[index]; const images = [chosen, ...current.images.filter((_, itemIndex) => itemIndex !== index)]; return { ...current, images, image: chosen }; });
  }

  async function deleteProduct() {
    if (!deleteTarget) return;
    const response = await fetch("/api/products", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || "Не удалось удалить товар");
    setDeleteTarget(null); toast.success("Товар удалён"); await loadData();
  }
  async function updateOrder(id: string, field: "status" | "paymentStatus", value: string) {
    const response = await fetch("/api/orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, [field]: value }) });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || "Не удалось обновить заказ");
    setOrders((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item)); toast.success("Заказ обновлён");
  }
  async function adminMutation(values: Record<string, Ring>) {
    const response = await fetch("/api/admin/data", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось сохранить");
  }
  async function runMutation(values: Record<string, Ring>, success = "Сохранено") {
    setSaving(true);
    try { await adminMutation(values); toast.success(success); await loadData(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить"); }
    finally { setSaving(false); }
  }
  async function logout() { await fetch("/api/admin/session", { method: "DELETE" }); window.location.href = "/admin/login"; }

  return (
    <main className="admin-shell">
      <Toaster position="top-center" richColors />
      <header className="admin-header"><div className="admin-brand"><span><LayoutDashboard /></span><div><strong>ДЖЕНТЕЛЬМЕН</strong><small>управление магазином</small></div></div><div className="admin-user"><span>{userName}</span><Link href="/"><ArrowLeft />В магазин</Link><button onClick={() => void logout()} title="Выйти"><LogOut /></button></div></header>
      <section className="admin-content">
        <div className="admin-title-row"><div><span className="eyebrow">Панель управления</span><h1>Магазин сегодня</h1></div><Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />Обновить</Button></div>
        <div className="admin-stats admin-stats-five"><article><span>Товаров</span><strong>{stats.products}</strong><small>{stats.available} на витрине</small></article><article><span>Новых заказов</span><strong>{stats.newOrders}</strong><small>требуют внимания</small></article><article><span>Клиентов</span><strong>{stats.customers}</strong><small>с аккаунтом</small></article><article><span>Новых заявок</span><strong>{stats.requests}</strong><small>перезвонить</small></article><article><span>Выполнено</span><strong>{formatPrice(stats.turnover)}</strong><small>за всё время</small></article></div>
        <Tabs defaultValue="products" className="admin-tabs">
          <TabsList variant="line" className="admin-tabs-list"><TabsTrigger value="products"><Package />Товары</TabsTrigger><TabsTrigger value="orders"><ShoppingBag />Заказы{stats.newOrders > 0 && <b>{stats.newOrders}</b>}</TabsTrigger><TabsTrigger value="categories"><BriefcaseBusiness />Разделы</TabsTrigger><TabsTrigger value="customers"><Users />Клиенты</TabsTrigger><TabsTrigger value="requests"><MessageSquareText />Заявки{stats.requests > 0 && <b>{stats.requests}</b>}</TabsTrigger><TabsTrigger value="settings"><Settings />Настройки</TabsTrigger></TabsList>

          <TabsContent value="products"><div className="admin-section-head"><div><h2>Каталог</h2><p>Фото, размеры, цены, наличие, видимость и порядок.</p></div><Button className="admin-primary" onClick={openNewProduct}><Plus />Добавить товар</Button></div>{loading ? <AdminLoading /> : <div className="admin-product-list">{products.map((product) => <article className={`admin-product ${product.hidden ? "is-hidden" : ""}`} key={product.id}><div className="admin-product-image"><Image src={product.image} alt="" fill sizes="84px" /></div><div className="admin-product-main"><span>{product.category}{product.popular ? " · популярное" : ""}</span><h3>{product.name}</h3><small>{product.variants.map((item) => `${item.name}: ${formatPrice(item.price)}`).join(" · ")}</small></div><div className="admin-product-price"><strong>от {formatPrice(product.price)}</strong><span className={product.hidden ? "unavailable" : product.available ? "available" : "unavailable"}>{product.hidden ? "Скрыт" : product.available ? "В наличии" : "Нет в наличии"}</span></div><div className="admin-row-actions"><Button variant="outline" size="icon" onClick={() => openProduct(product)}><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(product)}><Trash2 /></Button></div></article>)}</div>}</TabsContent>

          <TabsContent value="orders"><AdminOrders/></TabsContent>

          <TabsContent value="categories"><CategoryEditor rows={categories} mutate={runMutation}/></TabsContent>

          <TabsContent value="customers"><CustomersEditor mutate={runMutation}/></TabsContent>

          <TabsContent value="requests"><AdminRequests/></TabsContent>

          <TabsContent value="settings"><div className="admin-section-head"><div><h2>Настройки магазина</h2><p>Все значения применяются на витрине и при проверке заказа.</p></div></div><div className="integration-status">{Object.entries({sms:"Вход по СМС",telegram:"Telegram",payment:"Робокасса",geocoder:"Поиск адресов",router:"Маршруты по дорогам"}).map(([key,label])=><p key={key}>{label}: <strong>{integrations[key]?"настроено":"не подключено"}</strong></p>)}</div>{integrations.payment&&integrations.paymentTest&&<p className="test-payment-note">Робокасса в тестовом режиме (MD5). Реальные деньги не списываются; возвраты и фискальные чеки выключены.</p>}<form className="settings-form" onSubmit={(event) => { event.preventDefault(); void runMutation({ entity:"settings",values:storeSettings },"Настройки сохранены"); }}><div className="settings-grid"><label className="check-row"><input type="checkbox" checked={storeSettings.demoCatalog} onChange={e=>setStoreSettings({...storeSettings,demoCatalog:e.target.checked})}/>Показывать предупреждение о демонстрационном ассортименте</label><label>Расчёт доставки<select value={storeSettings.deliveryMode} onChange={e=>setStoreSettings({...storeSettings,deliveryMode:e.target.value})}><option value="estimate">Приблизительный (по прямой × 1,28)</option><option value="road">По автомобильным дорогам (нужен сервер маршрутов)</option></select></label>{([["legalName","Наименование ИП"],["inn","ИНН"],["ogrnip","ОГРНИП"],["legalAddress","Юридический адрес"],["contactEmail","Email для обращений"],["bankAccount","Расчётный счёт"],["bankName","Банк"],["bankBik","БИК"],["bankCorrespondent","Корреспондентский счёт"],["bankInn","ИНН банка"],["bankKpp","КПП банка"]] as const).map(([key,label])=><label key={key}>{label}<input value={storeSettings[key]} onChange={e=>setStoreSettings({...storeSettings,[key]:e.target.value})}/></label>)}<label><span>Минимальный заказ, ₽</span><input type="number" value={storeSettings.minOrder} onChange={(event) => setStoreSettings({ ...storeSettings,minOrder:Number(event.target.value) })} /></label><label><span>Базовая доставка, ₽</span><input type="number" value={storeSettings.deliveryBase} onChange={(event) => setStoreSettings({ ...storeSettings,deliveryBase:Number(event.target.value) })} /></label><label><span>Цена за км, ₽</span><input type="number" value={storeSettings.deliveryPerKm} onChange={(event) => setStoreSettings({ ...storeSettings,deliveryPerKm:Number(event.target.value) })} /></label><label><span>Км включено</span><input type="number" value={storeSettings.deliveryIncludedKm} onChange={(event) => setStoreSettings({ ...storeSettings,deliveryIncludedKm:Number(event.target.value) })} /></label><label><span>Доставка с</span><input type="time" value={storeSettings.deliveryOpen} onChange={(event) => setStoreSettings({ ...storeSettings,deliveryOpen:event.target.value })} /></label><label><span>Доставка до</span><input type="time" value={storeSettings.deliveryClose} onChange={(event) => setStoreSettings({ ...storeSettings,deliveryClose:event.target.value })} /></label><label><span>Минимум часов заранее</span><input type="number" value={storeSettings.leadTimeHours} onChange={(event) => setStoreSettings({ ...storeSettings,leadTimeHours:Number(event.target.value) })} /></label><label><span>Начисление бонусов, %</span><input type="number" value={storeSettings.bonusPercent} onChange={(event) => setStoreSettings({ ...storeSettings,bonusPercent:Number(event.target.value) })} /></label><label><span>Максимум списания, %</span><input type="number" value={storeSettings.bonusMaxSpendPercent} onChange={(event) => setStoreSettings({ ...storeSettings,bonusMaxSpendPercent:Number(event.target.value) })} /></label><label><span>Единый телефон</span><input value={storeSettings.phone} onChange={(event) => setStoreSettings({ ...storeSettings,phone:event.target.value })} /></label><label className="wide"><span>Текст «О нас»</span><textarea rows={3} value={storeSettings.about} onChange={(event) => setStoreSettings({ ...storeSettings,about:event.target.value })} /></label></div><ZoneEditor value={storeSettings.deliveryZone} onChange={deliveryZone=>setStoreSettings({...storeSettings,deliveryZone})} tileUrl={storeSettings.tileUrl}/><ExtrasEditor extras={storeSettings.extras} onChange={extras=>setStoreSettings({...storeSettings,extras})}/><Button className="admin-primary" disabled={saving}><Save />Сохранить настройки</Button></form><VacancyEditor rows={vacancies} mutate={runMutation}/><TelegramSettings/></TabsContent>
        </Tabs>
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="product-editor"><DialogHeader><span className="eyebrow">Карточка товара</span><DialogTitle>{draft.id ? "Редактирование" : "Новый товар"}</DialogTitle><DialogDescription>Первое фото — главное. Фото могут быть вертикальными, горизонтальными или квадратными. Превью обрезается, оригинал сохраняется.</DialogDescription></DialogHeader><form className="product-editor-form" onSubmit={saveProduct}><label className="single-flower-toggle wide"><span><strong>Одиночный цветок</strong><small>Показывать в каталоге и в «Дополнить букет цветами». Цена за одну штуку.</small></span><Switch checked={draft.singleFlower===true} onCheckedChange={singleFlower=>{setDraft({...draft,singleFlower,acceptsFlowers:!singleFlower,category:singleFlower?(categories.find(c=>c.slug==="single-flowers")?.name||draft.category):draft.category});if(singleFlower)setHasSizes(false);}}/></label><label className="check-row"><input type="checkbox" disabled={draft.singleFlower} checked={!draft.singleFlower && draft.acceptsFlowers!==false} onChange={e=>setDraft({...draft,acceptsFlowers:e.target.checked})}/>Разрешить дополнять этот товар отдельными цветами</label>
        <div className="image-manager"><div className="image-manager-head"><div><strong>Фотографии</strong><span>{draft.images.length} шт.</span></div><label className={uploading ? "upload-button disabled" : "upload-button"}>{uploading ? <Loader2 className="spin" /> : <ImagePlus />}{uploading ? "Загружаем…" : "Добавить фото"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(event) => {const files=Array.from(event.target.files||[]).slice(0,20-draft.images.length);void (async()=>{for(const file of files)await uploadImage(file);})();}} /></label></div>{draft.images.length ? <div className="image-list">{draft.images.map((url,index) => <article key={`${url}-${index}`} className={index === 0 ? "main-image" : ""}><div><Image src={url} alt={`Фото ${index + 1}`} fill sizes="120px" /></div>{index === 0 && <span><Star />Главное</span>}<nav><button type="button" onClick={() => makeMainImage(index)} disabled={index === 0}><Star /></button><button type="button" onClick={() => moveImage(index,-1)} disabled={index === 0}><ArrowUp /></button><button type="button" onClick={() => moveImage(index,1)} disabled={index === draft.images.length - 1}><ArrowDown /></button><button type="button" onClick={() => setDraft((current) => { const images = current.images.filter((_,i) => i !== index); return { ...current,images,image:images[0] || "" }; })}><X /></button></nav></article>)}</div> : <div className="image-empty"><ImagePlus /><span>Добавьте фото любых пропорций — JPEG, PNG или WebP</span></div>}</div>
        <label><span>Название</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft,name:event.target.value })} /></label><label><span>Раздел</span><Select value={draft.category} onValueChange={(category) => setDraft({ ...draft,category })}><SelectTrigger className="editor-select"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}</SelectContent></Select></label><label><span>Старая цена, ₽</span><input type="number" value={draft.oldPrice || ""} onChange={(event) => setDraft({ ...draft,oldPrice:event.target.value ? Number(event.target.value) : undefined })} /></label><label><span>Метка</span><input value={draft.badge || ""} onChange={(event) => setDraft({ ...draft,badge:event.target.value })} placeholder="Новинка" /></label><label className="wide"><span>Описание</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft,description:event.target.value })} /></label><label className="wide"><span>Состав</span><input value={draft.composition} onChange={(event) => setDraft({ ...draft,composition:event.target.value })} /></label>
        <div className="pricing-mode wide"><label><span><strong>У товара есть размеры</strong><small>{draft.singleFlower?"Одиночный цветок продаётся по одной цене за штуку":"Выключите, чтобы задать одну цену без выбора размера"}</small></span><Switch checked={hasSizes} disabled={draft.singleFlower} onCheckedChange={checked=>{setHasSizes(checked);if(checked&&draft.variants.length===0)setDraft({...draft,variants:[{id:"s",name:"S",price:draft.price,available:draft.available}]});}}/></label></div>
        {!hasSizes && <label className="single-price wide"><span>{draft.singleFlower?"Цена за один цветок, ₽":"Цена товара, ₽"}</span><input type="number" required min="0" max="1000000" step="1" value={draft.price} onChange={event=>setDraft({...draft,price:Number(event.target.value)})}/></label>}
        {hasSizes && <>        <div className="variant-editor wide"><div><strong>Цены по размерам</strong><Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft,variants:[...draft.variants,{ id:`variant-${Date.now()}`,name:"Новый",price:0,available:true }] })}><Plus />Размер</Button></div>{draft.variants.map((variant,index) => <article key={variant.id}><input value={variant.name} onChange={(event) => setDraft({ ...draft,variants:draft.variants.map((item,i) => i === index ? { ...item,name:event.target.value } : item) })} placeholder="S" /><input type="number" min="0" step="1" required value={variant.price} onChange={(event) => setDraft({ ...draft,variants:draft.variants.map((item,i) => i === index ? { ...item,price:Number(event.target.value) } : item) })} placeholder="Цена" /><label><span>В наличии</span><Switch checked={variant.available} onCheckedChange={(available) => setDraft({ ...draft,variants:draft.variants.map((item,i) => i === index ? { ...item,available } : item) })} /></label><button type="button" onClick={() => setDraft({ ...draft,variants:draft.variants.filter((_,i) => i !== index) })}><Trash2 /></button></article>)}</div>{draft.available && !draft.variants.some(variant=>variant.available) && <p className="form-error wide" role="alert">Включите наличие хотя бы одного размера или выключите наличие товара.</p>}</>}

        <div className="product-flags wide"><label><span><strong>Товар в наличии</strong><small>Для товара с размерами нужен хотя бы один доступный размер</small></span><Switch checked={draft.available} onCheckedChange={(available) => setDraft(setProductAvailability(draft,available))} /></label><label><span><strong>Скрыть с витрины</strong><small>Товар останется в админке</small></span><Switch checked={draft.hidden} onCheckedChange={(hidden) => setDraft({ ...draft,hidden })} /></label><label><span><strong>Популярный</strong><small>Поднимает товар выше</small></span><Switch checked={draft.popular} onCheckedChange={(popular) => setDraft({ ...draft,popular })} /></label></div>
        <div className="editor-actions"><Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Отмена</Button><Button type="submit" className="admin-primary" disabled={saving || uploading || !draft.images.length || (hasSizes && (!draft.variants.length || (draft.available && !draft.variants.some(v=>v.available))))}>{saving ? <Loader2 className="spin" /> : <Save />}{saving ? "Сохраняем…" : "Сохранить товар"}</Button></div>
      </form></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить «{deleteTarget?.name}»?</AlertDialogTitle><AlertDialogDescription>Если товар может понадобиться позже, безопаснее включить «Скрыть с витрины».</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteProduct()}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

type Ring = string | number | boolean | object | null | undefined;
function AdminLoading() { return <div className="admin-loading"><Loader2 className="spin" /><span>Загружаем данные…</span></div>; }
function AdminEmpty({ text }: { text: string }) { return <div className="admin-empty"><Package /><h3>{text}</h3></div>; }
