import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webRoot = join(repoRoot, '..', 'anify-web');
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
const webOutput = text('skills/anify-gm-adventure/references/web-output-contract.md');
const webCharacterParser = readFileSync(join(webRoot, 'src/lib/parseChatSegments.ts'), 'utf8');
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
  assert.match(installerSkill, /anify_begin_operation/);
  assert.match(installerSkill, /anify_save_initialize/);
  assert.match(installerSkill, /x-anify-operation-id/);
  assert.match(installerSkill, /required top-level `operation_id` argument/);
  assert.match(installerSkill, /header takes precedence inside Engine, but the argument is still mandatory/);
  assert.doesNotMatch(installerSkill, /cleanup-local-state/);
  assert.doesNotMatch(installerSkill, /install-runtime|mem0|local GM Markdown save/i);

  for (const size of [192, 512]) {
    const icon = bytes(`plugins/anify-installer/assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, webIcon(`icon-${size}x${size}.png`));
  }
});

test('GM plugin identity and assets match Anify-GM branding', () => {
  assert.equal(gmManifest.name, 'anify-gm');
  assert.equal(gmManifest.interface.displayName, 'Anify-GM');
  assert.equal(gmManifest.interface.shortDescription, 'Run Anify adventures with Engine-backed remote GM saves.');
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
    'anify_begin_operation',
    'anify_pending_turn_get',
    'anify_save_get',
    'anify_start_adventure',
    'anify_get_context',
    'roll_check',
    'anify_resolve_action',
    'anify_apply_gm_resolution',
    'anify_game_action',
  ]) {
    assert.match(gmSkill, new RegExp(tool));
  }
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.doesNotMatch(source, /anify_save_update|saveUpdateArguments/);
  }
  assert.match(gmSkill, /save\.game/);
  assert.match(gmSkill, /save\.adventure/);
  assert.match(gmSkill, /Never patch `save\.game` directly/);
  assert.match(gmSkill, /use the world-declared default `lynn_tale` and `lyra_oravia`/);
  assert.match(gmSkill, /session_intent: "new"/);
  assert.match(gmSkill, /session_intent: "resume"/);
  assert.match(gmSkill, /new host-provided logical GM thread ID/);
  assert.match(gmSkill, /exact `resolution_packet`/);
  assert.match(gmSkill, /Do not resubmit `turn_entry`/);
  assert.match(gmSkill, /Never follow it with `anify_game_action battle\.start`/);
  assert.match(gmSkill, /matching `save\.game\.battleState` and `battle\.await_action` checkpoint/);
  assert.match(gmSkill, /x-anify-operation-id/);
  assert.match(gmSkill, /Every mutating tool argument[\s\S]*must include the same top-level `operation_id`/);
  assert.match(gmSkill, /header takes precedence inside Engine, but the `operation_id` tool argument is still mandatory/);
  assert.match(gmSkill, /pending `check`[\s\S]*exact returned `action`[\s\S]*full `check_result`/);
  assert.match(gmSkill, /pending `resolution`[\s\S]*exact returned `resolution_packet`/);
  assert.match(gmSkill, /Do not reroll, resolve again, discard the packet/);
  assert.match(orchestration, /canonical gameplay state shared by Codex and Web/i);
  assert.match(orchestration, /same successful `anify_apply_gm_resolution` response already contains the matching active battle state/);
  assert.doesNotMatch(orchestration, /successfully runs `battle\.start/);
  assert.match(memory, /Never recreate those mutations as a plugin-authored patch/);
  assert.match(d20, /rejects every missing, changed, or fabricated field/);
  assert.match(d20, /original check, packet, or committed apply result/);
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.match(source, /anify_begin_operation/);
    assert.match(source, /anify_pending_turn_get/);
    assert.match(source, /operation_id/);
  }
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.doesNotMatch(source, /CODEX_HOME\/anify\/users|users\/[^/]+\/GM|save\.md|gm-memory\.md|party-memory\.md|turn-log\.md/);
    assert.doesNotMatch(source, /local Markdown|local GM|Markdown save/i);
    assert.match(source, /remote|Engine MCP|anify_/i);
  }
  assert.match(gmSkill, /anify_save_initialize/);
  assert.doesNotMatch(gmSkill, /run Anify Installer/);
});

test('GM commits the one-time opening before exposing it to Web', () => {
  assert.match(gmSkill, /save\.adventure\.opening_pending/);
  assert.match(gmSkill, /call `anify_apply_gm_resolution` directly/);
  assert.match(gmSkill, /Do not roll a D20 and do not call `anify_resolve_action`/);
  assert.match(gmSkill, /successful commit is what clears `opening_pending`/);
  assert.match(orchestration, /Never output an opening while `opening_pending` remains uncommitted/);
  assert.match(d20, /one-time opening is not a check/);
  assert.match(gmSkill, /omit `resolution_packet`/);
});

