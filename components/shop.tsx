"use client";

import { PhoneInput } from "@/components/phone-input";
import { RecentOrders } from "@/components/recent-orders";
import { rememberOrder, openOrderPayment } from "@/lib/recent-orders";
import { CustomerLogin } from "@/components/customer-login";
import Image from "@/components/shop-image";
import { AddressPicker, type Quote } from "@/components/address-picker";
import { ProductGallery } from "@/components/product-gallery";
import { CartExtras } from "@/components/cart-extras";
import { validateSlot } from "@/lib/shop-rules";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Award, Check, ChevronDown, Clock3, Gift, Heart, History, Loader2,
  LogOut, MapPin, Minus, PackageCheck, Phone, Plus, RotateCcw, Search, ShoppingBag,
  Sparkles, Trash2, Truck, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  BRANCHES, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS, DEFAULT_SETTINGS, formatPrice,
  type Branch, type Category, type Extra, type Product,
} from "@/lib/catalog";

type CartLine = { key: string; productId: number; variantId: string; quantity: number; extras: string[] };
type ResolvedLine = CartLine & { product: Product; variant: Product["variants"][number]; selectedExtras: Extra[]; unitPrice: number };
type DeliveryQuote = Quote;
type Customer = { id: string; name: string; phone: string; bonusBalance: number };
type AccountOrder = {
  id: string; orderNumber: string; deliveryDate: string; deliveryTime: string; total: number; status: string; paymentStatus?:string;
  items: { id: number; productId: number; productName: string; variantName: string; extrasJson: string; price: number; quantity: number }[];
};
type Vacancy = { id: number; title: string; description: string; active: boolean };
type StoreSettings = typeof DEFAULT_SETTINGS;
type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const orderLabels: Record<string, string> = {
  new: "Новый", confirmed: "Подтверждён", assembling: "Собираем", ready: "Готов",
  completed: "Выполнен", cancelled: "Отменён",
};

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function futureDate() {
  const date = new Date(Date.now() + 24 * 60 * 60_000);
  return date.toISOString().slice(0, 10);
}

