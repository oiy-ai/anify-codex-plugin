# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- MCP endpoint: `https://anify.ai/mcp`
- Local Engine MCP endpoint for development: `http://127.0.0.1:8787/mcp`
- OAuth authorization endpoint: `/authorize`
- OAuth token endpoint: `/token`
- OAuth dynamic registration endpoint: `/register`
- Bearer token type: Firebase ID token

The Codex client can use normal remote MCP OAuth discovery. The Codex shell development runtime uses a preconfigured OAuth cache and does not open a browser login during `/v1/thread/run`.

## Required Flow

Before starting or continuing an adventure:

1. Read local Markdown state from `CODEX_HOME/anify/users/userA`.
2. Call `anify_auth_status`.
3. If the MCP server is not authenticated, stop and let the Codex host reconnect the Anify MCP server.
4. Call `anify_start_adventure`.
5. Continue the GM loop only if `anify_start_adventure` returns `readyForGameplay: true`.

All adventure tools must enforce auth in MCP code. Prompt instructions are not enough.

## OAuth Discovery

The Anify MCP server follows the remote HTTP MCP OAuth pattern:

1. Unauthenticated `/mcp` requests return `401` with `WWW-Authenticate: Bearer ... resource_metadata="https://anify.ai/.well-known/oauth-protected-resource/mcp"`.
2. The protected resource metadata points Codex to `https://anify.ai` as the authorization server.
3. The authorization server metadata exposes `/authorize`, `/token`, and `/register`.
4. Codex host opens `/authorize` in browser-capable client mode.
5. The Anify web app uses the current Firebase login and returns an authorization code to Codex.
6. `/token` validates that Firebase token and returns it as the OAuth bearer access token.
7. `/mcp` validates every bearer token against Firebase before exposing tools.

Do not ask the user to paste Firebase email/password into Codex.

## Local Save Authority

Authentication gates Engine tools only. It does not make Engine the save authority in this development architecture.

Codex must read and write the local Markdown files in:

```text
CODEX_HOME/anify/users/userA
```

Engine MCP returns context, checks, and rule deltas. Codex applies them to local Markdown.
