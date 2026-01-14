# ADR-0003: JWT-based Authentication

## Status

Accepted

## Date

2026-01-14

## Context

QueueWizard needs to authenticate users and protect job-related endpoints. The authentication
mechanism must:

- Be stateless (no server-side session storage)
- Work well with REST APIs
- Support token expiration
- Be simple to implement and maintain

Options considered:

1. **Session-based auth** — Server stores session data
2. **JWT tokens** — Stateless, self-contained tokens
3. **OAuth 2.0 / OpenID Connect** — Delegated authentication
4. **API keys** — Simple key-based authentication

## Decision

Use JWT (JSON Web Tokens) for authentication with the following configuration:

- **Algorithm:** HS256 (symmetric signing with JWT_SECRET)
- **Expiry:** 24 hours
- **Payload:** `{ userId: string }`
- **Transport:** Bearer token in Authorization header

## Consequences

**Positive:**

- Stateless — no server-side session storage required
- Scalable — any server instance can validate tokens
- Self-contained — token carries user identity
- Standard format — wide library support

**Negative:**

- Cannot invalidate tokens before expiry (without blacklist)
- Token size larger than session ID
- Secret rotation requires coordinated deployment
- 24-hour expiry means users must re-authenticate daily

**Security considerations:**

- `JWT_SECRET` must be cryptographically strong (32+ random bytes)
- Use HTTPS in production to prevent token interception
- Store tokens securely on client (HttpOnly cookies preferred for web)
- Consider refresh token pattern for longer sessions

**Implementation:**

```typescript
// Token generation (signin)
const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
  expiresIn: "24h",
});

// Token verification (middleware)
const payload = jwt.verify(token, config.jwtSecret);
req.userId = payload.userId;
```
