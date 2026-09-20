# Admin Operations Runbook

Last reviewed: 2026-05-21

## Announcements

Use `Admin -> Announcements` for platform-wide communication that should appear consistently across the product.

Typical uses:

- Planned maintenance windows
- Billing or subscription notices
- Product launch or rollout messages
- Temporary service degradation warnings

Operational notes:

- Save drafts before publishing.
- Use scheduling when the notice should go live later.
- Match the target audience carefully (`all`, `starter`, `growth`, `business`).

## Support Lookup

Use `Admin -> Support Lookup` for fast internal investigation without signing into a subscriber workspace.

Typical uses:

- Find a user by email
- Find a workspace by business name
- Find an invoice by invoice number
- Find a payment by payment reference
- Send a controlled support notice to a workspace
- Trigger a password reset for a verified user

Operational notes:

- Keep support actions limited to legitimate troubleshooting.
- Sensitive quick actions should leave an audit trail.
- Prefer lookup and notice flows over ad hoc data changes.

## Danger Zone

Use `Admin -> Settings -> Danger Zone` only for high-impact platform actions.

Current uses:

- Export a platform snapshot for controlled backup or investigation
- Reserved non-production cleanup actions such as demo-data purge

Operational notes:

- Super-admin only
- Require explicit confirmation before execution
- Treat every action as audit-sensitive
