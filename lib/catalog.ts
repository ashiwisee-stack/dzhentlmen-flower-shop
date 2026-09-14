export type ProductVariant = { id: string; name: string; price: number; available: boolean };

export type Product = {
  acceptsFlowers?: boolean;
  showRecommendations?: boolean;
  singleFlower?: boolean;
  flowerExtraId?: string;
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  images: string[];
  variants: ProductVariant[];
  description: string;
  composition: string;
  badge?: string;
  available: boolean;
  hidden: boolean;
  popular: boolean;
};

export type Category = { id: number; slug: string; name: string; sortOrder: number; visible: boolean };
export type Extra = { id: string; name: string; price: number; description: string; available?: boolean; kind?: "flower" | "accessory"; image?: string };
export type Branch = { id: string; name: string; address: string; phone: string; coordinates: [number, number]; mapUrl: string };

const sizes = (small: number, medium: number, large: number): ProductVariant[] => [
  { id: "s", name: "S", price: small, available: true },
  { id: "m", name: "M", price: medium, available: true },
  { id: "l", name: "L", price: large, available: true },
];
const oneSize = (price: number): ProductVariant[] => [{ id: "one", name: "Один размер", price, available: true }];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, slug: "bouquets", name: "Букеты", sortOrder: 0, visible: true },
  { id: 2, slug: "mono", name: "Монобукеты", sortOrder: 1, visible: true },
  { id: 3, slug: "compositions", name: "Композиции", sortOrder: 2, visible: true },
  { id: 4, slug: "balloons", name: "Шары", sortOrder: 3, visible: true },
  { id: 5, slug: "gifts", name: "Подарки", sortOrder: 4, visible: true },
];

export const DEFAULT_EXTRAS: Extra[] = [
  { id:"rose-stem", name:"Роза лавандовая, 1 шт.", price:250, description:"Добавим в выбранный букет", available:true, kind:"flower", image:"/products/rose-stem.webp" },
  { id:"tulip-stem", name:"Тюльпан розовый, 1 шт.", price:190, description:"Добавим в выбранный букет", available:true, kind:"flower", image:"/products/tulip-stem.webp" },
  { id:"chrysanthemum-stem", name:"Хризантема кустовая, 1 шт.", price:220, description:"Добавим в выбранный букет", available:true, kind:"flower", image:"/products/chrysanthemum-stem.webp" },
  { id: "food", name: "Средство для цветов", price: 190, description: "Продлевает свежесть букета" },
  { id: "transport", name: "Транспортировочная упаковка", price: 290, description: "Защита от холода и ветра" },
  { id: "vase", name: "Стеклянная ваза", price: 1490, description: "Подходящий размер для букета" },
  { id: "card", name: "Открытка с вашим текстом", price: 150, description: "Подпишем от руки" },
];

export const BRANCHES: Branch[] = [
  { id: "kraulya", name: "Джентельмен на Крауля", address: "Екатеринбург, ул. Крауля, 105/3", phone: "+7 963 049-25-21", coordinates: [56.831251, 60.523849], mapUrl: "https://yandex.ru/profile/33212404666" },
  { id: "tokarey", name: "Джентельмен на Токарей", address: "Екатеринбург, ул. Токарей, 33", phone: "+7 963 049-25-21", coordinates: [56.829384, 60.562656], mapUrl: "https://yandex.ru/profile/198770954307" },
];

export const DEFAULT_SETTINGS = {
  customOrderStatuses: [] as string[],
  legalName: "Индивидуальный предприниматель Аббасалиева Айтадж Савадхан кызы", inn: "665814896100", ogrnip: "325665800130472", legalAddress: "", contactEmail: "abbasalieva.aytadzh@mail.ru",
  bankAccount:"40802810416750014015", bankName:"УРАЛЬСКИЙ БАНК ПАО СБЕРБАНК", bankBik:"046577674", bankCorrespondent:"30101810500000000674", bankInn:"7707083893", bankKpp:"665843001",
  demoCatalog: true,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  deliveryMode: "estimate",
  deliveryZone: [[56.94,60.45],[56.94,60.75],[56.72,60.75],[56.72,60.45]],
  minOrder: 2000,
  deliveryBase: 0,
  deliveryPerKm: 50,
  deliveryIncludedKm: 2,
  deliveryOpen: "08:00",
  deliveryClose: "00:00",
  leadTimeHours: 2,
  bonusPercent: 5,
  bonusMaxSpendPercent: 50,
  phone: "+7 963 049-25-21",
  about: "Джентельмен — цветочная мастерская Екатеринбурга. Собираем букеты круглосуточно, бережно упаковываем и доставляем по городу.",
  extras: DEFAULT_EXTRAS,
};

