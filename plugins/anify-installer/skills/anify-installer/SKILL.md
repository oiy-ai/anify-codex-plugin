---
name: anify-installer
description: Initialize the Anify Codex client with Engine login verification, remote GM save creation, and next-step plugin guidance. Use before Anify-GM or Anify character plugins are used on a fresh client install.
---

# Anify Installer

Use this skill when the user wants to initialize Anify in the Codex client, create the first remote GM save, or asks what to do before using Anify-GM and character plugins.

## Scope

Anify Installer owns first-run client setup only:

- Verify the Anify Engine MCP login once.
- Initialize the remote GM save through Engine MCP.
- Tell the user how to install and use Anify-GM and character plugins next.

Do not run gameplay. Do not start an adventure. Do not ask for Firebase credentials inside Codex.

The host injects the stable run operation ID through the MCP `x-anify-operation-id` header. Never ask the user for it or add it to `anify_save_initialize` arguments.

## Initialization Flow

1. Verify the Engine login by calling `anify_auth_status`.
   - If the MCP call fails or reports missing auth, stop and tell the user to reconnect Anify from the Codex plugin/MCP login UI.
   - Do not collect or paste account credentials.
2. Collect exactly these save initialization fields from the user:
   - name
   - profession
   - gender
   - other settings
3. Initialize the remote GM save by calling `anify_save_initialize` with those fields.
   - If a remote GM save already exists, do not overwrite it unless the user explicitly asks to reinitialize and confirms data replacement.
   - If the user confirms replacement, call `anify_save_initialize` with `force: true`.

## Final Guidance

After successful setup, tell the user:

- Install Anify-GM to run adventures.
- Install one or more character plugins to chat with characters or bring them into GM scenes.
- Use Anify-GM alone for solo adventure.
- Use Anify-GM plus character plugins for party scenes.
- Use a character plugin alone for private character chat.
