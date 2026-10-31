import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { GITHUB_URL, LINKEDIN_URL, REPO_URL } from "@/lib/site-links";

export const metadata: Metadata = { title: "Contact | PlayBook" };

export default function ContactPage() {
  return (
    <InfoPage title="Contact" summary="PlayBook is a portfolio project designed and built by Jaime Aramburo.">
      <section>
        <h2>Get in touch</h2>
        <p>
          For questions about the project, feedback or work, message me on{" "}
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          .
        </p>
      </section>
      <section>
        <h2>The code</h2>
        <p>
          This app&apos;s source code is{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            on GitHub
          </a>
          , along with{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            more of my work
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Venues and bookings</h2>
        <p>The venues are sample data, so there&apos;s no venue to contact and no booking to change.</p>
      </section>
    </InfoPage>
  );
}
