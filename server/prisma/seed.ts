import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type CategoryTab } from "@prisma/client";

const prisma = new PrismaClient();

interface CategorySeed {
  slug: string;
  tab: CategoryTab;
  title: string;
  image: string;
  note?: string;
}

const CATEGORIES: CategorySeed[] = [
  { slug: "bakery", tab: "bakery", title: "بیکری", image: "/seed/mainCat/bakery.svg" },
  { slug: "pastry", tab: "bakery", title: "پیستری", image: "/seed/mainCat/pastry.svg" },
  {
    slug: "cake",
    tab: "bakery",
    title: "کیک",
    image: "/seed/mainCat/cake.svg",
    note: "تمام شیرینی های فرانسوی از ۴۸ ساعت قبل به صورت کیک در سایزهای مختلف قابل سفارش هستند",
  },
  { slug: "custom", tab: "bakery", title: "آیتم‌های سفارشی", image: "/seed/mainCat/order.svg" },
  { slug: "sourdough", tab: "bakery", title: "نان خمیر ترش", image: "/seed/mainCat/bread.svg" },
  { slug: "pantry", tab: "bakery", title: "پینتری", image: "/seed/mainCat/paintry.svg" },
  {
    slug: "hot-espresso",
    tab: "drinks",
    title: "نوشیدنی گرم بر پایه اسپرسو",
    image: "/seed/mainCat/hot-coffee.svg",
  },
  {
    slug: "cold-espresso",
    tab: "drinks",
    title: "نوشیدنی سرد بر پایه اسپرسو",
    image: "/seed/mainCat/iced-coffee.svg",
  },
  { slug: "cold-drinks", tab: "drinks", title: "نوشیدنی سرد", image: "/seed/mainCat/iced-drink.svg" },
  { slug: "matcha", tab: "drinks", title: "ماچا", image: "/seed/mainCat/macha.svg" },
  {
    slug: "flavored-hot-milk",
    tab: "drinks",
    title: "شیر داغ طعم‌دار",
    image: "/seed/mainCat/milk.svg",
  },
  { slug: "tea-herbal", tab: "drinks", title: "چای و دمنوش", image: "/seed/mainCat/tea.svg" },
  { slug: "extra", tab: "drinks", title: "افزودنی ها", image: "/seed/mainCat/plus.svg" },
];

const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toPersianDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)]);

interface NewItemSeed {
  categorySlug: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  weight?: string;
  ingredients?: string;
  servingSize?: string;
  discountPercent?: number;
  stock?: number;
  variants?: { title: string; price: number; weight?: string; stock?: number; image?: string }[];
}

const NEW_ITEMS: NewItemSeed[] = [
  {
    categorySlug: "pastry",
    title: "کروسان کره‌ای",
    description: "کروسان تازه و لایه‌لایه با کره فرانسوی",
    price: 85000,
    images: ["/seed/items/1.jpg"],
    discountPercent: 20,
    weight: "۹۰ گرم",
    ingredients: "آرد گندم، کره فرانسوی، شکر، مخمر، نمک",
    servingSize: "۱ نفر",
    variants: [
      { title: "کروسان", price: 85000, weight: "۹۰ گرم", stock: 12, image: "/seed/items/1.jpg" },
      { title: "مینی کروسان", price: 45000, weight: "۴۵ گرم", stock: 20, image: "/seed/items/1-1.jpeg" },
    ],
  },
  {
    categorySlug: "sourdough",
    title: "نان خمیر ترش",
    description: "نان سنتی پخت‌شده با مایه ترش طبیعی",
    price: 65000,
    images: ["/seed/items/2.jpg", "/seed/items/2-2.jpg"],
    weight: "۵۰۰ گرم",
    ingredients: "آرد سبوس‌دار، آب، مایه ترش طبیعی، نمک",
    servingSize: "۳ تا ۴ نفر",
    stock: 8,
  },
  {
    categorySlug: "hot-espresso",
    title: "لاته وانیل",
    description: "اسپرسو با شیر بخاردیده و شربت وانیل",
    price: 120000,
    images: [],
    weight: "۳۶۰ میلی‌لیتر",
    ingredients: "اسپرسو، شیر، شربت وانیل",
    servingSize: "۱ نفر",
  },
  {
    categorySlug: "matcha",
    title: "ماچا لاته",
    description: "ماچا ژاپنی اصل با شیر بادام",
    price: 135000,
    images: [],
    weight: "۳۶۰ میلی‌لیتر",
    ingredients: "پودر ماچا درجه‌یک، شیر بادام، شربت وانیل",
    servingSize: "۱ نفر",
  },
  {
    categorySlug: "cake",
    title: "کیک شکلاتی",
    description: "کیک لایه‌ای با گاناش شکلات تلخ",
    price: 220000,
    images: [],
    discountPercent: 15,
    weight: "۱۲۰۰ گرم",
    ingredients: "شکلات تلخ، آرد، تخم‌مرغ، کره، خامه",
    servingSize: "۶ تا ۸ نفر",
    stock: 5,
  },
  {
    categorySlug: "cold-drinks",
    title: "آیس تی هلو",
    description: "دمنوش سرد و خنک با طعم هلو",
    price: 95000,
    images: [],
    weight: "۴۵۰ میلی‌لیتر",
    ingredients: "چای سیاه، شربت هلو، یخ، لیمو",
    servingSize: "۱ نفر",
  },
];

async function main() {
  const categoryIds = new Map<string, string>();

  for (const [index, cat] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { tab: cat.tab, title: cat.title, image: cat.image, note: cat.note, sortOrder: index },
      create: { ...cat, sortOrder: index },
    });
    categoryIds.set(cat.slug, category.id);

    const existingPlaceholders = await prisma.product.count({
      where: { categoryId: category.id, isNew: false },
    });
    if (existingPlaceholders === 0) {
      await prisma.product.createMany({
        data: Array.from({ length: 4 }, (_, i) => ({
          categoryId: category.id,
          title: `${cat.title} ${toPersianDigits(i + 1)}`,
          description: "توضیحات این محصول به‌زودی تکمیل می‌شود",
          price: 0,
          images: [],
          weight: "به‌زودی",
          ingredients: "به‌زودی تکمیل می‌شود",
          servingSize: "به‌زودی",
          sortOrder: i,
        })),
      });
    }
  }

  for (const item of NEW_ITEMS) {
    const categoryId = categoryIds.get(item.categorySlug);
    if (!categoryId) continue;

    const existing = await prisma.product.findFirst({
      where: { categoryId, title: item.title, isNew: true },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        categoryId,
        title: item.title,
        description: item.description,
        price: item.price,
        images: item.images,
        weight: item.weight,
        ingredients: item.ingredients,
        servingSize: item.servingSize,
        discountPercent: item.discountPercent,
        stock: item.stock,
        isNew: true,
        variants: item.variants ? { create: item.variants } : undefined,
      },
    });
  }

  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash,
        name: process.env.ADMIN_SEED_NAME ?? "مدیر فلوریش",
        role: "owner",
      },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.warn("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping admin user seed.");
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
