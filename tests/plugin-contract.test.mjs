import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const skill = readFileSync(new URL('../skills/anify-trpg-adventure/SKILL.md', import.meta.url), 'utf8');
const orchestration = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/orchestration.md', import.meta.url),
  'utf8',
);
const authentication = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/authentication.md', import.meta.url),
  'utf8',
);
const d20 = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/d20-mcp-contract.md', import.meta.url),
  'utf8',
);
const memory = readFileSync(
  new URL('../skills/anify-trpg-adventure/references/memory-and-consistency.md', import.meta.url),
  'utf8',
);
const pluginManifest = JSON.parse(readFileSync(new URL('../.codex-plugin/plugin.json', import.meta.url), 'utf8'));
const marketplace = JSON.parse(readFileSync(new URL('../.agents/plugins/marketplace.json', import.meta.url), 'utf8'));
const mcpConfig = JSON.parse(readFileSync(new URL('../.mcp.json', import.meta.url), 'utf8'));

test('marketplace and plugin identity stay aligned with public branding', () => {
  assert.equal(marketplace.name, 'anify-codex');
  assert.equal(marketplace.interface.displayName, 'Oiy AI');
  assert.equal(marketplace.plugins[0].name, 'anify');
  assert.equal(pluginManifest.name, 'anify');
  assert.equal(pluginManifest.description, '开启一场属于你的异世界冒险。');
  assert.equal(pluginManifest.interface.shortDescription, '开启一场属于你的异世界冒险。');
  assert.equal(pluginManifest.interface.longDescription, '开启一场属于你的异世界冒险。');
});

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

test('skill preserves the local adventure session on continued turns', () => {
  assert.match(skill, /do not call `anify_start_adventure`/i);
  assert.match(skill, /preserve the saved session/i);
  assert.match(authentication, /do not call `anify_start_adventure`/i);
  assert.match(authentication, /keep the saved session id/i);
  assert.match(d20, /do not call `anify_start_adventure` again/i);
});

test('plugin MCP config points at the Anify Engine MCP server', () => {
  assert.equal(mcpConfig.mcpServers.anify.type, 'http');
  assert.equal(mcpConfig.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(mcpConfig.mcpServers.anify.bearer_token_env_var, undefined);
  assert.match(mcpConfig.mcpServers.anify.note, /Engine MCP/);
});

test('legacy client repair only removes shell bearer config from production Anify MCP', async () => {
  const { repairAnifyClientMcpConfig } = await import('../scripts/repair_client_mcp_config.mjs');
  const tempDir = mkdtempSync(join(tmpdir(), 'anify-client-repair-'));
  const productionConfig = join(tempDir, 'production.mcp.json');
  const shellConfig = join(tempDir, 'shell.mcp.json');

  try {
    writeFileSync(
      productionConfig,
      `${JSON.stringify({
        mcpServers: {
          anify: {
            type: 'http',
            url: 'https://anify.ai/mcp',
            bearer_token_env_var: 'ANIFY_ENGINE_BEARER_TOKEN',
          },
        },
      })}\n`,
    );
    writeFileSync(
      shellConfig,
      `${JSON.stringify({
        mcpServers: {
          anify: {
            type: 'http',
            url: 'http://host.docker.internal:8788/mcp',
            bearer_token_env_var: 'ANIFY_ENGINE_BEARER_TOKEN',
          },
        },
      })}\n`,
    );

    const result = repairAnifyClientMcpConfig([productionConfig, shellConfig, productionConfig]);
    assert.deepEqual(result.changed, [productionConfig]);

    const repairedProduction = JSON.parse(readFileSync(productionConfig, 'utf8'));
    const untouchedShell = JSON.parse(readFileSync(shellConfig, 'utf8'));
    assert.equal(repairedProduction.mcpServers.anify.bearer_token_env_var, undefined);
    assert.equal(untouchedShell.mcpServers.anify.bearer_token_env_var, 'ANIFY_ENGINE_BEARER_TOKEN');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
