# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- MCP endpoint: `https://anify.ai/mcp`
- Local Engine MCP endpoint for development: configured by the host runtime
- OAuth authorization endpoint: `/authorize`
- OAuth token endpoint: `/token`
- OAuth dynamic registration endpoint: `/register`
- Bearer token type: Firebase ID token

The public Codex client uses normal remote MCP OAuth discovery. The Codex shell runtime receives the caller's Firebase bearer token on `/v1/thread/run` and passes it through shell-owned runtime config, not through the public plugin `.mcp.json`.

## Required Flow

Before starting or continuing an adventure:

1. Call `anify_save_get`.
2. If the remote GM save is not initialized, call `anify_save_initialize` with a compact default player profile inferred from the request, then call `anify_save_get` again.
3. If the remote save has no active `adventure_session_id`, call `anify_start_adventure` and continue only if it returns `readyForGameplay: true`.
4. If the remote save already has an active `adventure_session_id`, do not call `anify_start_adventure`; continue with `anify_get_context`, `roll_check`, and `anify_resolve_action` as needed.
5. If an Engine MCP call fails because authorization is missing or expired, surface the failure directly and let the Codex host reconnect Anify.

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

## Save Authority

Engine MCP is the save authority. Codex must use `anify_save_initialize`, `anify_save_get`, and `anify_save_update`; it must not create or maintain a local Anify user workspace.
