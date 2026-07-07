# Anify Codex Plugins

This repo packages local Codex plugins for Anify GM sessions and character chat.

It provides:

- `Anify-GM`: runs single-player or party TRPG adventures, reads and writes local GM progress under `CODEX_HOME/anify/userA/GM`, and uses the Anify Engine MCP for auth, context, D20 checks, and deterministic rule advice.
- `Anify-Lynn`: private or group chat persona for Lynn Tale, with full hook-based context capture under `CODEX_HOME/anify/userA/Lynn`.
- `Anify-Thera`: private or group chat persona for Thera Valeria, with full hook-based context capture under `CODEX_HOME/anify/userA/Thera`.

Use the `anify-gm-adventure` skill to start or continue a campaign. Use the role persona skills when chatting with characters directly or when adding them to a GM adventure. The public Codex plugins use standard MCP OAuth discovery only. The Codex shell runtime passes the caller's Firebase bearer token to Engine MCP through shell-owned runtime config.

Run `python3 scripts/update_cachebuster.py <plugin-path>` after plugin changes to rewrite `.codex-plugin/plugin.json` as `<base-version>+codex.<UTC timestamp>`.

If an older client cache contains `bearer_token_env_var` in the public Anify MCP config, run `node scripts/repair_client_mcp_config.mjs` from the installed plugin checkout to remove that stale shell-only field.
