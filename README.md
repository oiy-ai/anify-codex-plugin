# Anify

Anify is a local Codex plugin for running AI-driven DnD-style TRPG adventures.

It provides:

- A single Firebase Auth login path shared with the Anify web app.
- MCP-level auth gating before any adventure session or D20 check can run.
- A GM AI orchestration protocol.
- A configurable character AI template.
- Long-term memory and personality consistency controls.
- A stable turn loop: GM narration, three options, user action, D20 check, character reaction, GM advancement.
- A bundled `anify` MCP server for auth status, adventure start, and D20 checks outside the GM model.

Use the `anify-trpg-adventure` skill to start or continue a campaign after logging in at `https://anify.ai`. There is no offline, single-player, or local `.anify` save fallback path; gameplay waits for authenticated server-side state MCP tools.
