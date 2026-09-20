# Branching Strategy

## Goal

Keep active feature work off production, integrate safely in `develop`, and only move stable work into `main`.

## Branch Roles

### `main`

- Production-ready branch
- Only receives tested, approved releases
- No direct feature work
- Merge source should usually be `develop`

### `develop`

- Primary integration branch
- All new feature branches start from `develop`
- Completed features merge back into `develop` first
- Used for cross-feature testing before release

### `feature/<scope>-<short-name>`

Examples:

- `feature/invoices-advanced-filters`
- `feature/payments-bulk-actions`
- `feature/reports-export`

Rules:

- Branch from `develop`
- Keep the scope focused
- Merge back into `develop` with a pull request after checks pass

### `fix/<scope>-<short-name>`

Use for non-production bug fixes that should flow through `develop`.

Examples:

- `fix/settings-notification-toggle`
- `fix/customers-search-reset`

### `hotfix/<scope>-<short-name>`

Use only for urgent production issues.

Rules:

- Branch from `main`
- Merge into `main` as soon as the fix is verified
- Immediately merge the same fix back into `develop` so branches stay aligned

## Standard Workflow

### 1. Start new work

```bash
git switch develop
git pull origin develop
git switch -c feature/<scope>-<short-name>
```

### 2. Build and verify locally

Run the checks that fit the change before opening a pull request:

```bash
npm run lint
npm run test
npm run build
```

### 3. Merge feature into `develop`

- Open a pull request from `feature/*` into `develop`
- Require review before merge when possible
- Prefer squash merge for feature branches to keep history readable
- Delete the feature branch after merge

### 4. Release from `develop` into `main`

Only merge `develop` into `main` when:

- the feature is implemented
- the feature is working end-to-end
- regression checks pass
- the release is approved

Release flow:

```bash
git switch main
git pull origin main
git merge --no-ff develop
```

If your team uses pull requests for releases, open a PR from `develop` into `main` instead of merging locally.

## Merge Rules

- No direct commits to `main`
- Avoid direct commits to `develop` unless it is release housekeeping
- One feature branch per task or ticket
- Rebase or merge `develop` into long-running feature branches regularly
- Keep pull requests small enough to review safely

## Branch Protection Recommendations

Apply these on GitHub when convenient:

- Protect `main`
- Protect `develop`
- Require pull requests before merge
- Require at least one review
- Require status checks for `lint`, `test`, and `build`
- Restrict force pushes to protected branches

## Current Repo Decision

As of May 21, 2026:

- `develop` is the intended integration branch for current and upcoming work
- `main` is the source of truth for the latest stable code in this repo
- the older `dev` branch can remain as legacy history, but new work should target `develop`

Recommended follow-up:

1. Push `develop` to origin
2. Point future feature branches at `develop`
3. Retire or freeze the old `dev` branch after the team confirms the switch

## Quick Reference

### New feature

```bash
git switch develop
git pull origin develop
git switch -c feature/<scope>-<short-name>
```

### Merge completed feature

```bash
git switch develop
git pull origin develop
git merge --no-ff feature/<scope>-<short-name>
```

### Prepare production release

```bash
git switch main
git pull origin main
git merge --no-ff develop
```

### Production hotfix

```bash
git switch main
git pull origin main
git switch -c hotfix/<scope>-<short-name>
```
