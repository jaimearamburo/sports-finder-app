"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBookingTime } from "@/lib/dates";
import type { BookingOrder } from "@/lib/bookings";

function StatusBadge({ status }: { status: BookingOrder["status"] }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-xs font-medium",
        status === "upcoming"
          ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status === "upcoming" ? "Upcoming" : "Past"}
    </span>
  );
}

// One entry per order (every Booking row sharing an orderId already
// collapsed into one by getUserBookingOrders - a multi-day pass is one
// purchase, not several unrelated rows). The reference number is the only
// clickable part of an entry; clicking it opens a Dialog with the full
// per-slot breakdown rather than navigating anywhere - there's no more
// detailed page to navigate TO that this table doesn't already have the
// data for. One Dialog shared by every entry (not one per row/card) and
// driven by which orderId is "open," rather than each one owning its own
// uncontrolled Dialog/DialogTrigger pair the way the checkout page's
// single Terms dialog does - that pattern doesn't extend to a list with
// an unknown number of entries.
export function BookingsTable({ orders }: { orders: BookingOrder[] }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const openOrder = orders.find((order) => order.orderId === openOrderId) ?? null;

  // Derived once, shared by both the desktop table and the mobile card
  // list below, so the two renderings of the same data can't drift apart.
  const rows = orders.map((order) => ({
    order,
    firstSlot: order.slots[0],
    lastSlot: order.slots[order.slots.length - 1],
  }));

  return (
    <>
      {/* Desktop/tablet: a real table. Below md it's replaced entirely
          (not just horizontally scrolled) by the card list further down -
          a table that's merely scrollable still cuts off the Status
          column at a glance on a phone, which is the whole point of
          showing status at all. */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, firstSlot, lastSlot }) => (
              <tr key={order.orderId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(order.orderId)}
                    className="font-mono font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    {order.reference}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{order.listingName}</p>
                  <p className="text-muted-foreground">
                    {order.venueName}, {order.cityName}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatBookingTime(firstSlot.startsAt, lastSlot.endsAt, order.timeZone)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one stacked card per order, same data as the table above
          with nothing cropped - every field (reference, listing, date,
          status) is fully visible without horizontal scrolling. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ order, firstSlot, lastSlot }) => (
          <div key={order.orderId} className="rounded-md border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setOpenOrderId(order.orderId)}
                className="font-mono font-semibold text-foreground underline underline-offset-2 hover:text-primary"
              >
                {order.reference}
              </button>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 font-medium text-foreground">{order.listingName}</p>
            <p className="text-sm text-muted-foreground">
              {order.venueName}, {order.cityName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBookingTime(firstSlot.startsAt, lastSlot.endsAt, order.timeZone)}
            </p>
          </div>
        ))}
      </div>

      {/* One Dialog, its content swapped by which order is currently
          open - see this component's own comment above for why that's
          one Dialog rather than one per row. onOpenChange only ever needs
          to react to a close (Escape, overlay click, the X button); an
          open is always driven by setOpenOrderId above instead. */}
      <Dialog open={openOrder !== null} onOpenChange={(open) => !open && setOpenOrderId(null)}>
        <DialogContent>
          {openOrder && (
            <>
              <DialogHeader>
                <DialogTitle>{openOrder.listingName}</DialogTitle>
                <DialogDescription>
                  {openOrder.venueName}, {openOrder.cityName}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-semibold">{openOrder.reference}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={openOrder.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Booked for</span>
                  <span>{openOrder.attendeeName}</span>
                </div>
                <div className="border-t pt-3">
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {openOrder.slots.length > 1 ? "Dates" : "Date"}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {openOrder.slots.map((slot) => (
                      <li key={slot.id}>{formatBookingTime(slot.startsAt, slot.endsAt, openOrder.timeZone)}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-muted-foreground">Total paid</span>
                  <span className="font-mono font-semibold">${openOrder.totalAmountPaid.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
