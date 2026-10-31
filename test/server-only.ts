// Stands in for the `server-only` package under Vitest. The real package
// throws whenever it's imported outside Next's bundler (see "Other
// dev-tooling gotchas" in CLAUDE.md), which would make every server module
// untestable. The guarantee it gives still holds in the app itself.
export {};
