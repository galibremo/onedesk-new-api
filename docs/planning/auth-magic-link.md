# Auth Magic Link Plan

## Problem Statement

Replace the public email/password auth flow with passwordless magic-link sign-in while preserving
the existing Google login and JWT/session cookie model.

## API Design

- `POST /auth/magic-link/request`
  - Accepts an email address and optional same-origin redirect URL.
  - Sends a one-time sign-in link by email, preserving the safe redirect in the verification URL.
  - Returns a generic success response to avoid account enumeration.
- `GET /auth/magic-link/verify`
  - Accepts `email` and `token` query parameters.
  - Verifies the one-time token, issues the session cookie, and redirects to the frontend success
    route.
- Existing Google login and logout remain unchanged.
- Traditional `login` and `register` routes are removed from the public controller surface.

## Data Model Impact

- Reuse the existing `verifications` table.
- Store `identifier=email` and a deterministic hash of the token in `value`.
- Delete existing verification rows for the same email before issuing a new magic link.
- Delete the verification row on successful use.

## Business Rules

- Magic-link verification auto-creates the user if the email does not already exist.
- If a user already exists, verification marks the email as verified if needed.
- The verification link expires after 15 minutes.
- The response to the request endpoint must not reveal whether the email exists.
- Successful verification ends in a frontend redirect, not a JSON token response.

## Edge Cases

- Expired tokens are rejected and removed.
- Replayed tokens are rejected after the first successful verification.
- Mail delivery failures should clean up the pending verification record.
- Redirect URLs must be validated against the frontend origin before being included in links or used
  after verification.
