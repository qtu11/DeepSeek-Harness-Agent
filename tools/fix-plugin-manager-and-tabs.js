#!/usr/bin/env node
/**
 * fix-plugin-manager-and-tabs.js
 *
 * 1. Installs dsh.cmd to ~/.dsh/bin, %LOCALAPPDATA%/Programs/dsh, and tools/bin
 * 2. Patches findDshBinary and dshSpawnCommand in @linxin666/dsh-client-ui-plugin-manager
 * 3. Localizes all Settings section navigation labels to pure Vietnamese
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import vm from 'node:vm'

const CLI_BIN = resolve(process.cwd(), 'apps', 'cli', 'lib', 'bin.js')
const DSH_CMD_CONTENT = `@echo off\r\nnode "${CLI_BIN}" %*\r\n`
const DSH_SH_CONTENT = `#!/bin/sh\nnode "${CLI_BIN.replace(/\\/g, '/')}" "$@"\n`

// 1. Install dsh.cmd in multiple standard PATH locations
const paths = [
  join(homedir(), '.dsh', 'bin'),
  join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'dsh'),
  join(process.cwd(), 'tools', 'bin')
]

for (const dir of paths) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'dsh.cmd'), DSH_CMD_CONTENT, 'utf8')
  writeFileSync(join(dir, 'dsh'), DSH_SH_CONTENT, 'utf8')
  console.log(`✓ Installed dsh CLI wrapper to: ${dir}`)
}

// 2. Patch plugin manager backend (findDshBinary & dshSpawnCommand)
const pluginMgrIndexPath = join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', '@linxin666', 'dsh-client-ui-plugin-manager', 'lib', 'index.js')
if (existsSync(pluginMgrIndexPath)) {
  let code = readFileSync(pluginMgrIndexPath, 'utf8')

  // Patch findDshBinary candidates
  const dshBinPath = join(homedir(), '.dsh', 'bin', 'dsh.cmd').replace(/\\/g, '\\\\')
  const localAppDshPath = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'dsh', 'dsh.cmd').replace(/\\/g, '\\\\')

  code = code.replace(
    'for (const candidate of candidates) if (exists(candidate)) return candidate;',
    `candidates.unshift("${dshBinPath}", "${localAppDshPath}");\n\tfor (const candidate of candidates) if (exists(candidate)) return candidate;`
  )

  // Patch dshSpawnCommand binJsCandidates
  const escapedCliBin = CLI_BIN.replace(/\\/g, '\\\\')
  code = code.replace(
    'const binJsCandidates = [',
    `const binJsCandidates = ["${escapedCliBin}", `
  )

  writeFileSync(pluginMgrIndexPath, code, 'utf8')
  console.log('✓ Patched findDshBinary and dshSpawnCommand in @linxin666/dsh-client-ui-plugin-manager/lib/index.js')
}

// 3. Localize Settings Tab labels in plugins
const PROFILE_DIR = join(homedir(), '.dsh', 'profiles', 'web', 'node_modules')

// 3a. dsh-pocket: "手机访问" -> "Truy cập di động"
const pocketClientPath = join(PROFILE_DIR, 'dsh-pocket', 'client', 'client.js')
if (existsSync(pocketClientPath)) {
  let code = readFileSync(pocketClientPath, 'utf8')
  code = code.replace(
    'label: () => "\\u624B\\u673A\\u8BBF\\u95EE"',
    'label: () => "Truy cập di động"'
  )
  code = code.replace(
    'label: () => "手机访问"',
    'label: () => "Truy cập di động"'
  )
  writeFileSync(pocketClientPath, code, 'utf8')
  console.log('✓ Localized dsh-pocket tab label to "Truy cập di động"')
}

// 3b. Web UI Settings tab: "Web UI Plugins" / "网页插件" -> "Plugin Giao diện Web"
const webUiSettingsClientPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-web-ui-settings', 'lib', 'client.js')
if (existsSync(webUiSettingsClientPath)) {
  let code = readFileSync(webUiSettingsClientPath, 'utf8')
  code = code.replace(/title:\s*"[^"]*"/g, 'title: "Plugin Giao diện Web"')
  code = code.replace(/"title":\s*"[^"]*"/g, '"title": "Plugin Giao diện Web"')
  code = code.replace(/description:\s*"[^"]*"/g, 'description: "Quản lý và cấu hình các plugin giao diện Web"')
  writeFileSync(webUiSettingsClientPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-web-ui-settings to "Plugin Giao diện Web"')
}

// 3c. Community Plugins tab: "Community Plugins" / "社区插件" -> "Plugin cộng đồng"
const commPluginsClientPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-community-plugins', 'lib', 'client.js')
if (existsSync(commPluginsClientPath)) {
  let code = readFileSync(commPluginsClientPath, 'utf8')
  code = code.replace(/"settings\.title":\s*"[^"]*"/g, '"settings.title": "Plugin cộng đồng"')
  code = code.replace(/"settings\.hint":\s*"[^"]*"/g, '"settings.hint": "Khám phá và cài đặt các plugin cộng đồng DSH"')
  code = code.replace(/"install":\s*"[^"]*"/g, '"install": "Cài đặt"')
  code = code.replace(/"uninstall":\s*"[^"]*"/g, '"uninstall": "Gỡ cài đặt"')
  code = code.replace(/"installing":\s*"[^"]*"/g, '"installing": "Đang cài đặt…"')
  code = code.replace(/"installed":\s*"[^"]*"/g, '"installed": "Đã cài đặt"')
  code = code.replace(/"copyCommand":\s*"[^"]*"/g, '"copyCommand": "Sao chép lệnh cài đặt"')
  code = code.replace(/"copyCommandCopied":\s*"[^"]*"/g, '"copyCommandCopied": "Đã sao chép"')
  code = code.replace(/"filter\.all":\s*"[^"]*"/g, '"filter.all": "Tất cả"')
  code = code.replace(/"search\.placeholder":\s*"[^"]*"/g, '"search.placeholder": "Tìm kiếm plugin cộng đồng…"')
  writeFileSync(commPluginsClientPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-community-plugins to "Plugin cộng đồng"')
}

// 3d. Plugin Manager tab: "Plugin manager" / "Plugin Market" -> "Chợ Plugin"
const pluginMgrClientPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-plugin-manager', 'lib', 'client.js')
if (existsSync(pluginMgrClientPath)) {
  let code = readFileSync(pluginMgrClientPath, 'utf8')
  code = code.replace(/tab:\s*"[^"]*"/g, 'tab: "Chợ Plugin"')
  code = code.replace(/"tab":\s*"[^"]*"/g, '"tab": "Chợ Plugin"')
  code = code.replace(/"userPlugins":\s*"[^"]*"/g, '"userPlugins": "Plugin người dùng"')
  code = code.replace(/"products":\s*"[^"]*"/g, '"products": "Sản phẩm tích hợp"')
  code = code.replace(/"loading":\s*"[^"]*"/g, '"loading": "Đang đọc danh sách plugin…"')
  code = code.replace(/"empty":\s*"[^"]*"/g, '"empty": "Chưa có plugin người dùng nào được cài đặt."')
  writeFileSync(pluginMgrClientPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-plugin-manager to "Chợ Plugin"')
}

// 3e. Skin Center tab: "Skin Center" -> "Trung tâm giao diện"
const skinCenterClientPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-skin-center', 'lib', 'client.js')
if (existsSync(skinCenterClientPath)) {
  let code = readFileSync(skinCenterClientPath, 'utf8')
  code = code.replace(/"title":\s*"[^"]*"/g, '"title": "Trung tâm giao diện"')
  writeFileSync(skinCenterClientPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-skin-center to "Trung tâm giao diện"')
}

// 3f. Pet tab: "Pet" -> "Thú cưng đồng hành"
const petClientPath = join(PROFILE_DIR, '@linxin666', 'dsh-pet', 'lib', 'client.js')
if (existsSync(petClientPath)) {
  let code = readFileSync(petClientPath, 'utf8')
  code = code.replace(/"settings\.title":\s*"[^"]*"/g, '"settings.title": "Thú cưng đồng hành"')
  writeFileSync(petClientPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-pet to "Thú cưng đồng hành"')
}

// Validate syntax of all updated files
const allFilesToVerify = [
  pluginMgrIndexPath,
  pocketClientPath,
  webUiSettingsClientPath,
  commPluginsClientPath,
  pluginMgrClientPath,
  skinCenterClientPath,
  petClientPath
]

for (const fp of allFilesToVerify) {
  if (!existsSync(fp)) continue
  const code = readFileSync(fp, 'utf8')
  try {
    new vm.Script(code)
    console.log(`[VALID SYNTAX] ${fp}`)
  } catch (e) {
    console.error(`[SYNTAX ERROR] ${fp}: ${e.message}`)
  }
}

console.log('\nAll plugin manager and tab fixes applied successfully!')
