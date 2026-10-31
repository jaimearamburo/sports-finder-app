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
          ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status === "upcoming" ? "Upcoming" : "Past"}
    </span>
  );
}

// One entry per order (getUserBookingOrders groups the rows, so a pass is one
// entry). The reference opens a dialog with the per-slot breakdown; there's no
// detail page. One shared Dialog driven by the open orderId, rather than one
// per row.
export function BookingsTable({ orders }: { orders: BookingOrder[] }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const openOrder = orders.find((order) => order.orderId === openOrderId) ?? null;

  // Shared by the desktop table and the phone cards.
  const rows = orders.map((order) => ({
    order,
    firstSlot: order.slots[0],
    lastSlot: order.slots[order.slots.length - 1],
  }));

  return (
    <>
      {/* A table from md up. Below md it's replaced by cards rather than
          scrolled, so the status column is never cut off. */}
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
                  {formatBookingTime(firstSlot.startsAt, lastSlot.endsAt, order.timeZone, order)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per order with every field visible. */}
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
              {formatBookingTime(firstSlot.startsAt, lastSlot.endsAt, order.timeZone, order)}
            </p>
          </div>
        ))}
      </div>

      {/* One Dialog whose content follows the open order. onOpenChange only
          handles closing; opening goes through setOpenOrderId. */}
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
                    {/* "× n" when one booking covers several people, so the
                        total visibly adds up. */}
                    {openOrder.slots.map((slot) => (
                      <li key={slot.id} className="flex justify-between gap-3">
                        <span>{formatBookingTime(slot.startsAt, slot.endsAt, openOrder.timeZone, openOrder)}</span>
                        {slot.quantity > 1 && (
                          <span className="shrink-0 font-medium tabular-nums">× {slot.quantity}</span>
                        )}
                      </li>
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
