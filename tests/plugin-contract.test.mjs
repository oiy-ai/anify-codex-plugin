import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const skill = readFileSync(new URL('../skills/anify-trpg-adventure/SKILL.md', import.meta.url), 'utf8');
const orchestration = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/orchestration.md', import.meta.url),
  'utf8',
);
const memory = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/memory-and-consistency.md', import.meta.url),
  'utf8',
);
const mcpConfig = JSON.parse(readFileSync(new URL('../.mcp.json', import.meta.url), 'utf8'));

test('skill requires the userA Markdown save files', () => {
  for (const file of ['profile.md', 'save.md', 'gm-memory.md', 'character-memory.md', 'turn-log.md']) {
    assert.match(skill, new RegExp(file.replace('.', '\\.')));
    assert.match(orchestration, new RegExp(file.replace('.', '\\.')));
  }
  assert.match(skill, /CODEX_HOME\/anify\/users\/userA/);
  assert.match(memory, /CODEX_HOME\/anify\/users\/userA/);
});

test('skill references the coarse Engine MCP tools', () => {
  for (const tool of [
    'anify_auth_status',
    'anify_start_adventure',
    'anify_get_context',
    'roll_check',
    'anify_resolve_action',
  ]) {
    assert.match(skill, new RegExp(tool));
  }
});

test('plugin MCP config points at the Anify Engine MCP server', () => {
  assert.equal(mcpConfig.mcpServers.anify.type, 'http');
  assert.equal(mcpConfig.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(mcpConfig.mcpServers.anify.bearer_token_env_var, 'ANIFY_ENGINE_BEARER_TOKEN');
  assert.match(mcpConfig.mcpServers.anify.note, /Engine MCP/);
});