test('GM commits battle creation atomically with one immutable resolution packet', () => {
  for (const source of [gmSkill, orchestration, memory, webOutput]) {
    assert.match(source, /battle/i);
    assert.match(source, /resolution/i);
    assert.doesNotMatch(source, /first call `anify_game_action` with `battle\.start/);
  }
  assert.match(gmSkill, /set `resolution\.battle`/);
  assert.match(gmSkill, /set `resolution\.choices` to `\[\]`/);
  assert.match(gmSkill, /battle creation, narrative, turn log, and memories are one Engine commit/);
  assert.match(webOutput, /Never call `anify_game_action battle\.start` afterward/);
});

test('GM effect markers only project effects already persisted by Engine', () => {
  assert.match(gmSkill, /preserve its `ruleDelta` unchanged/);
  assert.match(gmSkill, /`resolution\.items`/);
  assert.match(gmSkill, /`resolution\.questOffers`/);
  assert.match(gmSkill, /`resolution\.flags`/);
  assert.match(gmSkill, /never auto-accept it/);
  assert.match(orchestration, /A marker without the matching committed effect is forbidden/);
  assert.match(webOutput, /Never emit an effect marker only for display/);
  assert.match(webOutput, /`STATUS_UPDATE` projects a numerical change from the preserved Engine `ruleDelta`/);
});

test('GM output contract is parsed by the Web line marker parser', async () => {
  assert.match(gmSkill, /references\/web-output-contract\.md/);
  assert.match(gmSkill, /Do not print numbered or bulleted options/);
  assert.match(gmSkill, /exactly one line-level `CHOICES` marker/);
  assert.doesNotMatch(gmSkill, /Exactly three numbered options|A line saying custom actions are allowed/);

  const markerPayloads = [
    ['CHOICES', ['Investigate', 'Advance', 'Wait']],
    ['BATTLE', { enemyId: 'corrupted-forest-wolf' }],
    ['ADVENTURE_END', { outcome: 'success', flagsSet: ['forest-cleared'] }],
    ['QUEST_OFFER', { id: 'quest-id', name: 'Quest', description: 'Description', completionConditions: [] }],
    ['QUEST_UPDATE', { questId: 'quest-id', title: 'Updated title' }],
    ['ITEM_GIVE', { itemId: 'item-id', quantity: 1 }],
    ['FLAG_SET', { key: 'flag-id', value: true }],
    ['SYSTEM_MESSAGE', { tier: 'success_with_cost', title: 'Check', description: 'Result' }],
    ['STATUS_UPDATE', { hp: -5 }],
  ];
  for (const [marker] of markerPayloads) {
    assert.match(webOutput, new RegExp(`\\[${marker}:`));
  }

  const { parseCodexOutput } = await import('../../anify-web/src/lib/codex-shell/output.ts');
  const parsed = parseCodexOutput([
    'Visible narration.',
    ...markerPayloads.map(([type, payload]) => `[${type}: ${JSON.stringify(payload)}]`),
  ].join('\n'));
  assert.equal(parsed.text, 'Visible narration.');
  assert.deepEqual(
    parsed.markers,
    markerPayloads.map(([type, payload]) => ({ type, payload })),
  );

  assert.match(webOutput, /\[CHOICES: \["Option 1","Option 2","Option 3"\]\]/);
  assert.match(webOutput, /`CHOICES` must be the final non-empty line/);
  assert.match(webOutput, /payload must be a JSON string array with exactly three items/);
  assert.match(webOutput, /Do not duplicate those choices in visible prose/);
  assert.match(webOutput, /end with `BATTLE` instead of `CHOICES`/);
  assert.match(webOutput, /\[BATTLE: \{"enemyId":"corrupted-forest-wolf"\}\]/);
  assert.match(webOutput, /end with `ADVENTURE_END` instead of `CHOICES`/);
  assert.match(webOutput, /Never print `NO_REPLY`/);
  assert.match(orchestration, /Never print `NO_REPLY`/);
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
  assert.ok(webCharacterParser.includes('const ACTION_PATTERN = /\\[([^\\]]+)\\]/g;'));
  assert.match(sharedSkill, /anify_memory_search/);
  assert.match(sharedSkill, /anify_memory_remember/);
  assert.match(sharedSkill, /anify_begin_operation/);
  assert.match(sharedSkill, /x-anify-operation-id/);
  assert.match(sharedSkill, /required top-level `operation_id` argument/);
  assert.match(sharedSkill, /header takes precedence inside Engine, but the argument remains mandatory/);
  assert.match(sharedSkill, /ASCII square brackets/);
  assert.match(sharedSkill, /spoken dialogue outside the brackets/);
  assert.match(sharedSkill, /In private chat, do not prefix the reply with the character name/);
  assert.match(sharedSkill, /Do not emit GM markers/);
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
