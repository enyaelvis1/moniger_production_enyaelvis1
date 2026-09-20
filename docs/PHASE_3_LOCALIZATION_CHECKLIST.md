# Phase 3 Localization Checklist - moniger.net

Last reviewed: 2026-04-14
Source of truth: current repo state against the Phase 3 goals in `tracking/REMAINING_IMPLEMENTATION_PHASES.md`

## How to read this

| Status | Meaning |
| --- | --- |
| Done | Implemented in the current repo |
| Partial | Started, but still has meaningful follow-up work |
| Remaining | Not implemented yet |

## Phase 3 Status Table

| Feature area | Status | Scope | Notes |
| --- | --- | --- | --- |
| Localization infrastructure | Done | Shared provider, browser fallback, and translation lookup | The app now resolves effective language and locale from browser defaults plus persisted profile and workspace settings |
| Translation files | Done | `en` and `fr` resources | Initial translation coverage now includes the authenticated shell, dashboard summary, search surfaces, settings tabs, and locale controls |
| Language switcher | Done | Profile and workspace settings | Users can now choose personal language/locale overrides or inherit workspace defaults, and workspace owners can define business defaults |
| Locale-aware formatting | Done | Shared currency, number, date, and datetime helpers | Dashboard, reports, payments, invite acceptance, and accessibility labels now use shared formatting utilities |
| Locale preference persistence | Done | `profiles` and `businesses` | Language and locale preferences are now persisted in Supabase and drive the runtime localization layer |
| Auth and onboarding localization | Done | Login, register, invite acceptance, and MFA sign-in copy | Core authentication and invitation journeys now use translation keys instead of hard-coded English copy |
| Notification center localization | Done | Trigger labels, filters, empty states, and relative timestamps | Notification center UI now follows the selected language and locale, including relative time labels |
| Backend-generated localization | Done | Invite emails, digest emails, invoice email summaries, and export footer metadata | Edge Functions now honor persisted business/profile language and locale for email subjects, body copy, and date/currency formatting |
| Broader string extraction | Partial | Remaining entity pages and marketing surfaces | The app shell, auth, notifications, and backend delivery content are localized, but entity pages and public marketing copy still need to move onto translation keys |

## Suggested next localization work

| Priority | Item | Why it is next |
| --- | --- | --- |
| 1 | Expand translation coverage across remaining entity pages | Core infrastructure, auth flows, and delivery content are now localized, so the next value is removing hard-coded copy from invoices, bills, customers, vendors, payments, and reports |
| 2 | Localize public marketing and contact surfaces | The public-facing landing pages still rely on hard-coded English copy and should join the shared translation layer |
| 3 | Add multi-locale QA coverage | Once more surfaces are translated, we should verify layout resilience, truncation, and copy quality across supported locales |
