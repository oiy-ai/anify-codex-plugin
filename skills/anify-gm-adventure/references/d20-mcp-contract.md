# D20 MCP Contract

Anify requires D20 checks to be resolved outside the GM model. The MCP server is `anify`, with the D20 tool `roll_check`.

`roll_check` requires a valid Anify Firebase session. It must fail before rolling if the MCP request is not authenticated.

Do not call `roll_check` until the adventure has been started and the remote save loaded by `anify_save_get` records `ready_for_gameplay: true`.

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
  "check_id": "uuid",
  "timestamp": "UTC timestamp",
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

- Call `anify_start_adventure` only when the remote save has no active `adventure_session_id`.
- The GM decides DC and modifier before calling the tool.
- The GM must not alter `rolls`, `kept_roll`, `total`, `margin`, or `outcome`.
- Pass the full `CheckResult` to `anify_resolve_action`; it must reject missing or fabricated outcomes.
- Persist the full `CheckResult` through `anify_save_update`.
- If `secret` is true, summarize the fictional consequence without revealing the raw roll unless the user asks to inspect state.
- Every player action that affects uncertain fiction must pass through this tool.

After `roll_check`, call `anify_resolve_action` so Engine can return rule advice, save deltas, and `saveUpdateArguments`. Use `saveUpdateArguments` as the base payload for `anify_save_update`.