const product = (id: number, name: string, category: string, image: string, variants: ProductVariant[], composition: string, options: Partial<Product> = {}): Product => ({
  id, slug: `product-${id}`, name, category, image, images: [image], variants, acceptsFlowers:!["Шары","Подарки"].includes(category),
  price: Math.min(...variants.filter((item) => item.available).map((item) => item.price)),
  description: "Авторская работа флориста в фирменной упаковке. Итоговый состав может незначительно меняться по сезону с сохранением гаммы и настроения.",
  composition, available: true, hidden: false, popular: false, ...options,
});

export const DEFAULT_PRODUCTS: Product[] = [
  product(1, "Лавандовое утро", "Букеты", "/products/lilac-roses.webp", sizes(3490, 4990, 7490), "Роза, эустома, статица, эвкалипт", { badge: "Выбор флориста", popular: true }),
  product(2, "Нежный шёпот", "Букеты", "/products/pink-peonies.webp", sizes(3990, 5490, 7990), "Пионы, ранункулюсы, кустовая роза", { badge: "Сезонный", popular: true }),
  product(3, "Бархатный вечер", "Букеты", "/products/plum-callas.webp", sizes(4290, 6290, 8990), "Каллы, розы, хризантема, эвкалипт", { badge: "Премиум" }),
  product(4, "Белый сад", "Композиции", "/products/white-hatbox.webp", sizes(2990, 4590, 6990), "Белые садовые розы, эустома, эвкалипт", { popular: true }),
  product(5, "Пионовый рассвет", "Монобукеты", "/products/pink-peonies.webp", sizes(4490, 5990, 8490), "Розовые пионы, сезонная зелень", { badge: "Скоро вернётся", available: false, variants: sizes(4490, 5990, 8490).map((v) => ({ ...v, available: false })) }),
  product(6, "Лиловая история", "Композиции", "/products/white-hatbox.webp", sizes(3890, 5290, 7690), "Розы, эустома, гортензия, эвкалипт", { badge: "−9%", oldPrice: 5790 }),
  product(7, "Воздушное признание", "Букеты", "/products/lavender-morning.webp", sizes(3290, 4790, 7190), "Роза, диантус, лимониум, зелень"),
  product(8, "Сливовый акцент", "Букеты", "/products/plum-evening.webp", sizes(3790, 5590, 8290), "Роза, калла, орхидея, эвкалипт", { badge: "Новинка" }),
  product(9, "Лавандовое признание", "Букеты", "/products/lilac-roses.webp", sizes(2990, 4490, 6490), "Лавандовые розы, эустома, статица и эвкалипт", { popular: true }),
  product(10, "19 розовых пионов", "Монобукеты", "/products/pink-peonies.webp", sizes(3990, 6490, 9990), "Свежие розовые пионы"),
  product(11, "Каллы Бордо", "Монобукеты", "/products/plum-callas.webp", sizes(3590, 5490, 7890), "Каллы глубокого винного оттенка"),
  product(12, "Облако в шляпной коробке", "Композиции", "/products/white-hatbox.webp", sizes(3990, 5990, 8990), "Гортензия, роза, эустома, эвкалипт", { popular: true }),
  product(13, "Композиция Аметист", "Композиции", "/products/plum-evening.webp", sizes(4290, 6490, 9490), "Роза, орхидея, калла, сезонная зелень"),
  product(14, "Лавандовая коробка", "Композиции", "/products/white-hatbox.webp", sizes(3690, 5290, 7790), "Розы, статица, эустома"),
  product(15, "Шары Лиловый праздник", "Шары", "/products/balloons.webp", oneSize(2890), "7 гелиевых шаров, ленты и грузик", { badge: "Готовый набор" }),
  product(16, "Шары Нежное облако", "Шары", "/products/balloons.webp", oneSize(3990), "11 гелиевых шаров в фирменной гамме"),
  product(17, "Подарочный бокс Забота", "Подарки", "/products/gift-set.webp", oneSize(4990), "Мини-букет, свеча, конфеты ручной работы", { popular: true }),
  product(18, "Комплимент Джентельмен", "Подарки", "/products/gift-set.webp", oneSize(3490), "Мини-букет и набор шоколадных конфет"),
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}
