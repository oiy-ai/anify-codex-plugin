# Anify Codex Plugins

This repo packages Codex plugins for Anify GM sessions and character chat.

## Plugins

- `Anify Installer`: verifies Engine login and initializes the remote GM save.
- `Anify-GM`: runs single-player or party TRPG adventures on Anify Web or directly in Codex through Anify Engine MCP.
- `Anify-Lynn`: private or group chat persona for Lynn Tale, with remote long-term character memory through Anify Engine MCP.
- `Anify-Thera`: private or group chat persona for Thera Valeria, with remote long-term character memory through Anify Engine MCP.
- `Anify-Lyra`: private or group chat persona for Lyra Oravia, with remote long-term character memory through Anify Engine MCP.

Gameplay, persona, media, and shared character instructions are maintained in the Engine prompt registry through Studio. This repository contains only plugin packaging and lightweight skill entry points. Each invocation reads the latest published document through `anify_prompt_get`, including resumed conversations; references are retrieved through the same tool. No historical prompt version is retained as a fallback.

The shared character **entry point** lives under `shared/anify-character/`. Run `python3 scripts/sync_character_shared.py` after changing that loader so each role plugin receives the same entry point. Changes to gameplay wording and personas are published from Studio and do not require rebuilding these loader packages.

Use the `anify-gm-adventure` skill to start or continue a campaign. Use the role persona skills when chatting with characters directly or when adding them to a GM adventure. The public Codex plugins use standard MCP OAuth discovery only. Active adventure turns use `roll_check` (entry, recovery, session/revision validation, D20 and rules) followed by `anify_apply_gm_resolution`. Reuse the last committed save across turns. Setup and deterministic mutations use `anify_begin_operation`, which returns save and pending state together. Subsequent mutations carry the entry tool's returned `operation_id`. The Codex shell runtime also passes the caller's Firebase bearer token through shell-owned runtime config and maps its trusted run ID from `ANIFY_OPERATION_ID` to the Engine `x-anify-operation-id` header.

Codex Shell and directly installed plugins use the same Anify Web wire contract, including line-level UI markers. Direct Codex use is intended for internal play and AI regression testing, so it emits those markers without a separate human-friendly adapter. Inventory, equipment, character stats, quests, graph-based locations, adjacent adventures, Return Scrolls, shops, non-visual exploration, non-visual battle, and character continuity still use the same Engine save. Direct Codex does not provide visual battle controls or Gaussian-splat exploration. Adventure image/video requests use Engine media tasks; queued tasks are checked with `anify_adventure_media_status`.

## State Model

Anify Codex plugins do not maintain local user workspaces. GM saves and role memories are stored by Anify Engine MCP:

- Operation tools: `anify_begin_operation`, `anify_pending_turn_get`.
- Canonical save tools: `anify_save_initialize`, `anify_save_get`.
- Character memory tools: `anify_memory_search`, `anify_memory_remember`.
- Gameplay tools: `anify_start_adventure`, `anify_get_context`, `roll_check`, `anify_apply_gm_resolution`, `anify_game_action`.

The remote save contains one canonical Engine game state. Codex and Anify Web mutate that same state through Engine-owned operations; plugins never submit arbitrary game-state patches. Engine receipts make a retried Shell run replay the original committed tool stages instead of rerolling or duplicating a turn.

## Build and publish

The source tree keeps one canonical plugin implementation. Environment-specific MCP URLs are generated only in npm package artifacts from `config/mcp-targets.json`:

Verify shared skill synchronization, plugin contracts, build error handling, and production-resource reachability with:

```bash
python3 scripts/sync_character_shared.py
node --experimental-test-coverage \
  --test-coverage-include=scripts/build_plugin_packages.mjs \
  --test-coverage-lines=95 \
  --test-coverage-branches=80 \
  --test-coverage-functions=100 \
  --test tests/*.test.mjs
```

Build environment-specific packages with:

```bash
node scripts/build_plugin_packages.mjs --target preview --version-id local-1
node scripts/build_plugin_packages.mjs --target production --version-id local-1
```

The commands write five public packages under `dist/<target>/` without modifying tracked plugin manifests. Preview artifacts use `https://anify-web-preview.xsun.workers.dev/mcp` and the npm `preview` dist-tag. Production artifacts use `https://anify.ai/mcp` and the npm `latest` dist-tag.

Pushing the same source commit to `preview` and `main` triggers `.github/workflows/publish-plugins.yml`. The workflow runs contract tests, verifies every npm tarball, then publishes through npm Trusted Publishing (OIDC), without an npm token:

- `@oiy-ai/anify-installer`
- `@oiy-ai/anify-gm`
- `@oiy-ai/anify-lynn`
- `@oiy-ai/anify-thera`
- `@oiy-ai/anify-lyra`

The root marketplace installs production packages. The preview marketplace is available at `marketplaces/preview/.agents/plugins/marketplace.json` and resolves the same packages through their `preview` dist-tag.

## Adventure images and videos

In the current adventure thread, use `$anify-adventure-image` or `$anify-adventure-video`. Anify Web's media buttons invoke the same skills through Codex Shell, continuing the same GM thread. Codex summarizes the committed scene and calls `anify_generate_adventure_image` or `anify_generate_adventure_video` on Engine MCP. Engine never calls Codex Shell.

Inputs are `adventure_session_id`, `summary` (save language, max 4000 characters), and `prompt` (visual instructions, max 8000 characters). Results are `{ kind, status, summary, prompt, url }`. Both tools currently return `status: "mock"` and `url: null`, with no generation, billing or save changes. The future `completed` result requires an asset URL. Skills expose the exact result in an `ADVENTURE_MEDIA` line marker so Web can render and restore cards from thread history.
