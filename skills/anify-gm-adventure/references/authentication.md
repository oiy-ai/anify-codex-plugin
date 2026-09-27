# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- MCP endpoint: `https://anify.ai/mcp`
- Local Engine MCP endpoint for development: configured by the host runtime
- OAuth authorization endpoint: `/authorize`
- OAuth token endpoint: `/token`
- OAuth dynamic registration endpoint: `/register`
- Public bearer token type: opaque Anify OAuth access token
- Upstream Engine bearer token type: Firebase ID token managed by the Anify OAuth provider

The public Codex client uses normal remote MCP OAuth discovery. Codex stores the opaque Anify access and refresh tokens, while the Anify OAuth provider keeps the Firebase session encrypted in its grant state and refreshes it server-side. The Codex shell runtime continues to receive the caller's Firebase bearer token on `/v1/runs` and passes it through shell-owned runtime config, not through the public plugin `.mcp.json`.

Follow the [Turn Operation Protocol](../SKILL.md#turn-operation-protocol): active actions enter through the combined `roll_check`; `anify_begin_operation` returns save and pending state together only for setup, explicit recovery or deterministic mutations. `anify_pending_turn_get` is for explicit recovery inspection. Reuse the retained `operation_id` and canonical projection; this reference does not repeat entry or state lookups.

For start, resume, initialization, and pending recovery, follow [Session Setup And Player Actions](../SKILL.md#session-setup-and-player-actions). If authorization is missing or expired, surface the failure and let the host reconnect Anify; do not repeatedly retry without an auth-state change.

All adventure tools must enforce auth in MCP code. Prompt instructions are not enough.

## OAuth Discovery

The Anify MCP server follows the remote HTTP MCP OAuth pattern:

1. Unauthenticated `/mcp` requests return `401` with `WWW-Authenticate: Bearer ... resource_metadata="https://anify.ai/.well-known/oauth-protected-resource/mcp"`.
2. The protected resource metadata points Codex to `https://anify.ai` as the authorization server.
3. The authorization server metadata exposes `/authorize`, `/token`, and `/register`.
4. Codex host opens `/authorize` in browser-capable client mode.
5. The Anify web app verifies the current Firebase login, binds it to the PKCE authorization request, and returns a one-time authorization code to Codex.
6. `/token` exchanges the code for an opaque 55-minute access token and a rotating 30-day refresh token.
7. Codex uses the refresh grant to renew its access token without browser interaction. The provider simultaneously rotates the stored Firebase session and returns a new Anify refresh token.
8. `/mcp` validates the opaque Anify bearer, then forwards the current Firebase ID token to Engine through a Worker service binding.

Do not ask the user to paste Firebase email/password into Codex.

## Save Authority

Engine MCP is the save authority. Codex must use `anify_save_initialize`, `anify_save_get`, `anify_apply_gm_resolution`, and `anify_game_action`; after the combined `roll_check` creates or recovers an active turn, subsequent mutation arguments must include its returned `operation_id`; setup and deterministic operations obtain their ID from `anify_begin_operation`. Codex must not create or maintain a local Anify user workspace or submit arbitrary gameplay patches.
