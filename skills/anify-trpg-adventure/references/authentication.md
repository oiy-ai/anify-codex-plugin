# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- Auth token type: Firebase ID token
- Transport convention: `Authorization: Bearer <idToken>`
- Login URL: `https://anify.ai`

There is exactly one plugin authentication path: a Firebase ID token from the Anify Firebase project. Do not add PATs, CLI login, mock users, local-only sessions, or offline play.

The Anify Codex shell verifies `Authorization: Bearer <idToken>` at the public API boundary, writes a request-scoped Anify session file, and points the MCP server at that file. If the token is missing or invalid, the shell must return a fixed login response with `loginUrl: "https://anify.ai"` before starting Codex. There is no separate environment-token, email/password, offline, or local identity path.

## Required Flow

Before starting or continuing an adventure:

1. Call `anify_auth_status`.
2. If it returns `authenticated: false`, stop and return the login URL from the tool response.
3. Call `anify_start_adventure`.
4. Continue the GM loop only if `anify_start_adventure` returns `readyForGameplay: true`.

All adventure tools must enforce auth in MCP code. Prompt instructions are not enough.

## Login Response

The shell and MCP status tool use this fixed login target:

```json
{
  "code": "ANIFY_LOGIN_REQUIRED",
  "action": "open_login_url",
  "loginUrl": "https://anify.ai"
}
```

Do not ask the user to paste Firebase email/password into Codex. The web app owns login and token issuance.

Default MCP session path:

```text
~/.anify/codex/auth-session.json
```

The session path may be overridden for tests with `ANIFY_AUTH_SESSION_PATH`.

## Status And Logout

`anify_auth_status` validates or refreshes the stored Firebase session and returns only public profile metadata.

`anify_auth_logout` deletes the local session file.

## Adventure Gate

`anify_start_adventure` is the code-level gate for starting play. The GM must not narrate the first scene until this tool returns `readyForGameplay: true`.

When server-side cloud state MCP tools are not connected yet, `anify_start_adventure` must return `readyForGameplay: false`; the assistant must stop instead of loading local `.anify` saves or creating a local campaign.

Future server-backed MCP tools for saves, world loading, stats, inventory, combat, and similar systems must call the same auth gate before doing work.