export function Shop() {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [branches, setBranches] = useState<Branch[]>(BRANCHES);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [storageReady,setStorageReady]=useState(false);
  const [localReady,setLocalReady]=useState(false);
  const [returnToCheckout,setReturnToCheckout]=useState(false);
  const [accountPage,setAccountPage]=useState(0);
  const [accountMore,setAccountMore]=useState(false);
  const [ledger,setLedger]=useState<{delta:number;note:string;created_at:string}[]>([]);
  const requestRef=useRef<{signature:string;key:string;token:string}|null>(null);
  const [filter, setFilter] = useState("Все");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("popular");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailVariant, setDetailVariant] = useState("");
  const [detailExtras, setDetailExtras] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accountOrders, setAccountOrders] = useState<AccountOrder[]>([]);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);

  const [orderLoading, setOrderLoading] = useState(false);
  const [bonusSpend, setBonusSpend] = useState(0);
  const [orderForm, setOrderForm] = useState({
    customerName: "", phone: "", fulfillment: "delivery", address: "", branchId: "kraulya",
    deliveryDate: futureDate(), deliveryTime: "12:00", otherRecipient: false,
    recipientName: "", recipientPhone: "", comment: "", apartment:"",entrance:"",floor:"",intercom:"",consent:false,offerAccepted:false,
  });

  useEffect(() => {
    // Device-local preferences are intentionally restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const savedFavorites=loadLocal<unknown>("dm_favorites",[]);
    setFavorites(Array.isArray(savedFavorites)?savedFavorites.filter(Number.isInteger):[]);
    const savedCart=loadLocal<unknown>("dm_cart",[]);
    setCart(Array.isArray(savedCart)?savedCart.filter((l):l is CartLine=>!!l && typeof l==="object" && Number.isInteger(l.productId) && typeof l.variantId==="string" && typeof l.key==="string" && Number.isInteger(l.quantity) && l.quantity>0 && l.quantity<=20 && Array.isArray(l.extras) && l.extras.length<=50 && l.extras.every((x:unknown)=>typeof x==="string")):[]);
    setLocalReady(true);
    void fetch("/api/store").then((response) => response.json()).then((data) => {
      setStorageReady(!data.storageUnavailable && Array.isArray(data.products));
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (Array.isArray(data.branches)) setBranches(data.branches);
      if (Array.isArray(data.vacancies)) setVacancies(data.vacancies);
    }).catch(() => toast.error("Каталог открыт в резервном режиме")).finally(() => setCatalogLoading(false));
    void loadAccount();
  }, []);

  useEffect(() => { if(localReady) try {localStorage.setItem("dm_favorites", JSON.stringify(favorites));} catch {} }, [favorites,localReady]);
  useEffect(() => { if(localReady) try {localStorage.setItem("dm_cart", JSON.stringify(cart));} catch {} }, [cart,localReady]);
  useEffect(() => {
    // Keep checkout contacts synchronized with the signed-in customer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (customer) setOrderForm((current) => ({ ...current, customerName: customer.name, phone: customer.phone }));
  }, [customer]);

  async function loadAccount(page=0) {
    try {
      const response = await fetch("/api/auth?page="+page);
      const data = await response.json() as { customer?: Customer | null; orders?: AccountOrder[];hasMore?:boolean;ledger?:{delta:number;note:string;created_at:string}[] };
      setCustomer(data.customer || null);
      if(!response.ok) throw new Error("Кабинет недоступен");
      setAccountOrders(data.orders || []);setAccountPage(page);setAccountMore(!!data.hasMore);setLedger(data.ledger||[]);
    } catch { /* account is optional for browsing */ }
  }

  useEffect(() => {
    let stopped=false;
    async function refresh() {
      if(document.hidden) return;
      try {
        const response=await fetch("/api/store",{cache:"no-store"});const data=await response.json();
        if(stopped || !response.ok || data.storageUnavailable) return;
        setProducts(data.products);setCategories(data.categories);setSettings({...DEFAULT_SETTINGS,...data.settings});setStorageReady(true);
      } catch { /* Keep the last loaded catalog; checkout still validates prices. */ }
    }
    const changed=(event:StorageEvent)=>{if(event.key==="dm_catalog_updated")void refresh();};
    window.addEventListener("focus",refresh);window.addEventListener("storage",changed);
    const timer=setInterval(()=>void refresh(),60000);
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("storage",changed);};
  },[]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((product) => !product.hidden && categories.some(c=>c.name===product.category && c.visible))
      .filter((product) => filter === "Все" ? true : filter === "Избранное" ? favorites.includes(product.id) : product.category === filter)
      .filter((product) => !needle || [product.name, product.category, product.composition].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name, "ru") : Number(b.popular) - Number(a.popular));
  }, [products, filter, query, sort, favorites,categories]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const visibleCategories = new Set(categories.filter((item) => item.visible).map((item) => item.name));

    void Promise.resolve(context.registerTool({
      name: "search_catalog",
      title: "Найти товары в каталоге",
      description: "Ищет доступные букеты и подарки магазина по названию, составу или категории без изменения корзины.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 100 },
          category: { type: "string", maxLength: 100 },
        },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const value = input as { query?: unknown; category?: unknown };
        const needle = typeof value.query === "string" ? value.query.trim().toLowerCase() : "";
        const category = typeof value.category === "string" ? value.category.trim() : "";
        if (!needle) throw new Error("Укажите непустой поисковый запрос");
        return {
          products: products
            .filter((product) => product.available && !product.hidden && visibleCategories.has(product.category))
            .filter((product) => !category || product.category === category)
            .filter((product) => [product.name, product.category, product.composition].join(" ").toLowerCase().includes(needle))
            .slice(0, 10)
            .map((product) => ({ id: product.id, name: product.name, category: product.category, price: product.price })),
        };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, [products, categories]);

  const extras = useMemo(() => Array.isArray(settings.extras) ? settings.extras : [], [settings.extras]);
  const resolvedCart = useMemo<ResolvedLine[]>(() => cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    const variant = product?.variants.find((item) => item.id === line.variantId);
    if (!product || !variant) return [];
    const selectedExtras = line.extras.map((id) => extras.find((item) => item.id === id)).filter((item): item is Extra => Boolean(item));
    return [{ ...line, product, variant, selectedExtras, unitPrice: variant.price + selectedExtras.reduce((sum, item) => sum + item.price, 0) }];
  }), [cart, products, extras]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = resolvedCart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const effectiveBonus=Math.max(0,Math.min(bonusSpend,customer?.bonusBalance||0,Math.floor(subtotal*settings.bonusMaxSpendPercent/100)));
  const cartTotal = subtotal + (orderForm.fulfillment === "delivery" ? deliveryQuote?.price ?? 0 : 0) - effectiveBonus;
  const cartAvailable=resolvedCart.length===cart.length && resolvedCart.every(l=>l.product.available && !l.product.hidden && categories.some(c=>c.name===l.product.category && c.visible) && l.variant.available && l.extras.every(id=>extras.some(e=>e.id===id && e.available!==false)));
  const maxBonusSpend = customer ? Math.max(0,Math.min(customer.bonusBalance, Math.floor(subtotal * settings.bonusMaxSpendPercent / 100))) : 0;

  function toggleFavorite(id: number) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function openProduct(product: Product) {
    setDetailProduct(product);
    setDetailVariant(product.variants.find((item) => item.available)?.id || product.variants[0]?.id || "");
    setDetailExtras([]);
  }

  function addToCart(product: Product, variantId?: string, selectedExtras: string[] = []) {
    const variant = product.variants.find((item) => item.id === variantId) || product.variants.find((item) => item.available);
    if (!product.available || !variant?.available) return toast.error("Этот вариант сейчас недоступен");
    const extraKey = [...selectedExtras].sort().join(",");
    const key = `${product.id}:${variant.id}:${extraKey}`;
    setCart((current) => {
      const found = current.find((item) => item.productId===product.id && item.variantId===variant.id && [...item.extras].sort().join(",")===extraKey);
      return found ? current.map((item) => item.key === found.key ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item) : [...current, { key:crypto.randomUUID(), productId: product.id, variantId: variant.id, quantity: 1, extras: selectedExtras }];
    });
    toast.success(`${product.name} добавлен в корзину`);
  }

  function setQuantity(key: string, quantity: number) {
    setCart((current) => quantity < 1 ? current.filter((item) => item.key !== key) : current.map((item) => item.key === key ? { ...item, quantity: Math.min(20, quantity) } : item));
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setCustomer(null);
    setAccountOrders([]);
  }

  function beginCheckout() {
    if(!storageReady) return toast.error("Магазин временно недоступен для заказов");
    if(!cartAvailable) return toast.error("Удалите или замените недоступные товары");
    if (subtotal < settings.minOrder) return toast.error(`Минимальный заказ — ${formatPrice(settings.minOrder)}`);
    setCartOpen(false);
    setCheckoutOpen(true);
    setBonusSpend(0);
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    if(!cartAvailable || !storageReady) return toast.error("Проверьте наличие товаров");
    if(orderForm.fulfillment==="delivery" && !deliveryQuote) return toast.error("Подтвердите адрес и рассчитайте доставку");
    setOrderLoading(true);
    try {
      validateSlot(orderForm.deliveryDate,orderForm.deliveryTime,orderForm.fulfillment,settings);
      const payload={...orderForm,bonusSpend:effectiveBonus,expectedTotal:cartTotal,deliveryToken:deliveryQuote?.token||"",items:cart.map(l=>({productId:l.productId,variantId:l.variantId,quantity:l.quantity,extras:l.extras}))};
      const signature=JSON.stringify({payload,customerId:customer?.id||null});
      if (!requestRef.current) { try { requestRef.current = JSON.parse(sessionStorage.getItem("dm_pending_checkout") || "null"); } catch {} }
      if(requestRef.current?.signature!==signature) requestRef.current={signature,key:crypto.randomUUID(),token:crypto.randomUUID()};
      const pending=requestRef.current;
      try { sessionStorage.setItem("dm_pending_checkout",JSON.stringify(pending)); } catch {}
      const response=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,requestKey:pending.key,accessToken:pending.token}),signal:AbortSignal.timeout(25000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Не удалось оформить заказ");
      rememberOrder({id:data.id,accessToken:pending.token,orderNumber:data.orderNumber,total:data.total});
      setCart([]);setDeliveryQuote(null);requestRef.current=null;setCheckoutOpen(false);
      try {sessionStorage.removeItem("dm_pending_checkout");} catch {}
      void loadAccount();
      if(data.paymentRequired) {
        try {await openOrderPayment({id:data.id,accessToken:pending.token,orderNumber:data.orderNumber,total:data.total});}
        catch(error) {toast.error(error instanceof Error?error.message:"Заказ сохранён. Откройте «Мои заказы», чтобы оплатить.");}
      } else toast.success("Заказ принят. Он доступен в разделе «Мои заказы».");
    } catch(error){toast.error(error instanceof Error?error.message:"Не удалось оформить заказ");}
    finally{setOrderLoading(false);}
  }
  async function payOrder(id:string,token?:string) {
    try {await openOrderPayment({id,accessToken:token});}
    catch(error) {toast.error(error instanceof Error?error.message:"Не удалось открыть оплату");}
  }
  async function connectTelegram() {
    try {const r=await fetch("/api/telegram",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}),d=await r.json();if(!r.ok)throw new Error(d.error);window.location.assign(d.url);}catch(e){toast.error(e instanceof Error?e.message:"Не удалось подключить");}
  }
  function changeExtras(key:string,ids:string[]) {setCart(current=>current.map(l=>l.key===key?{...l,extras:ids}:l));}
  function repeatOrder(order: AccountOrder) {
    const repeated: CartLine[] = [];
    for (const item of order.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      const variant = product?.variants.find((candidate) => candidate.name === item.variantName);
      if (!product?.available || !variant?.available) return toast.error(`«${item.productName}» сейчас недоступен`);
      let extraIds: string[] = [];
      try { extraIds = (JSON.parse(item.extrasJson) as Extra[]).map((extra) => extra.id); } catch { extraIds = []; }
      if(extraIds.some(id=>!extras.some(e=>e.id===id && e.available!==false)))return toast.error("Дополнение из прошлого заказа недоступно");
      const key = crypto.randomUUID();
      repeated.push({ key, productId: product.id, variantId: variant.id, quantity: item.quantity, extras: extraIds });
    }
    setCart(current=>[...current,...repeated]);
    setAccountOpen(false);
    setCartOpen(true);
    toast.success("Заказ добавлен в корзину");
  }

  return (
    <main className="shop-shell">
      <header className="shop-header">
        <a className="shop-brand" href="#top" aria-label="Джентельмен — на главную">
          <span className="shop-logo"><Image src="/brand/logo-watercolor.webp" alt="" fill sizes="58px" /></span>
          <span><strong>ДЖЕНТЕЛЬМЕН</strong><small>цветочная мастерская</small></span>
        </a>
        <nav className="shop-nav"><a href="#catalog">Каталог</a><a href="#delivery">Доставка</a><a href="#about">О нас</a><a href="#contacts">Контакты</a></nav>
        <div className="shop-actions">
          <button className="header-icon" onClick={() => setAccountOpen(true)} aria-label="Личный кабинет"><UserRound /><span className="header-label">{customer ? customer.name.split(" ")[0] : "Войти"}</span></button>
          <button className="header-icon" onClick={() => { setFilter("Избранное"); document.querySelector("#catalog")?.scrollIntoView(); }} aria-label="Избранное"><Heart className={favorites.length ? "filled" : ""} /><b>{favorites.length || ""}</b></button>
          <button className="header-cart" onClick={() => setCartOpen(true)}><ShoppingBag /><span><small>{cartCount ? `${cartCount} шт.` : "Корзина"}</small><strong>{formatPrice(subtotal)}</strong></span></button>
        </div>
      </header>

      <section className="shop-intro" id="top"><div><span className="eyebrow">Екатеринбург · две мастерские 24/7</span><h1>Букеты с вашим настроением</h1></div><Button variant="outline" onClick={()=>setRequestOpen(true)}>Собрать особенный букет</Button></section>

      <RecentOrders/>

      <section className="catalog-section" id="catalog">
        <div className="section-heading"><div><span className="eyebrow">Каталог</span><h2>Выберите настроение</h2><p>Цена и наличие видны сразу. Размер и дополнения можно выбрать в карточке.</p></div><span className="catalog-count">{visibleProducts.length} товаров</span></div>
        <div className="catalog-tools">
          <div className="category-scroll">
            {["Все", ...categories.filter((item) => item.visible).map((item) => item.name), "Избранное"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "Избранное" && favorites.length > 0 ? ` · ${favorites.length}` : ""}</button>)}
          </div>
          <div className="search-sort"><label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или состав" />{query && <button onClick={() => setQuery("")}><X /></button>}</label><label className="catalog-sort"><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Сначала популярные</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option><option value="name">По названию</option></select><ChevronDown /></label></div>
        </div>
        {catalogLoading ? <div className="catalog-loading"><Loader2 className="spin" />Обновляем наличие…</div> : null}
        {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => (
          <article className={`product-card ${product.available ? "" : "sold-out"}`} key={product.id}>
            <button className="product-photo" onClick={() => openProduct(product)} aria-label={`Открыть ${product.name}`}><Image src={product.image} alt={product.name} fill sizes="(max-width: 640px) 48vw, (max-width: 1100px) 31vw, 300px" />{product.badge && <span className="product-badge">{product.badge}</span>}{!product.available && <span className="stock-overlay">Нет в наличии</span>}</button>
            <button className="favorite-button" onClick={() => toggleFavorite(product.id)} aria-label="Добавить в избранное"><Heart className={favorites.includes(product.id) ? "filled" : ""} /></button>
            <div className="product-copy"><span className="product-category">{product.category}</span><button className="product-name" onClick={() => openProduct(product)}>{product.name}</button><p>{product.composition}</p><small className={product.available?"stock-available":"stock-unavailable"}>{product.available?"В наличии":"Нет в наличии"}</small><div className="product-bottom"><div><small>{product.variants.length > 1 ? "от " : ""}</small><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div><Button className="add-button" disabled={!product.available} onClick={() => addToCart(product)}>{product.available ? <ShoppingBag /> : <Clock3 />}{product.available ? "В корзину" : "Ожидаем"}</Button></div></div>
          </article>
        ))}</div> : <div className="empty-catalog"><Heart /><h3>Здесь пока пусто</h3><p>Измените фильтр или добавьте товары в избранное.</p></div>}
      </section>

      <section className="service-strip" id="delivery">
        <article><MapPin /><div><strong>Расчёт по расстоянию</strong><p>Считаем от ближайшей мастерской после ввода адреса.</p></div></article>
        <article><PackageCheck /><div><strong>Самовывоз без доплаты</strong><p>Крауля, 105/3 или Токарей, 33 — круглосуточно.</p></div></article>
        <article><Award /><div><strong>Бонусная система</strong><p>Начисляем {settings.bonusPercent}% и разрешаем списать до {settings.bonusMaxSpendPercent}% заказа.</p></div></article>
      </section>

      <section className="about-section" id="about">
        <div className="about-card"><span className="eyebrow">О мастерской</span><h2>Собираем со вкусом,<br />доставляем с заботой</h2><p>{settings.about}</p><div className="about-numbers"><span><strong>2</strong>филиала</span><span><strong>24/7</strong>работаем</span><span><strong>2 ч</strong>минимальный срок</span></div></div>
        <div className="custom-card"><Gift /><span className="eyebrow">Особый заказ</span><h3>Не нашли подходящий букет?</h3><p>Расскажите про повод, любимые цветы и бюджет. Флорист предложит индивидуальный вариант и перезвонит.</p><Button className="light-pill" onClick={() => setRequestOpen(true)}>Обсудить с флористом</Button></div>
      </section>

      <section className="contacts-section" id="contacts">
        <div className="section-heading"><div><span className="eyebrow">Контакты</span><h2>Две мастерские рядом</h2><p>Единый каталог и телефон. Для самовывоза выберите удобный адрес.</p></div><a className="contact-phone" href={`tel:${settings.phone.replace(/\D/g, "")}`}><Phone />{settings.phone}</a></div>
        <div className="contacts-layout">
          <div className="branch-list">{branches.map((branch) => <article key={branch.id}><span className="open-dot">Открыто 24/7</span><h3>{branch.name}</h3><p><MapPin />{branch.address}</p><p><Phone />{branch.phone}</p><a href={branch.mapUrl} target="_blank" rel="noreferrer">Открыть в Яндекс Картах <ArrowRight /></a></article>)}</div>
          <div className="map-frame"><iframe title="Филиалы Джентельмен на карте" src="https://yandex.ru/map-widget/v1/?ll=60.5433%2C56.8303&z=13&l=map&pt=60.523849,56.831251,pm2rdm~60.562656,56.829384,pm2rdm" loading="lazy" /></div>
        </div>
      </section>

      {vacancies.some((item) => item.active) && <section className="vacancies-section"><span className="eyebrow">Вакансии</span><h2>Работайте с нами</h2><div>{vacancies.filter((item) => item.active).map((vacancy) => <article key={vacancy.id}><h3>{vacancy.title}</h3><p>{vacancy.description}</p><a href={`tel:${settings.phone.replace(/\D/g, "")}`}>Узнать подробнее</a></article>)}</div></section>}

      <footer className="shop-footer">
        <div className="footer-brand"><Image src="/brand/logo-watercolor.webp" alt="" width={64} height={64} /><span><strong>ДЖЕНТЕЛЬМЕН</strong><small>цветочная мастерская</small></span></div>
        <div><strong>Покупателям</strong><a href="#catalog">Каталог</a><a href="#delivery">Доставка и самовывоз</a><button onClick={() => setAccountOpen(true)}>Личный кабинет</button></div>
        <div><strong>Документы</strong><a href="/privacy">Политика конфиденциальности</a><a href="/offer">Публичная оферта</a><a href="/consent">Согласие на обработку данных</a><a href="/admin">Для администратора</a></div>
        <div><strong>Связаться</strong><a href={`tel:${settings.phone.replace(/\D/g, "")}`}>{settings.phone}</a><span>Ежедневно, круглосуточно</span></div>
        <p>© {new Date().getFullYear()} «Джентельмен». Цветы могут незначительно отличаться от фото из-за сезонности.</p>
      </footer>

      <Dialog open={Boolean(detailProduct)} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="product-dialog">{detailProduct && <div className="product-dialog-grid">
          <ProductGallery key={detailProduct.id} images={detailProduct.images} name={detailProduct.name}/>
          <div className="detail-copy"><DialogHeader><span className="product-category">{detailProduct.category}</span><DialogTitle>{detailProduct.name}</DialogTitle><DialogDescription>{detailProduct.description}</DialogDescription></DialogHeader>
            <div className="detail-block"><strong>Состав</strong><p>{detailProduct.composition}</p></div>
            {detailProduct.variants.length===1 && detailProduct.variants[0].id==="one" ? <div className="detail-block"><strong>{detailProduct.singleFlower?"Цена за один цветок":"Цена"}</strong><p>{formatPrice(detailProduct.price)}</p></div> : <div className="detail-block"><strong>Размер</strong><div className="variant-grid">{detailProduct.variants.map((variant) => <button key={variant.id} disabled={!variant.available} className={detailVariant === variant.id ? "active" : ""} onClick={() => setDetailVariant(variant.id)}><span>{variant.name}</span><strong>{formatPrice(variant.price)}</strong>{!variant.available && <small>Нет</small>}</button>)}</div></div>}
            {extras.length > 0 && detailProduct.category !== "Шары" && <div className="detail-block"><strong>Можно добавить</strong><div className="extras-list">{extras.filter(e=>e.available!==false && e.kind!=="flower").map((extra) => <label key={extra.id}><input type="checkbox" checked={detailExtras.includes(extra.id)} onChange={() => setDetailExtras((current) => current.includes(extra.id) ? current.filter((id) => id !== extra.id) : [...current, extra.id])} /><span><b>{extra.name}</b><small>{extra.description}</small></span><strong>+{formatPrice(extra.price)}</strong></label>)}</div></div>}
            <Button className="detail-add" disabled={!detailProduct.available} onClick={() => { addToCart(detailProduct, detailVariant, detailExtras); setDetailProduct(null); setCartOpen(true); }}><ShoppingBag />Добавить — {formatPrice((detailProduct.variants.find((item) => item.id === detailVariant)?.price || detailProduct.price) + extras.filter((item) => detailExtras.includes(item.id)).reduce((sum, item) => sum + item.price, 0))}</Button>
          </div>
        </div>}</DialogContent>
      </Dialog>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="cart-sheet"><SheetHeader><SheetTitle>Корзина <span>{cartCount}</span></SheetTitle><SheetDescription>Проверьте состав заказа перед оформлением.</SheetDescription></SheetHeader>
          {cart.filter(line=>!resolvedCart.some(r=>r.key===line.key)).map(line=><div key={line.key} className="minimum-note">Этот товар или размер удалён из каталога. <Button variant="outline" onClick={()=>setQuantity(line.key,0)}>Убрать из корзины</Button></div>)}{resolvedCart.length ? <><div className="cart-lines">{resolvedCart.map((line) => <article key={line.key}><div className="cart-line-image"><Image src={line.product.image} alt="" fill sizes="82px" /></div><div className="cart-line-copy"><strong>{line.product.name}</strong>{line.variant.id!=="one"&&<span>Размер: {line.variant.name}</span>}{line.selectedExtras.length > 0 && <small>+ {line.selectedExtras.map((item) => item.name).join(", ")}</small>}<div className="quantity"><button onClick={() => setQuantity(line.key, line.quantity - 1)}><Minus /></button><b>{line.quantity}</b><button onClick={() => setQuantity(line.key, line.quantity + 1)}><Plus /></button></div></div><div className="cart-line-price"><button onClick={() => setQuantity(line.key, 0)} aria-label="Удалить"><Trash2 /></button><strong>{formatPrice(line.unitPrice * line.quantity)}</strong></div><div className="cart-line-extras">{(!line.product.available || !line.variant.available || line.extras.some(id=>!extras.some(e=>e.id===id && e.available!==false))) && <p role="alert" className="form-error">Товар или дополнение недоступно. Измените состав.</p>}{line.product.acceptsFlowers!==false && <CartExtras extras={extras} selected={line.extras} flowers onChange={ids=>changeExtras(line.key,ids)}/>}<CartExtras extras={extras} selected={line.extras} flowers={false} onChange={ids=>changeExtras(line.key,ids)}/></div></article>)}</div>
            <div className="cart-summary"><div><span>Товары</span><strong>{formatPrice(subtotal)}</strong></div><small>Доставка рассчитывается по адресу на следующем шаге.</small>{subtotal < settings.minOrder && <div className="minimum-note">До минимального заказа добавьте {formatPrice(settings.minOrder - subtotal)}</div>}<div className="cart-total"><span>Итого без доставки</span><strong>{formatPrice(subtotal)}</strong></div><Button className="checkout-button" onClick={beginCheckout} disabled={subtotal < settings.minOrder || !cartAvailable || !storageReady}>Перейти к оформлению <ArrowRight /></Button></div>
          </> : <div className="cart-empty"><ShoppingBag /><h3>Корзина пока пуста</h3><p>Добавьте букет, композицию или подарок из каталога.</p><Button onClick={() => { setCartOpen(false); document.querySelector("#catalog")?.scrollIntoView(); }}>Перейти в каталог</Button></div>}
        </SheetContent>
      </Sheet>

      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent className="account-sheet"><SheetHeader><SheetTitle>Личный кабинет</SheetTitle><SheetDescription>Бонусы, история и быстрый повтор заказа.</SheetDescription></SheetHeader>
          {customer ? <div className="account-content"><div className="account-hero"><span><UserRound /></span><div><small>Здравствуйте</small><h3>{customer.name}</h3><p>{customer.phone}</p></div><button onClick={() => void logout()} aria-label="Выйти"><LogOut /></button></div><div className="bonus-card"><Award /><div><span>Ваш баланс</span><strong>{formatPrice(customer.bonusBalance)}</strong><small>Можно оплатить до {settings.bonusMaxSpendPercent}% заказа</small></div></div><Button variant="outline" onClick={()=>void connectTelegram()}>Подключить уведомления Telegram</Button><div className="history-title"><History /><div><strong>История заказов</strong><small>{accountOrders.length ? `${accountOrders.length} заказов` : "Пока пусто"}</small></div></div>{accountOrders.length ? <div className="account-orders">{accountOrders.map((order) => <article key={order.id}><div><span>{order.orderNumber}</span><b>{orderLabels[order.status] || order.status}</b></div><p>{order.deliveryDate} · {order.deliveryTime}</p><ul>{order.items.map((item) => <li key={item.id}>{item.productName}, {item.variantName} × {item.quantity}</li>)}</ul><footer><strong>{formatPrice(order.total)}</strong>{order.paymentStatus==="pending" && order.status!=="cancelled" && <button onClick={()=>void payOrder(order.id)}>Оплатить</button>}<button onClick={() => repeatOrder(order)}><RotateCcw />Повторить</button></footer></article>)}</div> : <div className="account-empty">После первого заказа здесь появится история.</div>}<div className="map-actions"><Button variant="outline" disabled={!accountPage} onClick={()=>void loadAccount(accountPage-1)}>Назад</Button><span>Страница {accountPage+1}</span><Button variant="outline" disabled={!accountMore} onClick={()=>void loadAccount(accountPage+1)}>Далее</Button></div><details className="bonus-ledger"><summary>История бонусов</summary>{ledger.map((r,i)=><p key={i}>{r.note} · {r.delta>0?"+":""}{r.delta} баллов</p>)}</details></div> : <CustomerLogin onLogin={async()=>{await loadAccount();toast.success("Вы вошли в личный кабинет");if(returnToCheckout){setAccountOpen(false);setCheckoutOpen(true);setReturnToCheckout(false);}}}/>}
        </SheetContent>
      </Sheet>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="checkout-dialog"><DialogHeader><span className="eyebrow">Оформление</span><DialogTitle>Данные заказа</DialogTitle><DialogDescription>Регистрация необязательна. Поля со звёздочкой нужно заполнить.</DialogDescription></DialogHeader>
          <form className="checkout-form" onSubmit={createOrder}>
            <section><h3><span>1</span>Контакты</h3><div className="form-grid"><label><span>Имя *</span><input required value={orderForm.customerName} onChange={(event) => setOrderForm({ ...orderForm, customerName: event.target.value })} /></label><label><span>Телефон *</span><PhoneInput value={orderForm.phone} onChange={phone=>setOrderForm({...orderForm,phone})} /></label></div>{!customer && <button type="button" className="register-hint" onClick={() => { setReturnToCheckout(true); setCheckoutOpen(false); setAccountOpen(true); }}>Войти или зарегистрироваться, чтобы копить бонусы <ArrowRight /></button>}<label className="check-row"><input type="checkbox" checked={orderForm.otherRecipient} onChange={(event) => setOrderForm({ ...orderForm, otherRecipient: event.target.checked })} /><span>Получатель — другой человек</span></label>{orderForm.otherRecipient && <div className="form-grid"><label><span>Имя получателя</span><input value={orderForm.recipientName} onChange={(event) => setOrderForm({ ...orderForm, recipientName: event.target.value })} /></label><label><span>Телефон получателя</span><PhoneInput value={orderForm.recipientPhone} onChange={recipientPhone=>setOrderForm({...orderForm,recipientPhone})} /></label></div>}</section>
            <section><h3><span>2</span>Получение</h3><div className="fulfillment-tabs"><button type="button" className={orderForm.fulfillment === "delivery" ? "active" : ""} onClick={() => setOrderForm({ ...orderForm, fulfillment: "delivery" })}><Truck />Доставка</button><button type="button" className={orderForm.fulfillment === "pickup" ? "active" : ""} onClick={() => { setOrderForm({ ...orderForm, fulfillment: "pickup" }); setDeliveryQuote(null); }}><PackageCheck />Самовывоз</button></div>{orderForm.fulfillment === "delivery" ? <><AddressPicker address={orderForm.address} onAddress={address=>{setOrderForm(current=>({...current,address}));setDeliveryQuote(null);}} onQuote={setDeliveryQuote} tileUrl={settings.tileUrl} zone={settings.deliveryZone}/><div className="form-grid">{([["apartment","Квартира / офис"],["entrance","Подъезд"],["floor","Этаж"],["intercom","Домофон"]] as const).map(([key,label])=><label key={key}><span>{label}</span><input maxLength={30} value={orderForm[key]} onChange={e=>setOrderForm({...orderForm,[key]:e.target.value})}/></label>)}</div></> : <div className="branch-pick">{branches.map((branch) => <label key={branch.id} className={orderForm.branchId === branch.id ? "active" : ""}><input type="radio" name="branch" checked={orderForm.branchId === branch.id} onChange={() => setOrderForm({ ...orderForm, branchId: branch.id })} /><span><strong>{branch.address}</strong><small>Круглосуточно · бесплатно</small></span></label>)}</div>}<div className="form-grid"><label><span>Дата *</span><input required type="date" min={new Date(Date.now()+5*3600000).toISOString().slice(0,10)} value={orderForm.deliveryDate} onChange={(event) => setOrderForm({ ...orderForm, deliveryDate: event.target.value })} /></label><label><span>Время *</span><input required type="time"  value={orderForm.deliveryTime} onChange={(event) => setOrderForm({ ...orderForm, deliveryTime: event.target.value })} /></label></div><p className="time-note"><Clock3 />Заказ нужен минимум за {settings.leadTimeHours} часа. Доставка {settings.deliveryOpen}–{settings.deliveryClose}.</p></section>
            <section><h3><span>3</span>Пожелания и итог</h3><label><span>Комментарий</span><textarea rows={3} value={orderForm.comment} onChange={(event) => setOrderForm({ ...orderForm, comment: event.target.value })} placeholder="Текст открытки, домофон, важные детали" /></label>{customer && maxBonusSpend > 0 && <div className="bonus-spend"><div><span>Списать бонусы</span><strong>{formatPrice(bonusSpend)}</strong></div><input type="range" min={0} max={maxBonusSpend} step={1} value={effectiveBonus} onChange={(event) => setBonusSpend(Number(event.target.value))} /><small>Доступно {formatPrice(customer.bonusBalance)}, максимум сейчас {formatPrice(maxBonusSpend)}</small></div>}<div className="checkout-total"><div><span>Товары</span><strong>{formatPrice(subtotal)}</strong></div><div><span>Доставка</span><strong>{orderForm.fulfillment === "pickup" ? "Бесплатно" : deliveryQuote ? formatPrice(deliveryQuote.price) : "После расчёта"}</strong></div>{bonusSpend > 0 && <div><span>Бонусы</span><strong>−{formatPrice(bonusSpend)}</strong></div>}<div className="grand-total"><span>Итого</span><strong>{formatPrice(cartTotal)}</strong></div></div><label className="check-row"><input required type="checkbox" checked={orderForm.consent} onChange={e=>setOrderForm({...orderForm,consent:e.target.checked})}/><span>Даю <a href="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a>. <a href="/privacy" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a>.</span></label><label className="check-row"><input required type="checkbox" checked={orderForm.offerAccepted} onChange={e=>setOrderForm({...orderForm,offerAccepted:e.target.checked})}/><span>Принимаю <a href="/offer" target="_blank" rel="noopener noreferrer">публичную оферту</a> и условия заказа.</span></label><Button type="submit" className="checkout-submit" disabled={orderLoading}>{orderLoading ? <Loader2 className="spin" /> : <Check />}{orderLoading ? "Оформляем…" : "Подтвердить заказ"}</Button><small className="payment-note">Окончательная сумма показана выше. Способ оплаты будет указан после сохранения заказа.</small></section>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent className="request-dialog"><DialogHeader><span className="eyebrow">Индивидуальный заказ</span><DialogTitle>Расскажите, что собрать</DialogTitle><DialogDescription>Флорист уточнит наличие, предложит состав и согласует стоимость.</DialogDescription></DialogHeader><CustomRequestForm onSuccess={() => setRequestOpen(false)} /></DialogContent></Dialog>
      <Toaster position="top-center" richColors />
    </main>
  );
}

function CustomRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", comment: "",consent:false });
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
    const response = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) return toast.error(data.error || "Не удалось отправить заявку");
    toast.success("Заявка отправлена — мы перезвоним");
    onSuccess();
    } catch {toast.error("Не удалось отправить заявку. Попробуйте ещё раз.");} finally {setLoading(false);}
  }
  return <form className="request-form" onSubmit={submit}><label><span>Имя</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span>Телефон *</span><PhoneInput value={form.phone} onChange={phone=>setForm({...form,phone})} /></label><label><span>Пожелания *</span><textarea required minLength={10} rows={5} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Повод, гамма, любимые цветы, бюджет и дата" /></label><label className="consent-row"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>Даю <a href="/consent" target="_blank" rel="noopener">согласие на обработку данных</a> для ответа на заявку. <a href="/privacy" target="_blank" rel="noopener">Политика конфиденциальности</a></span></label><Button type="submit" disabled={loading}>{loading ? <Loader2 className="spin" /> : <ArrowRight />}{loading ? "Отправляем…" : "Отправить флористу"}</Button></form>;
}
