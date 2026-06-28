# Two-Factor Authentication

## Goal

Add secure, user opt-in TOTP two-factor authentication with one-time recovery codes.

## Decisions

- Use authenticator-app TOTP for v1; email OTP and trusted devices are out of scope.
- Encrypt TOTP secrets with the existing `CryptoService`.
- Store only hashed recovery codes and show plain codes only at setup/regeneration time.
- Keep `users.is2faEnabled` read-only outside the dedicated 2FA flow.
- Use pending sessions: first-factor login creates the session, and protected routes require
  `sessions.twoFactorVerified = true` when 2FA is enabled.
- Allow `/auth/2fa/verify` and logout with a partial-session guard.
- Let admins reset target-user 2FA through the existing users hierarchy; reset also revokes the
  target user's sessions.

## API Surface

- `GET /auth/2fa/status`
- `POST /auth/2fa/setup/start`
- `POST /auth/2fa/setup/confirm`
- `POST /auth/2fa/verify`
- `POST /auth/2fa/disable`
- `POST /auth/2fa/recovery-codes/regenerate`
- `POST /users/:id/2fa/reset`

## Dashboard Surface

- `/2fa/verify` handles pending-session verification and preserves safe redirects.
- Profile shows setup, disable, and recovery-code regeneration controls.
- Users table shows 2FA status and exposes admin reset for manageable users.
