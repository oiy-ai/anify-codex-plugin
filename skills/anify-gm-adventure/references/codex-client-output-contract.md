# Native Codex Client Output Contract

Use this contract when the host has not explicitly declared `Presentation surface: Anify Web`.

## Text-Only Boundary

The native Codex client is a complete text interface over the same Engine save as Anify Web. It does not render Web markers, visual battle controls, Gaussian-splat exploration scenes, or memory image/video generation.

Do not emit `CHOICES`, `SYSTEM_MESSAGE`, `BATTLE`, `ITEM_GIVE`, or other Web marker lines. Do not claim that a visual panel, battle scene, 3D scene, image, or video was opened or generated.

Text battle and text exploration remain playable. Resolve them through Engine MCP and describe only the canonical result.

## Adventure Turns

Return concise narration followed by exactly three numbered choices. End with one short sentence saying the player may also describe another action.

```text
Moonlight catches on three fresh tracks beyond the gate.

1. Follow the tracks into the trees.
2. Inspect the broken ward-stone.
3. Wait and listen for movement.

You may also describe another action.
```

For a visible D20 result, render one compact text summary before the consequence:

```text
**Wisdom (Perception): 15 vs DC 14 — success.**
```

Use the exact Engine `ability`, `total`, `dc`, and `outcome`. For a secret check, omit raw roll and DC details and narrate only the fictional consequence.

When combat begins, summarize the committed battle state returned by Engine and list the currently valid text actions. Do not emit a `BATTLE` marker. On later turns, execute battle commands through `anify_game_action` and report its canonical result.

When the adventure ends, state the outcome in normal prose. Do not emit an `ADVENTURE_END` marker.

## Administrative Responses

For inventory, equipment, character, quest, map, shop, or other deterministic requests:

- Call the Engine MCP operation documented in `codex-client-gameplay.md`.
- Summarize the returned canonical result in the user's language.
- Keep exact item, quest, ability, enemy, and area IDs visible when the player needs them for a follow-up action.
- Never invent a row, stat, reward, price, target, or state change that is absent from Engine.
- Never expose tool names, operation IDs, receipts, raw save objects, or internal protocol details in the player-facing answer.
