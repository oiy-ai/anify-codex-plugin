import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function text(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function json(path) {
  return JSON.parse(text(path));
}

const gmSkill = text('skills/anify-gm-adventure/SKILL.md');
const orchestration = text('skills/anify-gm-adventure/references/orchestration.md');
const authentication = text('skills/anify-gm-adventure/references/authentication.md');
const d20 = text('skills/anify-gm-adventure/references/d20-mcp-contract.md');
const memory = text('skills/anify-gm-adventure/references/memory-and-consistency.md');
const gmManifest = json('.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const gmMcp = json('.mcp.json');

function roleRoot(role) {
  return `plugins/anify-${role}`;
}

function roleManifest(role) {
  return json(`${roleRoot(role)}/.codex-plugin/plugin.json`);
}

function roleMcp(role) {
  return json(`${roleRoot(role)}/.mcp.json`);
}

function roleHooks(role) {
  return json(`${roleRoot(role)}/hooks/hooks.json`);
}

test('marketplace exposes GM plus two role plugins', () => {
  assert.equal(marketplace.name, 'anify-codex');
  assert.equal(marketplace.interface.displayName, 'Oiy AI');
  assert.deepEqual(
    marketplace.plugins.map((plugin) => [plugin.name, plugin.source.path, plugin.category]),
    [
      ['anify-gm', '.', 'Entertainment'],
      ['anify-lynn', './plugins/anify-lynn', 'Entertainment'],
      ['anify-thera', './plugins/anify-thera', 'Entertainment'],
    ],
  );
});

test('GM plugin identity and assets match Anify-GM branding', () => {
  assert.equal(gmManifest.name, 'anify-gm');
  assert.equal(gmManifest.interface.displayName, 'Anify-GM');
  assert.equal(gmManifest.interface.shortDescription, 'Run Anify adventures with a local GM save.');
  assert.match(gmManifest.interface.longDescription, /local campaign progress/);
  assert.equal(gmManifest.interface.composerIcon, './assets/anify-icon-64.png');
  assert.equal(gmManifest.interface.logo, './assets/anify-icon-512.png');

  for (const size of [32, 64, 128, 256, 512, 1024]) {
    const icon = readFileSync(join(repoRoot, `assets/anify-icon-${size}.png`));
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
  }
});

test('GM skill uses the GM workspace and progress save files', () => {
  for (const file of ['profile.md', 'progress.md', 'save.md', 'gm-memory.md', 'party-memory.md', 'turn-log.md']) {
    assert.match(gmSkill, new RegExp(file.replace('.', '\\.')));
  }
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.match(source, /CODEX_HOME\/anify\/userA\/GM/);
  }
  assert.match(gmSkill, /`CODEX_HOME\/anify\/users\/userA`/);
  assert.match(memory, /`CODEX_HOME\/anify\/users\/userA`/);
});

test('GM skill keeps Engine MCP as the D20 authority', () => {
  for (const tool of [
    'anify_auth_status',
    'anify_start_adventure',
    'anify_get_context',
    'roll_check',
    'anify_resolve_action',
  ]) {
    assert.match(gmSkill, new RegExp(tool));
  }
  assert.match(d20, /The GM must not alter `rolls`/);
});

test('all plugins share the Anify Engine MCP config', () => {
  assert.equal(gmMcp.mcpServers.anify.type, 'http');
  assert.equal(gmMcp.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(gmMcp.mcpServers.anify.bearer_token_env_var, undefined);
  assert.deepEqual(roleMcp('lynn'), gmMcp);
  assert.deepEqual(roleMcp('thera'), gmMcp);
});

test('role plugins expose persona skills and shared character workflow', () => {
  const roles = [
    ['lynn', 'Anify-Lynn', 'Lynn'],
    ['thera', 'Anify-Thera', 'Thera'],
  ];

  for (const [slug, displayName, character] of roles) {
    const manifest = roleManifest(slug);
    assert.equal(manifest.name, `anify-${slug}`);
    assert.equal(manifest.interface.displayName, displayName);
    assert.equal(manifest.interface.category, 'Entertainment');
    assert.equal(manifest.mcpServers, './.mcp.json');
    assert.equal(manifest.hooks, undefined);

    const persona = text(`${roleRoot(slug)}/skills/anify-${slug}-persona/SKILL.md`);
    assert.match(persona, new RegExp(`CODEX_HOME/anify/userA/${character}`));
    assert.match(persona, new RegExp(character));
  }

  assert.equal(
    text('plugins/anify-lynn/skills/anify-character-chat/SKILL.md'),
    text('plugins/anify-thera/skills/anify-character-chat/SKILL.md'),
  );
});

test('role hooks capture prompts, stops, compactions, and session starts', () => {
  const expectedEvents = ['SessionStart', 'UserPromptSubmit', 'Stop', 'PostCompact'];
  for (const [slug, character] of [
    ['lynn', 'Lynn'],
    ['thera', 'Thera'],
  ]) {
    const hooks = roleHooks(slug).hooks;
    assert.deepEqual(Object.keys(hooks).sort(), expectedEvents.sort());
    assert.match(JSON.stringify(hooks), new RegExp(`--character ${character}`));
  }

  assert.equal(
    text('plugins/anify-lynn/hooks/anify_character_hooks.py'),
    text('plugins/anify-thera/hooks/anify_character_hooks.py'),
  );
});

test('character hook script stores full context and injects startup memory', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'anify-character-hooks-'));
  const transcriptPath = join(tempDir, 'transcript.jsonl');
  writeFileSync(transcriptPath, '{"type":"user","text":"hello Lynn"}\n{"type":"assistant","text":"hello"}\n');

  const script = join(repoRoot, 'plugins/anify-lynn/hooks/anify_character_hooks.py');
  const env = { ...process.env, CODEX_HOME: tempDir };
  const basePayload = {
    session_id: 'session-1',
    turn_id: 'turn-1',
    transcript_path: transcriptPath,
    cwd: repoRoot,
    model: 'gpt-test',
  };

  try {
    const record = runHook(script, ['record', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'UserPromptSubmit',
      prompt: 'hello Lynn',
    }, env);
    assert.equal(record.stdout, '');

    const workspace = join(tempDir, 'anify', 'userA', 'Lynn');
    const eventLog = textFrom(workspace, 'history/hook-events.jsonl').trim().split('\n').map(JSON.parse);
    assert.equal(eventLog[0].event, 'UserPromptSubmit');
    assert.equal(eventLog[0].transcript_snapshot.available, true);
    assert.equal(textFromPath(eventLog[0].transcript_snapshot.snapshot_path), textFromPath(transcriptPath));

    runHook(script, ['post-compact', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'PostCompact',
      trigger: 'auto',
    }, env);
    const master = textFrom(workspace, 'memory/master.md');
    assert.match(master, /PostCompact/);
    assert.match(master, /Transcript tail excerpt/);
    assert.match(master, /hello Lynn/);

    const startup = runHook(script, ['session-start', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'SessionStart',
      source: 'startup',
    }, env);
    assert.match(startup.stdout, /Anify character startup context for Lynn/);
    assert.match(startup.stdout, /agentic search/);
    assert.match(startup.stdout, /Master memory/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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

function runHook(script, args, payload, env) {
  const result = spawnSync('python3', [script, ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function textFrom(root, path) {
  return readFileSync(join(root, path), 'utf8');
}

function textFromPath(path) {
  return readFileSync(path, 'utf8');
}
