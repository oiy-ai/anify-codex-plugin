---
name: anify-installer
description: Initialize the local Anify Codex client with Engine login verification, long-term memory runtime deployment, GM save creation, and next-step plugin guidance. Use before Anify-GM or Anify character plugins are used on a fresh client install.
---

# Anify Installer

Use this skill when the user wants to initialize Anify in the Codex client, prepare local long-term memory, create the first local GM save, or asks what to do before using Anify-GM and character plugins.

## Scope

Anify Installer owns first-run client setup only:

- Verify the Anify Engine MCP login once.
- Check and deploy the local long-term memory runtime.
- Initialize the local GM Markdown save files.
- Tell the user how to install and use Anify-GM and character plugins next.

Do not run gameplay. Do not start an adventure. Do not create Engine remote saves. Do not ask for Firebase credentials inside Codex.

## Paths

Use this local client layout:

```text
CODEX_HOME/anify/users/userA/GM
CODEX_HOME/anify/users/userA/<Character>
CODEX_HOME/anify/runtime/python
```

If `CODEX_HOME` is unset, use `~/.codex`.

## Initialization Flow

1. Verify the Engine login by calling `anify_auth_status`.
   - If the MCP call fails or reports missing auth, stop and tell the user to reconnect Anify from the Codex plugin/MCP login UI.
   - Do not collect or paste account credentials.
2. Check the local long-term memory runtime:

```bash
python3 "${PLUGIN_ROOT}/scripts/anify_installer.py" check-runtime
```

3. If the runtime is missing or incomplete, tell the user that Anify needs to deploy the local long-term memory system. Ask for explicit confirmation before installing.
4. Only after confirmation, run:

```bash
python3 "${PLUGIN_ROOT}/scripts/anify_installer.py" install-runtime
```

5. Collect exactly these save initialization fields from the user:
   - name
   - profession
   - gender
   - other settings
6. Initialize the local GM save:

```bash
python3 "${PLUGIN_ROOT}/scripts/anify_installer.py" init-save --name "<name>" --profession "<profession>" --gender "<gender>" --other "<other settings>"
```

If a GM save already exists, do not overwrite it unless the user explicitly asks to reinitialize and confirms data replacement.

## Final Guidance

After successful setup, tell the user:

- Install Anify-GM to run adventures.
- Install one or more character plugins to chat with characters or bring them into GM scenes.
- Use Anify-GM alone for solo adventure.
- Use Anify-GM plus character plugins for party scenes.
- Use a character plugin alone for private character chat.
