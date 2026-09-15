// City, price range, and booking type are not wired to the query yet.
export function SidebarFilters() {
  return (
    <div className="mt-7 flex flex-col gap-7">
      <div className="border-t pt-4.5">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">City</h3>
        <select className="h-9 w-full rounded-md border bg-transparent px-2.5 text-sm">
          <option>All cities</option>
          <option>Sydney</option>
          <option>Melbourne</option>
          <option>Blue Mountains</option>
        </select>
      </div>

      <div className="border-t pt-4.5">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Price range</h3>
        <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
          <span>$0</span>
          <span>$100+</span>
        </div>
        {/* Decorative placeholder, not a real range input. */}
        <div className="relative h-1 rounded-full bg-border">
          <div className="absolute inset-y-0 right-[35%] left-[15%] rounded-full bg-primary" />
          <div className="absolute top-1/2 left-[15%] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
          <div className="absolute top-1/2 left-[65%] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
        </div>
      </div>

      <div className="border-t pt-4.5">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Booking type</h3>
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <input type="checkbox" className="size-3.75 accent-primary" />
            Book a time
          </label>
          <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <input type="checkbox" className="size-3.75 accent-primary" />
            Multi-day
          </label>
          <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <input type="checkbox" className="size-3.75 accent-primary" />
            Classes
          </label>
        </div>
      </div>
    </div>
  );
}
