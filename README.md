# Anify Codex Plugins

This repo packages Codex plugins for Anify GM sessions and character chat.

## Plugins

- `Anify Installer`: verifies Engine login and initializes the remote GM save.
- `Anify-GM`: runs single-player or party TRPG adventures on Anify Web or directly in Codex through Anify Engine MCP.
- `Anify-Lynn`: private or group chat persona for Lynn Tale, with remote long-term character memory through Anify Engine MCP.
- `Anify-Thera`: private or group chat persona for Thera Valeria, with remote long-term character memory through Anify Engine MCP.
- `Anify-Lyra`: private or group chat persona for Lyra Oravia, with remote long-term character memory through Anify Engine MCP.

Shared character instructions live under `shared/anify-character/`. Role plugins keep only their local manifest, persona skill, synced character-chat skill, and any future role-exclusive files. After editing the shared character workflow, run `python3 scripts/sync_character_shared.py` so every installed role plugin exposes the same workflow directly from its `skills/` directory.

Use the `anify-gm-adventure` skill to start or continue a campaign. Use the role persona skills when chatting with characters directly or when adding them to a GM adventure. The public Codex plugins use standard MCP OAuth discovery only. Every logical turn begins with `anify_begin_operation`, and every mutation carries its returned `operation_id`. The Codex shell runtime also passes the caller's Firebase bearer token through shell-owned runtime config and maps its trusted run ID from `ANIFY_OPERATION_ID` to the Engine `x-anify-operation-id` header.

Codex Shell and directly installed plugins use the same Anify Web wire contract, including line-level UI markers. Direct Codex use is intended for internal play and AI regression testing, so it emits those markers without a separate human-friendly adapter. Inventory, equipment, character stats, quests, graph-based locations, adjacent adventures, Return Scrolls, shops, non-visual exploration, non-visual battle, and character continuity still use the same Engine save. Direct Codex does not provide visual battle controls, Gaussian-splat exploration, or memory image/video generation.

## State Model

Anify Codex plugins do not maintain local user workspaces. GM saves and role memories are stored by Anify Engine MCP:

- Operation tools: `anify_begin_operation`, `anify_pending_turn_get`.
- Canonical save tools: `anify_save_initialize`, `anify_save_get`.
- Character memory tools: `anify_memory_search`, `anify_memory_remember`.
- Gameplay tools: `anify_start_adventure`, `anify_get_context`, `roll_check`, `anify_resolve_action`, `anify_apply_gm_resolution`, `anify_game_action`.

The remote save contains one canonical Engine game state. Codex and Anify Web mutate that same state through Engine-owned operations; plugins never submit arbitrary game-state patches. Engine receipts make a retried Shell run replay the original committed tool stages instead of rerolling or duplicating a turn.

## Build and publish

The source tree keeps one canonical plugin implementation. Environment-specific MCP URLs are generated only in npm package artifacts from `config/mcp-targets.json`:

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
