// The browse page's two-column grid (sidebar + results). Below md the sidebar
// is hidden and the caller renders MobileFilterBar in `children` instead; the
// swap uses breakpoint classes, so there's no layout flash after mount.
//
// SiteHeader mirrors the 200px sidebar column, gap-8 and side padding so its
// search box lines up with the results; change them together.
export function BrowsePageShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)]">
      {/* self-start so the sticky aside has room to move (grid items stretch by
          default). top-17.25 is SiteHeader's 68px plus its 1px border.
          will-change-transform promotes it to its own layer up front (see
          SiteHeader). */}
      <aside className="sticky top-17.25 hidden self-start py-7 will-change-transform md:block">{sidebar}</aside>
      {/* A div, not <main>: the root layout owns the page's single <main>. Less
          top padding on phones, where only the filter bar's row sits above. */}
      <div className="min-w-0 pt-4 pb-7 sm:pt-7">{children}</div>
    </div>
  );
}
