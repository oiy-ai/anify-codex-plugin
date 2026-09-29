import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function text(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function json(path) {
  return JSON.parse(text(path));
}

function bytes(path) {
  return readFileSync(join(repoRoot, path));
}

const gmSkill = text('skills/anify-gm-adventure/SKILL.md');
const gmManifest = json('.codex-plugin/plugin.json');
const installerManifest = json('plugins/anify-installer/.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const previewMarketplace = json('marketplaces/preview/.agents/plugins/marketplace.json');
const gmMcp = json('.mcp.json');
const installerMcp = json('plugins/anify-installer/.mcp.json');
const configuredMcpUrl = gmMcp.mcpServers.anify.url;
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


test('production and preview marketplaces expose environment-tagged npm plugins', () => {
  assert.equal(marketplace.name, 'anify-codex');
  assert.equal(marketplace.interface.displayName, 'Oiy AI');
  assert.deepEqual(
    marketplace.plugins.map((plugin) => [
      plugin.name,
      plugin.source.source,
      plugin.source.package,
      plugin.source.version,
      plugin.category,
      plugin.policy.authentication,
    ]),
    [
      ['anify-installer', 'npm', '@oiy-ai/anify-installer', 'latest', 'Productivity', 'ON_INSTALL'],
      ['anify-gm', 'npm', '@oiy-ai/anify-gm', 'latest', 'Entertainment', 'ON_USE'],
      ['anify-lynn', 'npm', '@oiy-ai/anify-lynn', 'latest', 'Entertainment', 'ON_USE'],
      ['anify-thera', 'npm', '@oiy-ai/anify-thera', 'latest', 'Entertainment', 'ON_USE'],
      ['anify-lyra', 'npm', '@oiy-ai/anify-lyra', 'latest', 'Entertainment', 'ON_USE'],
    ],
  );
  assert.equal(previewMarketplace.name, 'anify-codex-preview');
  assert.equal(previewMarketplace.interface.displayName, 'Oiy AI Preview');
  assert.deepEqual(
    previewMarketplace.plugins.map((plugin) => [plugin.name, plugin.source.package, plugin.source.version]),
    marketplace.plugins.map((plugin) => [plugin.name, plugin.source.package, 'preview']),
  );
});


test('installer plugin initializes remote saves through Engine MCP', () => {
  assert.equal(installerManifest.name, 'anify-installer');
  assert.equal(installerManifest.interface.displayName, 'Anify Installer');
  assert.equal(installerManifest.skills, './skills/');
  assert.equal(installerManifest.mcpServers, './.mcp.json');
  assert.equal(installerMcp.mcpServers.anify.type, 'http');
  assert.equal(installerMcp.mcpServers.anify.url, configuredMcpUrl);

  const installerSkill = text('plugins/anify-installer/skills/anify-installer/SKILL.md');
  assert.match(installerSkill, /anify_prompt_get/);
  assert.match(installerSkill, /"installer"/);
  assert.doesNotMatch(JSON.stringify(installerManifest), /local Anify|local GM|local save|memory runtime/i);
  assert.match(installerManifest.interface.longDescription, /shared remote Anify save/);

  for (const size of [192, 512]) {
    const icon = bytes(`plugins/anify-installer/assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
  }
});


test('GM plugin identity and assets match Anify-GM branding', () => {
  assert.equal(gmManifest.name, 'anify-gm');
  assert.equal(gmManifest.interface.displayName, 'Anify-GM');
  assert.equal(gmManifest.interface.shortDescription, 'Play Engine-backed Anify on Web or directly in Codex.');
  assert.match(gmManifest.interface.longDescription, /directly installed Codex plugin/);
  assert.match(gmManifest.interface.longDescription, /same Web wire-format output/);
  assert.match(gmManifest.interface.longDescription, /graph-based locations, adjacent adventures, returns, shops/);
  assert.deepEqual(gmManifest.interface.defaultPrompt, [
    '登录 Anify-GM 并从远程存档继续我的冒险。',
    '和 Lynn 与 Lyra 一起开始一段新的 Anify 冒险。',
    '查看我的角色属性、装备、背包、任务和地图。',
  ]);
  assert.equal(gmManifest.interface.composerIcon, './assets/icon-192x192.png');
  assert.equal(gmManifest.interface.logo, './assets/icon-512x512.png');

  for (const size of [192, 512]) {
    const icon = bytes(`assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
  }
});


test('all plugins share the Anify Engine MCP config', () => {
  assert.equal(gmMcp.mcpServers.anify.type, 'http');
  assert.equal(gmMcp.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(gmMcp.mcpServers.anify.bearer_token_env_var, undefined);
  assert.deepEqual(gmMcp.mcpServers.anify.env_http_headers, {
    'x-anify-operation-id': 'ANIFY_OPERATION_ID',
  });
  assert.match(gmMcp.mcpServers.anify.note, /remote saves/);
  assert.deepEqual(installerMcp.mcpServers.anify.env_http_headers, gmMcp.mcpServers.anify.env_http_headers);
  for (const [slug] of roles) {
    assert.deepEqual(roleMcp(slug), gmMcp);
  }
});


test('role plugins expose persona skills and shared remote character workflow', () => {
  const sharedSkill = text('shared/anify-character/skills/anify-character-chat/SKILL.md');
  assert.match(sharedSkill, /anify_prompt_get/);
  assert.match(sharedSkill, /"character.chat"/);

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
    }

    const persona = text(`${roleRoot(slug)}/skills/anify-${slug}-persona/SKILL.md`);
    assert.match(persona, new RegExp(`persona.${slug}`));
    assert.match(persona, new RegExp(fullName));
    assert.doesNotMatch(persona, /CODEX_HOME\/anify\/users/);

    const localWorkflow = text(`${roleRoot(slug)}/skills/anify-character-chat/SKILL.md`);
    assert.equal(localWorkflow, sharedSkill);
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'shared')), false);
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'hooks', 'hooks.json')), false);
  }
});


test('every workflow and reference loads current Engine instructions rather than vendored rules', () => {
  for (const content of [gmSkill,
    text('skills/anify-adventure-image/SKILL.md'), text('skills/anify-adventure-video/SKILL.md')]) {
    assert.match(content, /For each applicable Anify player request/);
    assert.match(content, /including resumed conversations/);
    assert.match(content, /anify_prompt_get/);
    assert.match(content, /Do not use a cached earlier version/);
    assert.match(content, /If the read fails, report the failure and stop/);
    assert.ok(content.length < 1500);
  }
});
