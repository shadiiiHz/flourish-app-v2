import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import NewItems from "@/components/NewItems";
import { CATEGORY_TABS, getCatalog, getHeroSlides, getNewProducts } from "@/lib/api";

// The catalog lives on a separate backend service that isn't guaranteed to be
// reachable at build time, so this route is rendered per-request (real SSR)
// instead of being attempted as a static/ISR page during `next build`.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categoriesByTab, newItems, heroSlides] = await Promise.all([
    getCatalog(),
    getNewProducts(),
    getHeroSlides(),
  ]);

  return (
    <>
      <Hero slides={heroSlides} />
      <Categories tabs={CATEGORY_TABS} categoriesByTab={categoriesByTab} />
      <NewItems items={newItems} />
    </>
  );
}
