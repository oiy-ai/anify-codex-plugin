import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webIconRoot = join(repoRoot, '..', 'anify-web', 'public', 'icons');

function text(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function json(path) {
  return JSON.parse(text(path));
}

function bytes(path) {
  return readFileSync(join(repoRoot, path));
}

function webIcon(path) {
  return readFileSync(join(webIconRoot, path));
}

const gmSkill = text('skills/anify-gm-adventure/SKILL.md');
const orchestration = text('skills/anify-gm-adventure/references/orchestration.md');
const authentication = text('skills/anify-gm-adventure/references/authentication.md');
const d20 = text('skills/anify-gm-adventure/references/d20-mcp-contract.md');
const memory = text('skills/anify-gm-adventure/references/memory-and-consistency.md');
const gmManifest = json('.codex-plugin/plugin.json');
const installerManifest = json('plugins/anify-installer/.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const gmMcp = json('.mcp.json');
const installerMcp = json('plugins/anify-installer/.mcp.json');
const roles = [
  ['lynn', 'Anify-Lynn', 'Lynn', 'Lynn Tale'],
  ['thera', 'Anify-Thera', 'Thera', 'Thera Valeria'],
  ['lyra', 'Anify-Lyra', 'Lyra', 'Lyra Oravia'],
];

function roleRoot(role) {
  return `plugins/anify-${role}`;
}

function roleManifest(role) {
  return json(`${roleRoot(role)}/.codex-plugin/plugin.json`);
}

function roleMcp(role) {
  return json(`${roleRoot(role)}/.mcp.json`);
}

test('marketplace exposes installer, GM, and role plugins', () => {
  assert.equal(marketplace.name, 'anify-codex');
  assert.equal(marketplace.interface.displayName, 'Oiy AI');
  assert.deepEqual(
    marketplace.plugins.map((plugin) => [plugin.name, plugin.source.path, plugin.category, plugin.policy.authentication]),
    [
      ['anify-installer', './plugins/anify-installer', 'Productivity', 'ON_INSTALL'],
      ['anify-gm', '.', 'Entertainment', 'ON_USE'],
      ['anify-lynn', './plugins/anify-lynn', 'Entertainment', 'ON_USE'],
      ['anify-thera', './plugins/anify-thera', 'Entertainment', 'ON_USE'],
      ['anify-lyra', './plugins/anify-lyra', 'Entertainment', 'ON_USE'],
    ],
  );
});

test('installer plugin initializes remote saves and cleans obsolete local state', () => {
  assert.equal(installerManifest.name, 'anify-installer');
  assert.equal(installerManifest.interface.displayName, 'Anify Installer');
  assert.equal(installerManifest.skills, './skills/');
  assert.equal(installerManifest.mcpServers, './.mcp.json');
  assert.equal(installerMcp.mcpServers.anify.type, 'http');
  assert.equal(installerMcp.mcpServers.anify.url, 'https://anify.ai/mcp');

  const installerSkill = text('plugins/anify-installer/skills/anify-installer/SKILL.md');
  assert.match(installerSkill, /anify_save_initialize/);
  assert.match(installerSkill, /cleanup-local-state/);
  assert.doesNotMatch(installerSkill, /install-runtime|mem0|local GM Markdown save/i);

  for (const size of [192, 512]) {
    const icon = bytes(`plugins/anify-installer/assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, webIcon(`icon-${size}x${size}.png`));
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'anify-installer-cleanup-'));
  try {
    mkdirSync(join(tempDir, 'anify/users/userA/GM'), { recursive: true });
    mkdirSync(join(tempDir, 'anify/runtime/python'), { recursive: true });
    writeFileSync(join(tempDir, 'anify/users/userA/GM/save.md'), 'legacy');
    const result = spawnSync('python3', [
      join(repoRoot, 'plugins/anify-installer/scripts/anify_installer.py'),
      'cleanup-local-state',
    ], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: tempDir } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(tempDir, 'anify/users')), false);
    assert.equal(existsSync(join(tempDir, 'anify/runtime')), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('GM plugin identity and assets match Anify-GM branding', () => {
  assert.equal(gmManifest.name, 'anify-gm');
  assert.equal(gmManifest.interface.displayName, 'Anify-GM');
  assert.equal(gmManifest.interface.shortDescription, 'Run Anify adventures with an initialized remote GM save.');
  assert.match(gmManifest.interface.longDescription, /remote campaign progress/);
  assert.equal(gmManifest.interface.composerIcon, './assets/icon-192x192.png');
  assert.equal(gmManifest.interface.logo, './assets/icon-512x512.png');

  for (const size of [192, 512]) {
    const icon = bytes(`assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, webIcon(`icon-${size}x${size}.png`));
  }
});

test('GM skill uses Engine remote save and memory tools', () => {
  for (const tool of [
    'anify_save_get',
    'anify_save_update',
    'anify_start_adventure',
    'anify_get_context',
    'roll_check',
    'anify_resolve_action',
  ]) {
    assert.match(gmSkill, new RegExp(tool));
  }
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.doesNotMatch(source, /CODEX_HOME\/anify\/users|users\/userA|save\.md|gm-memory\.md|party-memory\.md|turn-log\.md/);
    assert.doesNotMatch(source, /local Markdown|local GM|Markdown save/i);
    assert.match(source, /remote|Engine MCP|anify_/i);
  }
  assert.match(gmSkill, /run Anify Installer/);
});

test('all plugins share the Anify Engine MCP config', () => {
  assert.equal(gmMcp.mcpServers.anify.type, 'http');
  assert.equal(gmMcp.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(gmMcp.mcpServers.anify.bearer_token_env_var, undefined);
  assert.match(gmMcp.mcpServers.anify.note, /remote saves/);
  for (const [slug] of roles) {
    assert.deepEqual(roleMcp(slug), gmMcp);
  }
});

test('role plugins expose persona skills and shared remote character workflow', () => {
  const sharedSkill = text('shared/anify-character/skills/anify-character-chat/SKILL.md');
  assert.match(sharedSkill, /anify_memory_search/);
  assert.match(sharedSkill, /anify_memory_remember/);
  assert.doesNotMatch(sharedSkill, /CODEX_HOME|mem0|qdrant|hook-events|transcripts/i);

  for (const [slug, displayName, character, fullName] of roles) {
    const manifest = roleManifest(slug);
    assert.equal(manifest.name, `anify-${slug}`);
    assert.equal(manifest.interface.displayName, displayName);
    assert.equal(manifest.interface.category, 'Entertainment');
    assert.equal(manifest.interface.composerIcon, './assets/icon-192x192.png');
    assert.equal(manifest.interface.logo, './assets/icon-512x512.png');
    assert.equal(manifest.mcpServers, './.mcp.json');
    assert.equal(manifest.hooks, undefined);
    assert.doesNotMatch(JSON.stringify(manifest), /CODEX_HOME|hooks|local long-term/i);

    for (const size of [192, 512]) {
      const icon = bytes(`${roleRoot(slug)}/assets/icon-${size}x${size}.png`);
      assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
      assert.equal(icon.readUInt32BE(16), size);
      assert.equal(icon.readUInt32BE(20), size);
      assert.deepEqual(icon, webIcon(`${slug}/icon-${size}x${size}.png`));
    }

    const persona = text(`${roleRoot(slug)}/skills/anify-${slug}-persona/SKILL.md`);
    assert.match(persona, new RegExp(`Engine MCP character id \`${character}\``));
    assert.match(persona, new RegExp(fullName));
    assert.doesNotMatch(persona, /CODEX_HOME\/anify\/users/);

    const localWorkflow = text(`${roleRoot(slug)}/skills/anify-character-chat/SKILL.md`);
    assert.match(localWorkflow, /\.\.\/\.\.\/shared\/anify-character\/skills\/anify-character-chat\/SKILL\.md/);
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'hooks', 'hooks.json')), false);
  }
});

test('role packages carry synced shared character workflow for plugin cache installs', () => {
  const sharedSkill = text('shared/anify-character/skills/anify-character-chat/SKILL.md');

  for (const [slug] of roles) {
    assert.equal(
      text(`${roleRoot(slug)}/shared/anify-character/skills/anify-character-chat/SKILL.md`),
      sharedSkill,
    );
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'shared/anify-character/hooks/anify_character_hooks.py')), false);
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'shared/anify-character/hooks/anify_memory_runtime.sh')), false);
  }
});
