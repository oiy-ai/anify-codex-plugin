# D20 MCP Contract

Anify requires D20 checks to be resolved outside the GM model. The MCP server is `anify`, with the D20 tool `roll_check`.

`roll_check` requires a valid Anify Firebase session. It must fail before rolling if the MCP request is not authenticated.

Every mutating MCP request also requires the host-injected `x-anify-operation-id` header. `.mcp.json` maps `ANIFY_OPERATION_ID` to this header; it is transport metadata, never a tool argument. One run uses the same value for `roll_check`, `anify_resolve_action`, and `anify_apply_gm_resolution`.

Do not call `roll_check` until the adventure has been started and `anify_save_get` returns an active `save.adventure` plus canonical `save.game` state.

The one-time opening is not a check: when `save.adventure.opening_pending` is true, commit an opening `AdventureResolution` at the current revision through `anify_apply_gm_resolution`, without calling `roll_check` or `anify_resolve_action`. Normal D20 rules begin with the first player action after that committed opening.

## Tool

`roll_check`

Input:

```json
{
  "dc": 15,
  "modifier": 2,
  "advantage": "normal",
  "actor": "Mira",
  "action": "Sneak past the sentry",
  "ability": "DEX(Stealth)",
  "stakes": "On success Mira crosses unseen; on failure the sentry hears movement.",
  "secret": false
}
```

Fields:

- `dc`: integer from 1 to 40. GM chooses from rules and fiction.
- `modifier`: integer from -20 to 20. Include all character, item, and situational modifiers.
- `advantage`: `normal`, `advantage`, or `disadvantage`.
- `actor`: acting character, party, NPC, or force.
- `action`: attempted action.
- `ability`: ability or skill label.
- `stakes`: concise success/failure meaning.
- `secret`: whether raw roll details should be hidden from player-facing narration.

Output:

```json
{
  "operation_id": "host run id",
  "check_id": "uuid",
  "timestamp": "UTC timestamp",
  "uid": "authenticated Firebase uid",
  "adventure_session_id": "active adventure session id",
  "revision": 4,
  "actor": "Mira",
  "action": "Sneak past the sentry",
  "ability": "DEX(Stealth)",
  "stakes": "On success Mira crosses unseen; on failure the sentry hears movement.",
  "secret": false,
  "dc": 15,
  "modifier": 2,
  "advantage": "normal",
  "rolls": [13],
  "kept_roll": 13,
  "total": 15,
  "margin": 0,
  "outcome": "success"
}
```

`outcome` values:

- `critical_success`: natural 20.
- `success`: total is at least DC.
- `failure`: total is below DC.
- `critical_failure`: natural 1.

## GM Usage Rules

- Call `anify_start_adventure` with `session_intent: "new"` for a fresh adventure, or once with `session_intent: "resume"` before continuing the active adventure. Never reuse new-session fields while resuming.
- The GM decides DC and modifier before calling the tool.
- The GM must not alter `rolls`, `kept_roll`, `total`, `margin`, or `outcome`.
- The GM must not alter `operation_id`, `uid`, `adventure_session_id`, `revision`, or any other provenance field.
- Pass the exact full `CheckResult` to `anify_resolve_action`; it rejects every missing, changed, or fabricated field.
- Preserve the exact `resolution_packet` returned by `anify_resolve_action` and pass it to `anify_apply_gm_resolution`.
- Do not resubmit `turn_entry` on a normal D20 turn; Engine commits the turn entry bound to that packet.
- Apply Engine's returned resolution through `anify_apply_gm_resolution`; the same atomic commit persists the full check result, narrative, memories, and any battle creation.
- If `secret` is true, summarize the fictional consequence without revealing the raw roll unless the user asks to inspect state.
- Every player action that affects uncertain fiction must pass through this tool.

After `roll_check`, call `anify_resolve_action` so Engine can return rule advice, an immutable `resolution_packet`, and a canonical resolution for the current revision. Add only the player-facing narrative and next choices, then commit it with `anify_apply_gm_resolution` plus the exact packet.

Engine stores stage receipts in the authenticated user's SQLite Durable Object. If the host retries an interrupted run with the same operation header and identical stage input, Engine returns the original check, packet, or committed apply result without rerolling or advancing revision again. Reusing that operation ID with changed stage input fails closed.
