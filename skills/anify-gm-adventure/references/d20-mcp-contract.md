# D20 MCP Contract

Anify requires D20 checks to be resolved outside the GM model. The MCP server is `anify`, with the D20 tool `roll_check`.

`roll_check` requires a valid Anify Firebase session. It must fail before rolling if the MCP request is not authenticated.

Follow the [Turn Operation Protocol](../SKILL.md#turn-operation-protocol) once per logical GM turn: `anify_begin_operation`, `anify_pending_turn_get`, and the retained `operation_id` are owned by that common entry flow. If it already ran, reuse its result; this reference does not start a second operation.

Do not call `roll_check` until the adventure has been started and `anify_save_get` returns an active `save.game.adventure`.

The one-time opening is not a check: when `save.game.adventure.phase` is `opening`, commit a minimal opening `AdventureResolution` containing only `type`, `narrative`, and `choices` through `anify_apply_gm_resolution`. Engine binds the revision and turn entry; do not call `roll_check` or `anify_resolve_action`. Normal D20 rules begin with the first player action after that committed opening advances the phase to `active`.

## Tool

`roll_check`

Input:

```json
{
  "operation_id": "operation returned by anify_begin_operation",
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
- `operation_id`: required ID returned by `anify_begin_operation` for this logical turn.
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
  "operation_id": "effective operation id",
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

- Call `anify_start_adventure` with `session_intent: "new"` and the exact Engine-owned adventure `currentAreaId`, or once with only `session_intent: "resume"` before continuing the active adventure. Never reuse new-session fields while resuming.
- The GM decides DC and modifier before calling the tool.
- The GM must not alter `rolls`, `kept_roll`, `total`, `margin`, or `outcome`.
- The GM must not alter `operation_id`, `uid`, `adventure_session_id`, `revision`, or any other provenance field.
- Pass only the turn's `operation_id` to `anify_resolve_action`; Engine reads the exact action and `CheckResult` it stored during `roll_check`.
- Submit only the GM-authored presentation resolution through `anify_apply_gm_resolution`; Engine binds its stored pending state and the same atomic commit persists the full check result, narrative, memories, rule effects, and any battle creation.
- If `secret` is true, summarize the fictional consequence without revealing the raw roll unless the user asks to inspect state.
- Every player action that affects uncertain fiction must pass through this tool.

After `roll_check`, call `anify_resolve_action` with only the same top-level `operation_id`. Engine consumes the canonical pending check, returns rule advice, and keeps the canonical pending resolution server-side. Build a presentation-only resolution with the permitted player-facing narrative, next choices, and justified persisted effects allowed by the main skill, then commit it with `anify_apply_gm_resolution` and that same operation ID.

After the commit succeeds, emit every non-secret check through the exact `SYSTEM_MESSAGE` check-card marker defined in the main Skill's Player-Facing Output contract, including when the plugin runs directly in Codex. Never print a separate Markdown check summary, and never expose raw values for a secret check.

Engine stores stage receipts and unfinished turn provenance in the authenticated user's SQLite Durable Object. Matching retries return the original check or committed apply result without rerolling or advancing revision again. A later logical turn must discover unfinished work through `anify_pending_turn_get` and continue the exact pending stage; reusing an operation ID with changed stage input fails closed.
