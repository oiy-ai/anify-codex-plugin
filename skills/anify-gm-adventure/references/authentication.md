# Anify Authentication

Anify Codex uses the same Firebase Auth project as the Anify web app:

- Firebase project: `anify-oiy-ai`
- MCP endpoint: `https://anify.ai/mcp`
- Local Engine MCP endpoint for development: configured by the host runtime
- OAuth authorization endpoint: `/authorize`
- OAuth token endpoint: `/token`
- OAuth dynamic registration endpoint: `/register`
- Bearer token type: Firebase ID token

The public Codex client uses normal remote MCP OAuth discovery. The Codex shell runtime receives the caller's Firebase bearer token on `/v1/runs` and passes it through shell-owned runtime config, not through the public plugin `.mcp.json`.

Every logical user or GM turn must first call the read-only `anify_begin_operation` and retain its returned `operation_id`. Every mutating tool call in that turn must include that same ID as the required top-level `operation_id` argument. Plugin MCP config also maps the Shell-owned `ANIFY_OPERATION_ID` environment variable to the trusted `x-anify-operation-id` header through `env_http_headers`; when present, the header takes precedence inside Engine, but the argument remains mandatory. Native Codex clients work without that environment variable because Engine issues the ID through `anify_begin_operation`. Never invent or rotate an ID between stages.

At the start of every GM turn, call the read-only `anify_pending_turn_get` immediately after `anify_begin_operation`. If it reports a pending check, continue with its exact `action` and full `check_result`; if it reports a pending resolution, use read-only canonical context as needed and commit its returned resolution with the exact `resolution_packet`. Never reroll, discard, or replace pending provenance. Only begin a new normal turn when no pending work exists.

## Required Flow

Before starting or continuing an adventure:

1. Call `anify_begin_operation`, retain its `operation_id`, call `anify_pending_turn_get`, and finish any returned pending check or resolution before starting a new normal turn.
2. Call `anify_save_get`.
3. If the remote GM save is not initialized, call `anify_save_initialize` with that `operation_id` and a compact default player profile inferred from the request, then call `anify_save_get` again.
4. Read canonical gameplay state from `save.game` and active-session metadata from `save.adventure`.
5. If `save.adventure` is null or the user explicitly requests a fresh adventure, call `anify_start_adventure` with the same `operation_id` and `session_intent: "new"`, and continue only if it returns a new active canonical session. A Shell new session must carry a new host-provided logical thread ID; omit `gm_thread_id` for native sessions rather than inventing one.
6. If `save.adventure` is active and the user continues it, call `anify_start_adventure` with the same `operation_id`, `session_intent: "resume"`, and no changed session fields. Continue only if Engine returns that same fixed session.
7. If an Engine MCP call fails because authorization is missing or expired, surface the failure directly and let the Codex host reconnect Anify.

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

Engine MCP is the save authority. Codex must use `anify_save_initialize`, `anify_save_get`, `anify_apply_gm_resolution`, and `anify_game_action`; every mutation argument must include the logical turn's `operation_id`. Codex must not create or maintain a local Anify user workspace or submit arbitrary gameplay patches.
