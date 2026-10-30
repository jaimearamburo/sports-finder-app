"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBookingTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { ManagerBookingOrder } from "@/lib/dashboard/bookings";

// The order's date(s) on one line. A multi-day pass shows its first day
// and how many more, so a long pass doesn't stretch the row; the dialog
// lists every day.
function whenLine(order: ManagerBookingOrder): string {
  const first = order.slots[0];
  const line = formatBookingTime(first.startsAt, first.endsAt, order.timeZone, order);
  return order.slots.length > 1 ? `${line} + ${order.slots.length - 1} more` : line;
}

function StatusBadge({ order }: { order: ManagerBookingOrder }) {
  // "Payment processing" wins over upcoming/past: it's the one state that
  // may still change on its own (see completeOrderPayment).
  const [label, tone] =
    order.status === "pending"
      ? ["Payment processing", "bg-muted text-muted-foreground"]
      : order.upcoming
        ? ["Upcoming", "bg-emerald-600/10 text-emerald-800"]
        : ["Past", "bg-muted text-muted-foreground"];
  return <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", tone)}>{label}</span>;
}

function ReferenceButton({ order, onOpen }: { order: ManagerBookingOrder; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Booking ${order.reference}, details`}
      className="font-mono font-semibold text-foreground underline underline-offset-2 hover:text-primary"
    >
      {order.reference}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

// The bookings list for venue managers: a table on desktop, cards on
// phones (the pattern My Bookings and the overview use). The reference
// opens one shared dialog with the full order - every date, the
// attendee's contact details and what was paid - rather than a separate
// page, since the list already holds everything.
export function ManagerBookingsTable({ orders }: { orders: ManagerBookingOrder[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = orders.find((order) => order.orderId === openId) ?? null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">When (venue time)</th>
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Attendee</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <ReferenceButton order={order} onOpen={() => setOpenId(order.orderId)} />
                </td>
                <td className="px-4 py-3">{whenLine(order)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{order.listingName}</p>
                  <p className="text-muted-foreground">{order.venueName}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{order.attendeeName}</p>
                  <p className="text-muted-foreground">{order.attendeeEmail}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{order.quantity}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(order.totalAmount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge order={order} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {orders.map((order) => (
          <li key={order.orderId} className="rounded-md border bg-card p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <ReferenceButton order={order} onOpen={() => setOpenId(order.orderId)} />
              <StatusBadge order={order} />
            </div>
            <p className="mt-2 font-medium">{order.listingName}</p>
            <p className="text-muted-foreground">{order.venueName}</p>
            <p className="mt-1">{whenLine(order)}</p>
            <p className="mt-1 text-muted-foreground">
              {order.attendeeName}
              {order.quantity > 1 && <> · × {order.quantity}</>} · {formatMoney(order.totalAmount)}
            </p>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        {open && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booking {open.reference}</DialogTitle>
              <DialogDescription>
                {open.listingName} · {open.venueName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {open.slots.length > 1 ? `${open.slots.length} days` : "When"} (venue time)
                </h3>
                <ul className="flex flex-col gap-1">
                  {open.slots.map((slot) => (
                    <li key={slot.id} className="flex justify-between gap-3">
                      <span>{formatBookingTime(slot.startsAt, slot.endsAt, open.timeZone, open)}</span>
                      {slot.quantity > 1 && <span className="shrink-0 font-medium tabular-nums">× {slot.quantity}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="flex flex-col gap-2 border-t pt-4">
                <DetailRow label="Attendee">{open.attendeeName}</DetailRow>
                <DetailRow label="Email">
                  <a href={`mailto:${open.attendeeEmail}`} className="underline underline-offset-2 hover:text-primary">
                    {open.attendeeEmail}
                  </a>
                </DetailRow>
                {open.attendeePhone && (
                  <DetailRow label="Phone">
                    <a href={`tel:${open.attendeePhone}`} className="underline underline-offset-2 hover:text-primary">
                      {open.attendeePhone}
                    </a>
                  </DetailRow>
                )}
                {open.bookedByEmail && <DetailRow label="Booked by">{open.bookedByEmail}</DetailRow>}
              </dl>
              <dl className="flex flex-col gap-2 border-t pt-4">
                <DetailRow label="Paid">
                  <span className="font-semibold tabular-nums">{formatMoney(open.totalAmount)}</span>
                </DetailRow>
                <DetailRow label="Booked on">
                  {open.bookedAt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </DetailRow>
                <DetailRow label="Status">
                  <StatusBadge order={open} />
                </DetailRow>
              </dl>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
