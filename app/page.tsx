import { CategoryNav } from "@/components/browse/category-nav";

// This becomes the browse/landing page (Phase 4).
export default function Home() {
  return (
    <div className="mx-auto grid w-full max-w-[1800px] grid-cols-[240px_minmax(0,1fr)] gap-8 px-4 py-7 sm:px-6 lg:px-8">
      <aside>
        <CategoryNav />
      </aside>

      <main className="text-sm text-muted-foreground">
        Results will go here (tag filters, then result cards).
      </main>
    </div>
  );
}
