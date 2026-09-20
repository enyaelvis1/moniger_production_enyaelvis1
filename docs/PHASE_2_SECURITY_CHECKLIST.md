# Phase 2 Security Checklist - moniger.net

Last reviewed: 2026-04-13
Source of truth: current repo state against the Phase 2 goals in `tracking/REMAINING_IMPLEMENTATION_PHASES.md`

## How to read this

| Status | Meaning |
| --- | --- |
| Done | Implemented in the current repo |
| Partial | Started, but still has meaningful follow-up work |
| Remaining | Not implemented yet |

## Phase 2 Status Table

| Feature area | Status | Scope | Notes |
| --- | --- | --- | --- |
| Security tab in settings | Done | Dedicated `Security` tab under `/settings?tab=security` | Security controls are no longer buried inside the profile form |
| Current session visibility | Done | Signed-in email, provider, start time, last sign-in, session expiry | Gives the user a clear view of the active session on the current device |
| Sign out current session | Done | Current device/session | Available directly from the new security tab |
| Sign out other sessions | Done | Other active sessions for the same account | Uses Supabase scoped sign-out while keeping the current device active |
| Sign out everywhere | Done | Global account sign-out | Signs out the current session and every other active session |
| Account/device inventory | Done | Current session details, known session inventory, auth methods, and security activity | The Security tab now keeps a backend-backed inventory of recent known sessions/devices, including current-session state, sign-out status, recovery-code usage, and authentication methods |
| Password management | Done | Change password and stronger credential management | Users can update their password from the Security tab, with inline validation and optional verification-code support |
| Multi-factor authentication | Done | MFA / 2FA enrollment and verification | TOTP authenticator enrollment, sign-in challenge handling, factor verification, and factor removal now ship from the Security tab and login flow |
| MFA recovery options | Done | Backup recovery codes and temporary session bypass | Users can now generate one-time backup recovery codes, store them securely, and use them at login to regain access to the current session when an authenticator device is unavailable |
| Privacy and export controls | Done | Account/workspace privacy settings and export actions | Persisted privacy preferences and JSON account/workspace exports now ship from the Security tab |
| Invite and digest delivery infrastructure | Done | Backend invite email, invitation acceptance flow, invoice delivery, and digest delivery | Team invites now support both existing accounts and non-members through secure invitation links, while backend invoice delivery, digest previews, and scheduled weekly digests remain active |

## Suggested next security work

| Priority | Item | Why it is next |
| --- | --- | --- |
| 1 | Security analytics polish | Session inventory and recent activity now exist, and later follow-up can add anomaly detection or stronger admin reporting |
| 2 | Additional MFA recovery hardening | Backup codes now exist, and follow-up work can add rotation reminders or recovery analytics later |
| 3 | Broader auth-provider capabilities | Native provider-backed device/session telemetry would still be a useful future enhancement if Supabase exposes more detail later |
