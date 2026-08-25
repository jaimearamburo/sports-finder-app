import { prisma } from "@/lib/prisma";

// Forces this page to run the query fresh on every visit, instead of
// caching a snapshot from build time — important for an actual live test.
export const dynamic = "force-dynamic";

export default async function TestConnectionPage() {
  let venueCount: number | null = null;
  let error: string | null = null;

  try {
    venueCount = await prisma.venue.count();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: "monospace" }}>
        <h1>❌ Database connection failed</h1>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, fontFamily: "monospace" }}>
      <h1>✅ Database connected successfully</h1>
      <p>Found {venueCount} venue(s) in the database.</p>
    </div>
  );
}