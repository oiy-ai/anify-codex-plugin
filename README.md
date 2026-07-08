# Anify Codex Plugins

This repo packages local Codex plugins for Anify GM sessions and character chat.

It provides:

- `Anify-GM`: runs single-player or party TRPG adventures, reads and writes local GM progress under `CODEX_HOME/anify/userA/GM`, and uses the Anify Engine MCP for auth, context, D20 checks, and deterministic rule advice.
- `Anify-Lynn`: private or group chat persona for Lynn Tale, with local mem0 character memory under `CODEX_HOME/anify/userA/Lynn/memory`.
- `Anify-Thera`: private or group chat persona for Thera Valeria, with local mem0 character memory under `CODEX_HOME/anify/userA/Thera/memory`.
- `Anify-Lyra`: private or group chat persona for Lyra Oravia, with local mem0 character memory under `CODEX_HOME/anify/userA/Lyra/memory`.

Shared character runtime lives under `shared/anify-character/`. Role plugins keep only their local manifest, hook wiring, persona skill, synced shared runtime copy, and any future role-exclusive files. After editing shared character runtime, run `python3 scripts/sync_character_shared.py` so installed plugin archives include the same runtime.

Use the `anify-gm-adventure` skill to start or continue a campaign. Use the role persona skills when chatting with characters directly or when adding them to a GM adventure. The public Codex plugins use standard MCP OAuth discovery only. The Codex shell runtime passes the caller's Firebase bearer token to Engine MCP through shell-owned runtime config.

Role memory hooks call the native mem0 OSS SDK; they do not fork mem0 and do not use the official cloud mem0 Codex plugin. Install the hook runtime dependency in the Python environment used by Codex:

```bash
python3 -m pip install mem0ai
```

The default local mem0 layout is:

```text
CODEX_HOME/anify/userA/<Character>/memory/history.db
CODEX_HOME/anify/userA/<Character>/memory/qdrant/
CODEX_HOME/anify/userA/<Character>/memory/hook-events.jsonl
CODEX_HOME/anify/userA/<Character>/memory/transcripts/
CODEX_HOME/anify/userA/<Character>/memory/memory-operations.jsonl
```

The default mem0 config uses OpenAI for extraction and embeddings, so `OPENAI_API_KEY` must be available to Codex hooks.

Run `python3 scripts/update_cachebuster.py <plugin-path>` after plugin changes to rewrite `.codex-plugin/plugin.json` as `<base-version>+codex.<UTC timestamp>`.

If an older client cache contains `bearer_token_env_var` in the public Anify MCP config, run `node scripts/repair_client_mcp_config.mjs` from the installed plugin checkout to remove that stale shell-only field.
