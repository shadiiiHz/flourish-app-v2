import type { Metadata } from "next";
import CategoryMenuView from "@/components/CategoryMenuView";
import { CATEGORY_TABS, getCatalog } from "@/lib/api";

export const metadata: Metadata = {
  title: "منو | فلوریش",
  description: "منوی کامل نوشیدنی، نان و شیرینی بوتیک فلوریش.",
};

// Same reasoning as the home page: render per-request rather than at build time.
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const categoriesByTab = await getCatalog();

  return <CategoryMenuView tabs={CATEGORY_TABS} categoriesByTab={categoriesByTab} />;
}
