# Phase 4 Performance Checklist - moniger.net

Last reviewed: 2026-04-14
Source of truth: current repo state against the Phase 4 goals in `tracking/REMAINING_IMPLEMENTATION_PHASES.md`

## How to read this

| Status | Meaning |
| --- | --- |
| Done | Implemented in the current repo |
| Partial | Started, but still has meaningful follow-up work |
| Remaining | Not implemented yet |

## Phase 4 Status Table

| Feature area | Status | Scope | Notes |
| --- | --- | --- | --- |
| Route lazy loading | Done | Public and authenticated page routes | Page-level routes now load through `React.lazy()` instead of shipping every screen in the initial route bundle |
| Shared Suspense fallback | Done | Route-level loading state | A shared route loading screen now covers lazy route transitions consistently |
| Chunk splitting strategy | Done | Route bundle boundaries plus shared vendor chunk groups | The build now separates route code from shared React, Supabase, query, Radix UI, charting, form, motion, icon, and date utility bundles |
| Public shell split | Done | Public routes versus authenticated platform shell | The public landing and marketing routes now load through a lightweight outer router, while the authenticated workspace app lives behind a separate lazy `PlatformApp` shell so the landing entry no longer imports the full protected app runtime up front |
| Bundle-size reduction | Done | Initial app payload | Vendor chunking is now complemented by a residual review pass: the calendar code is split out from charting, shared style helpers now live in their own `style-vendor` chunk instead of dragging charting into the landing route, the landing page defers below-the-fold marketing sections into separate route-adjacent chunks, and the public shell split keeps authenticated workspace providers and routes behind a later lazy boundary |
| Asset optimization | Done | Marketing and UI image loading strategy | Current shipped images now declare explicit loading priority, async decoding, and sizing intent for critical versus non-critical surfaces, below-the-fold landing sections no longer hydrate on the first screen paint, and the public route now uses a lightweight local SVG mark instead of the older large PNG wordmark asset in the critical path |
| Query/cache tuning | Done | Shared React Query defaults plus targeted profiles for finance, directory, dashboard, notifications, team, security, and search | The app now uses a tuned `QueryClient` baseline in `src/App.tsx` and shared query profiles from `src/lib/query.ts` instead of treating most reads as immediately stale |
| Lighthouse workflow | Done | Repeatable production-build measurement and thresholds | The repo now has `npm run perf:lighthouse`, `npm run perf:bundles`, and a documented workflow in `LIGHTHOUSE_WORKFLOW.md` that writes reports under `reports/performance`, and the performance threshold now passes on the current production build |

## Phase 4 Outcome

Phase 4 is considered complete.

The current production-build workflow now satisfies the agreed threshold for the public route:

- Performance: `82`
- Accessibility: `93`
- Best Practices: `96`

The build also completes without the old large chunk warning output, and the public landing route no longer pulls charting code just to resolve shared class utilities.

## Suggested follow-up performance work

| Priority | Item | Why it is a follow-up and not a blocker |
| --- | --- | --- |
| 1 | Revisit the charting footprint for authenticated reporting routes | `charts-vendor` remains the largest vendor group, but it is no longer on the public landing path and does not block Phase 4 closure |
| 2 | Expand the performance workflow to authenticated routes later | The current workflow targets public routes first; authenticated-route performance can be layered on after launch-critical work |
| 3 | Continue reducing motion-heavy code on non-critical marketing and legal routes over time | This will improve secondary-route performance further, but the public entry target is already met |

## Local Lighthouse baselines

- Initial baseline:
  - Date: `2026-04-14`
  - Target route: `/`
  - Performance: `47`
  - Accessibility: `95`
  - Best Practices: `96`

- After deferred landing sections:
  - Date: `2026-04-14`
  - Target route: `/`
  - Performance: `68`
  - Accessibility: `95`
  - Best Practices: `96`

- After first-screen runtime reduction:
  - Date: `2026-04-14`
  - Target route: `/`
  - Performance: `51` to `54` across repeat local runs
  - Accessibility: `95`
  - Best Practices: `96`
  - Notable changes: removed the external Google font dependency from the first paint, switched the critical nav mark to a lightweight SVG, removed `framer-motion` from the above-the-fold landing path, and disabled HTML module preloads for large protected-app vendor bundles

- After public shell split:
  - Date: `2026-04-14`
  - Target route: `/`
  - Performance: `68`
  - Accessibility: `93`
  - Best Practices: `96`
  - Notable changes: split the public landing and marketing routes away from the authenticated workspace shell, moved protected providers and routes behind a lazy `PlatformApp` boundary, removed public-route module preloads, and kept the public entry HTML to a much lighter bootstrap path

- After performance close-out:
  - Date: `2026-04-14`
  - Target route: `/`
  - Performance: `82`
  - Accessibility: `93`
  - Best Practices: `96`
  - Notable changes: moved shared class and style helpers into a dedicated `style-vendor` chunk so the landing route no longer loads charting code indirectly, and removed the eager `framer-motion` dependency from the footer so the public route avoids the motion vendor on first load

This means the workflow is now operational, the public route is materially lighter than the original baseline, and the Phase 4 target is now met.
