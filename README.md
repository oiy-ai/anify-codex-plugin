# Anify Codex Plugins

This repo packages local Codex plugins for Anify GM sessions and character chat.

## Plugins

- `Anify Installer`: verifies Engine login, initializes the remote GM save, and cleans obsolete local Anify state from older development builds.
- `Anify-GM`: runs single-player or party TRPG adventures with remote GM saves through Anify Engine MCP.
- `Anify-Lynn`: private or group chat persona for Lynn Tale, with remote long-term character memory through Anify Engine MCP.
- `Anify-Thera`: private or group chat persona for Thera Valeria, with remote long-term character memory through Anify Engine MCP.
- `Anify-Lyra`: private or group chat persona for Lyra Oravia, with remote long-term character memory through Anify Engine MCP.

Shared character instructions live under `shared/anify-character/`. Role plugins keep only their local manifest, persona skill, synced shared workflow copy, and any future role-exclusive files. After editing shared character workflow, run `python3 scripts/sync_character_shared.py` so installed plugin archives include the same workflow.

Use the `anify-gm-adventure` skill to start or continue a campaign. Use the role persona skills when chatting with characters directly or when adding them to a GM adventure. The public Codex plugins use standard MCP OAuth discovery only. The Codex shell runtime passes the caller's Firebase bearer token to Engine MCP through shell-owned runtime config.

## State Model

Anify Codex plugins do not maintain local user workspaces. GM saves and role memories are stored by Anify Engine MCP:

- GM save tools: `anify_save_initialize`, `anify_save_get`, `anify_save_update`.
- Character memory tools: `anify_memory_search`, `anify_memory_remember`.
- Gameplay tools: `anify_start_adventure`, `anify_get_context`, `roll_check`, `anify_resolve_action`.

The Installer cleanup script removes obsolete local development paths:

```bash
python3 plugins/anify-installer/scripts/anify_installer.py cleanup-local-state
```
