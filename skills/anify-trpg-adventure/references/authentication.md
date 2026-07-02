# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- MCP endpoint: `https://anify.ai/mcp`
- Local MCP test endpoint: `https://localhost:5173/mcp`
- OAuth authorization endpoint: `/authorize`
- OAuth token endpoint: `/token`
- OAuth dynamic registration endpoint: `/register`
- Bearer token type: Firebase ID token

There is exactly one plugin authentication path: Codex connects to the remote Anify HTTP MCP server and the Codex host completes OAuth discovery. Do not add PATs, CLI login, mock users, local callback servers, local session files, or offline play.

## Required Flow

Before starting or continuing an adventure:

1. Call `anify_auth_status`.
2. If the MCP server is not authenticated, stop and let the Codex host reconnect the Anify MCP server. The host should open the Anify web login page through the standard OAuth authorization flow.
3. Call `anify_start_adventure`.
4. Continue the GM loop only if `anify_start_adventure` returns `readyForGameplay: true`.

All adventure tools must enforce auth in MCP code. Prompt instructions are not enough.

## OAuth Discovery

The Anify MCP server follows the same remote HTTP MCP OAuth pattern as Cloudflare:

1. Unauthenticated `/mcp` requests return `401` with `WWW-Authenticate: Bearer ... resource_metadata="https://anify.ai/.well-known/oauth-protected-resource/mcp"`.
2. The protected resource metadata points Codex to `https://anify.ai` as the authorization server.
3. The authorization server metadata exposes `/authorize`, `/token`, and `/register`.
4. Codex host opens `/authorize` in the browser.
5. The Anify web app uses the current Firebase login and returns an authorization code to Codex.
6. `/token` validates that Firebase token and returns it as the OAuth bearer access token.
7. `/mcp` validates every bearer token against Firebase before exposing tools.

Do not ask the user to paste Firebase email/password into Codex. The web app owns login and token issuance.

## Adventure Gate

`anify_start_adventure` is the code-level gate for starting play. The GM must not narrate the first scene until this tool returns `readyForGameplay: true`.

When server-side cloud state MCP tools are not connected yet, `anify_start_adventure` must return `readyForGameplay: false`; the assistant must stop instead of loading local `.anify` saves or creating a local campaign.

Future server-backed MCP tools for saves, world loading, stats, inventory, combat, and similar systems must validate the same Firebase OAuth bearer before doing work.
