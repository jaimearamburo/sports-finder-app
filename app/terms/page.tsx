import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Terms | PlayBook" };

export default function TermsPage() {
  return (
    <InfoPage title="Terms" summary="PlayBook is a portfolio project, not a real booking service.">
      <section>
        <h2>Nothing here is real</h2>
        <p>
          The venues, listings and bookings are sample data. No booking made here reserves anything, and no venue
          will expect you.
        </p>
      </section>
      <section>
        <h2>Payments are test payments</h2>
        <p>
          Checkout runs in Stripe&apos;s test mode. Use a test card such as 4242 4242 4242 4242; real cards are
          refused and nothing is ever charged.
        </p>
      </section>
      <section>
        <h2>Demo accounts are shared</h2>
        <p>
          Anyone can log in as the demo user or the demo venue owner, so anything you change with those accounts can
          be seen and changed by other visitors. The data may be reset at any time.
        </p>
      </section>
      <section>
        <h2>Venue terms</h2>
        <p>
          Each venue&apos;s booking terms, shown at checkout, are sample text too. In a live version, venues would
          set their own cancellation, no-show and conduct rules.
        </p>
      </section>
      <p className="text-muted-foreground">
        See also the <Link href="/privacy">Privacy</Link> page.
      </p>
    </InfoPage>
  );
}
