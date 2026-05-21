---
type: tracker
status: open
priority: P2
discovered_during: Ray Kassam auth audit (urban-vibe), 2026-05-21
related:
  - "[[Tracker/D-onboarding-bugs-2026-05-21]]"
tags: [auth, google-oauth, onboarding, dashboard-login]
updated: 2026-05-21
---

# D-google-oauth-login-2026-05-21

Add Google OAuth as a login option for client dashboard. Surfaced during Ray's auth audit — he uses two Gmail addresses (`raykassam@gmail.com` personal, `urbanvibe.ca@gmail.com` business) and at any given moment is signed into one or the other in his browser. Magic links via email work, but require switching tabs and clicking. "Sign in with Google" is the friction-free path most operators expect in 2026.

## Current state

- Supabase Auth instance: `qwhvblomlgeapzhnuwlb`
- Sign-in methods enabled: email/password + magic link (Resend SMTP)
- No OAuth providers configured

## Scope

1. **Supabase dashboard config** — enable Google OAuth provider, set redirect URI to `https://endvoicemail.ai/auth/callback`. Provide a Google Cloud OAuth client_id + client_secret to the project. Manual config; not migration territory.

2. **`/login` page UI** — add "Continue with Google" button below the existing email field. Uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`.

3. **`/auth/callback` route** — already handles the auth state transition for magic links; need to confirm it also handles OAuth code-for-session exchange. Probably zero changes — Supabase Auth library handles both. Verify.

4. **`client_users` link discovery** — when a user signs in with Google for the first time, their `auth.users.email` is set by Google. The system needs to find their `client_users` row by email-match. If a client owner's `contact_email` doesn't match any of their Google addresses, they sign in successfully but land in an "unassociated" state. Two options:
   - (a) Surface an "associate this email with your account" admin flow
   - (b) Allow operators to pre-set their Gmail in the onboarding wizard so the link is ready when they OAuth-in for the first time
   - (b) is the lower-friction path — add a "Gmail address (for Google sign-in)" field in onboarding step 2.

5. **Multi-email support** — Ray's case proves operators commonly have multiple Gmail addresses. The schema already supports this (one `client_users` row per (user_id, client_id) pair). Need UI in dashboard settings: "Add another email" for operators to attach additional Google accounts to their workspace.

## Acceptance criteria

- Operator can click "Continue with Google" on `/login`, picks their Gmail, lands in their dashboard logged in
- If multiple Gmails are linked to their account, any of them works
- New owner during onboarding can specify Gmail address(es) at signup
- Existing owners can add a Gmail from their dashboard settings

## Not in scope (deferred)

- SAML / SSO for enterprise customers
- Microsoft / Apple ID OAuth — Google is most common for the SMB segment
- Auto-creating `client_users` rows for unknown Google emails (security risk — must be admin-approved or pre-set during onboarding)

## Risks

- Operator confusion if they sign in with Google but their dashboard contact_email is their `@hotmail.com` — they'll see their workspace but system emails go elsewhere. Mitigation: surface this mismatch in dashboard settings with a "fix this" prompt.
- The `magic link` flow + Google OAuth + email/password all coexist — Supabase Auth handles this natively, no logic on our side.
