import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import NewItems from "@/components/NewItems";
import ComboItems from "@/components/ComboItems";
import SeasonalItems from "@/components/SeasonalItems";
import { CATEGORY_TABS, getCatalog, getComboProducts, getHeroSlides, getNewProducts, getSeasonalSection } from "@/lib/api";

// The catalog lives on a separate backend service that isn't guaranteed to be
// reachable at build time, so this route is rendered per-request (real SSR)
// instead of being attempted as a static/ISR page during `next build`.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categoriesByTab, newItems, comboItems, heroSlides, seasonal] = await Promise.all([
    getCatalog(),
    getNewProducts(),
    getComboProducts(),
    getHeroSlides(),
    getSeasonalSection(),
  ]);

  return (
    <>
      <Hero slides={heroSlides} />
      <Categories tabs={CATEGORY_TABS} categoriesByTab={categoriesByTab} />
      <SeasonalItems items={seasonal.items} theme={seasonal.theme} />
      <NewItems items={newItems} />
      <ComboItems items={comboItems} />
    </>
  );
}
