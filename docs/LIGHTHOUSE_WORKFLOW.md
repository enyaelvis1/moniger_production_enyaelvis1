# Lighthouse Workflow

Last reviewed: 2026-04-14

## Purpose

This workflow gives the repo a repeatable performance check for the public landing page after Phase 4 optimization work.

It generates:

- a JSON Lighthouse report
- an HTML Lighthouse report
- a small JSON summary with pass/fail thresholds
- a build chunk summary for the latest production bundle

## Commands

```bash
npm run build
npm run perf:bundles
npm run perf:lighthouse
```

Or run the full sequence:

```bash
npm run perf:check
```

## Outputs

The workflow writes reports to:

- `reports/performance/bundle-summary.json`
- `reports/performance/lighthouse/latest.report.html`
- `reports/performance/lighthouse/latest.report.json`
- `reports/performance/lighthouse/summary.json`

## Default target

The Lighthouse script targets the public landing page at `/`.

You can point it to a different route with:

```bash
LIGHTHOUSE_TARGET_PATH=/about npm run perf:lighthouse
```

## Current thresholds

The Lighthouse script currently enforces:

- Performance: `>= 75`
- Accessibility: `>= 85`
- Best Practices: `>= 90`

If any threshold is missed, the command exits with a failing status code.

## Notes

- The workflow uses `vite preview` against the production build.
- The current script is intended for public, non-authenticated routes.
- Authenticated route measurement can still be done manually in Chrome DevTools or later through a Playwright-authenticated performance flow.
