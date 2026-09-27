# D20 MCP Contract

Anify requires D20 checks to be resolved outside the GM model. The MCP server is `anify`, with the D20 tool `roll_check`.

`roll_check` requires a valid Anify Firebase session. It must fail before rolling if the MCP request is not authenticated.

Follow the [Turn Operation Protocol](../SKILL.md#turn-operation-protocol): active actions enter through the combined `roll_check`; `anify_begin_operation` returns save and pending state together only for setup, explicit recovery or deterministic mutations. `anify_pending_turn_get` is for explicit recovery inspection. Reuse the retained `operation_id` and canonical projection; this reference does not repeat entry or state lookups.

Do not call `roll_check` until the adventure has been started and a successful Engine response supplies an active `save.game.adventure`.

The one-time opening is not a check: when `save.game.adventure.phase` is `opening`, commit a minimal opening `AdventureResolution` containing only `type`, `narrative`, and `choices` through `anify_apply_gm_resolution`. Engine binds the revision and turn entry; do not call `roll_check`. Normal D20 rules begin with the first player action after that committed opening advances the phase to `active`.

## Tool

`roll_check`

Input:

```json
{
  "adventure_session_id": "sessionId from the last canonical save",
  "revision": 4,
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
- `adventure_session_id` and `revision`: required values from the last canonical save; Engine checks them before rolling.
- `operation_id`: omit for a new active turn; use the returned ID unchanged for retries and commit.
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
  "status": "resolved",
  "actionKind": "movement",
  "ruleAdvice": "Resolve the movement according to this result.",
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

- Call `anify_start_adventure` with `session_intent: "new"` and the exact Engine-owned adventure `currentAreaId`, or once with only `session_intent: "resume"` when reconnecting the active adventure during setup, never for each continuous turn. Never reuse new-session fields while resuming.
- The GM decides DC and modifier before calling the tool.
- The GM must not alter `rolls`, `kept_roll`, `total`, `margin`, or `outcome`.
- The GM must not alter `operation_id`, `uid`, `adventure_session_id`, `revision`, or any other provenance field.
- Engine uses the exact action and `CheckResult` in the same `roll_check` transaction to prepare its pending resolution. No separate resolver exists.
- Submit only the GM-authored presentation resolution through `anify_apply_gm_resolution`; Engine binds its stored pending state and the same atomic commit persists the full check result, narrative, memories, rule effects, and any battle creation.
- If `secret` is true, summarize the fictional consequence without revealing the raw roll unless the user asks to inspect state.
- Every player action that affects uncertain fiction must pass through this tool.

After `roll_check`, handle `status` before committing. `resolved` means its returned check and rule advice are durably prepared. `recovered` includes the original pending check, operation ID and canonical save: finish that original turn, then stop. `state_changed` includes the current canonical save but no check: update the cached projection and re-evaluate the action without inventing a roll. Never rerun an already committed action or carry an action into a different adventure. Build a presentation-only resolution with the next choices and permitted effects, then commit with the returned operation ID.

After the commit succeeds, emit every non-secret check through the exact `SYSTEM_MESSAGE` check-card marker defined in the main Skill's Player-Facing Output contract, including when the plugin runs directly in Codex. Never print a separate Markdown check summary, and never expose raw values for a secret check.

Engine stores stage receipts and unfinished turn provenance in the authenticated user's SQLite Durable Object. Matching retries return the original check or committed apply result without rerolling or advancing revision again. A later logical turn recovers unfinished work through the combined check entry (or the setup entry without an action); reusing an operation ID with changed stage input fails closed.
