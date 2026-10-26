// Placeholder copy - a real Terms and Conditions page is out of scope for
// this MVP. This exists so the checkout flow's mandatory agreement
// checkbox links to a real page rather than a dead "#" href.
export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold">Terms and Conditions</h1>
      <p className="text-muted-foreground">
        This is a placeholder page for a portfolio project. A real Terms and Conditions document would go here
        before launch.
      </p>
    </div>
  );
}
