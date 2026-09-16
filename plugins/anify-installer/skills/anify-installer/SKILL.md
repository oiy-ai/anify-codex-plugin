---
name: anify-installer
description: "Initialize an Anify client or its first remote save when the user requests setup. Answer setup questions without mutating state. Do not trigger merely because an Anify plugin is mentioned or installed; do not run gameplay or development tasks."
---

# Anify Installer

Use this skill when the user wants to initialize Anify in the Codex client, create the first remote GM save, or asks what to do before using Anify-GM and character plugins.

## Scope

Anify Installer owns first-run client setup only:

- Verify the Anify Engine MCP login once.
- Initialize the remote GM save through Engine MCP.
- Tell the user how to install and use Anify-GM and character plugins next.

Do not run gameplay. Do not start an adventure. Do not ask for Firebase credentials inside Codex.

The Initialization Flow below owns the single entry call for this turn. Pass its retained ID as the required top-level `operation_id` argument to `anify_save_initialize`. In Shell, the trusted `x-anify-operation-id` header takes precedence inside Engine, but the argument is still mandatory. Never ask the user to provide or invent an operation ID.

## Initialization Flow

Run this flow only when initialization is requested; explanatory questions need no Engine mutation.

1. Call `anify_begin_operation` and retain its returned `operation_id` for the entire initialization turn.
   - If the MCP call fails because auth is missing, stop and tell the user to reconnect Anify from the Codex plugin/MCP login UI.
   - Do not collect or paste account credentials.
2. Verify the Engine login by calling `anify_auth_status`.
   - If the MCP call fails or reports missing auth, stop and tell the user to reconnect Anify from the Codex plugin/MCP login UI.
   - Do not collect or paste account credentials.
3. Read `anify_save_get` before collecting profile details. If an initialized save exists and replacement was not requested, reuse it and continue to guidance. For a new save, reuse supplied name, profession, gender, and other settings; infer a concise default profile as in Anify-GM. Ask only for required fields that cannot be inferred; optional fields do not block setup.
4. Initialize the remote GM save by calling `anify_save_initialize` with the retained `operation_id` and those fields.
   - If a remote GM save already exists, do not overwrite it unless the user explicitly authorizes replacing that save with awareness of the data loss. Existing explicit authorization for that same replacement is sufficient; otherwise ask before using force.
   - If the user confirms replacement, call `anify_save_initialize` with the same `operation_id` and `force: true`.

## Final Guidance

After successful setup, tell the user:

- Install Anify-GM to run adventures.
- Install one or more character plugins to chat with characters or bring them into GM scenes.
- Use Anify-GM alone for solo adventure.
- Use Anify-GM plus character plugins for party scenes.
- Use a character plugin alone for private character chat.
