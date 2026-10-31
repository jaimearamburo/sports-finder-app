import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Privacy | PlayBook" };

// Keep this in step with what the app actually stores and sends: it's a
// plain description of the code, not legal boilerplate.
export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy" summary="What this demo stores, and where it goes.">
      <section>
        <h2>What&apos;s stored</h2>
        <ul>
          <li>Your account: name, email, and your password as a one-way hash (never the password itself). With Google sign-in, the name and email Google shares.</li>
          <li>Your bookings, including the attendee&apos;s name, email and optional phone number you enter at checkout.</li>
          <li>For venue owners: the venues, listings and photos you add.</li>
        </ul>
      </section>
      <section>
        <h2>What&apos;s sent elsewhere</h2>
        <ul>
          <li>Card details go straight to Stripe (test mode) and never reach this site.</li>
          <li>What you type in the search box is sent to an AI model (Anthropic&apos;s Haiku 5.5) to turn it into filters. Nothing about your account is sent with it.</li>
          <li>The site runs on Vercel, with the database on Supabase and photos in Vercel Blob storage.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>One cookie keeps you signed in. There are no analytics, advertising or tracking cookies.</p>
      </section>
      <section>
        <h2>Deleting your data</h2>
        <p>
          There&apos;s no self-service account deletion yet. To have an account removed, get in touch through the{" "}
          <Link href="/contact">Contact</Link>{" "}
          page. Use made-up details if you&apos;d rather not share real ones;
          nothing here needs them.
        </p>
      </section>
    </InfoPage>
  );
}
