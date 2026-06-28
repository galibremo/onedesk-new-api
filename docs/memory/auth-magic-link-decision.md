# Decision Record: Magic-Link Authentication

## Decision

Replace the public email/password auth flow with magic-link sign-in and keep Google login plus the
existing JWT/session cookie implementation.

## Reasoning

- Passwordless authentication removes password storage and reset complexity for the public login
  path.
- The existing `verifications` table already fits one-time token storage.
- The existing session/JWT flow can be reused after verification succeeds.
- Redirecting back to the frontend after verification gives the browser-based flow a clean end
  state.

## Alternatives Considered

- Keep password login and add magic links side by side.
  - Rejected because the request was to remove the traditional login/register flow.
- Introduce a new verification table.
  - Rejected because the existing table already supports identifier + token + expiry.
- Return the magic-link token to the client instead of redirecting.
  - Rejected because the browser flow should complete on the backend and return the user to the
    frontend with the cookie already set.

## Impact

- `POST /auth/login` and `POST /auth/register` are removed from the public API.
- `POST /auth/magic-link/request` and `GET /auth/magic-link/verify` become the new passwordless
  flow.
- Magic-link requests do not reveal whether an account exists.
- Verification tokens are hashed for lookup, expire after 15 minutes, and are consumed once.
- A successful magic-link verification can create a new user record automatically when the email is
  new.
