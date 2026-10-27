// The browse page's outer grid shell (aside + main). Named for the page,
// not just the sidebar, since it lays out and owns the responsive
// behavior of both columns, not only the aside one. On mobile (below
// `md`) the sidebar slot is hidden entirely: `hidden` removes it from
// layout, not just from view, and the grid collapses to a single column.
// The caller is expected to render MobileFilterBar inside `children`
// instead, showing the same filters as a horizontal pill row. That swap
// uses plain `md:` breakpoint classes, not a JS viewport check, so there
// is no post-mount "wrong layout first" flash the way reading
// window.innerWidth in an effect would cause.
export function BrowsePageShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)]">
      {/* self-start: grid items stretch to fill row height by default,
          which leaves a stretched sticky element no room to move.
          top-17.25 is SiteHeader's h-17 (68px) plus its border-b (1px),
          its true rendered height. will-change-transform hints the
          browser to promote this sticky element to its own GPU
          compositing layer at paint time rather than lazily on the first
          scroll gesture - see SiteHeader for the same treatment and why
          it helps. */}
      <aside className="sticky top-17.25 hidden self-start py-7 will-change-transform md:block">{sidebar}</aside>
      {/* Smaller top padding on mobile only - the gap under the header
          only needs to clear the mobile filter bar's own row, not the
          taller sidebar's category list, which doesn't exist at this
          width. */}
      <main className="min-w-0 pt-4 pb-7 sm:pt-7">{children}</main>
    </div>
  );
}
