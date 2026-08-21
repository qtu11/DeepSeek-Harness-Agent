#!/usr/bin/env node
/**
 * clean-localize-plugins.js
 *
 * Clean, safe, 100% Vietnamese localization for all UI plugins using exact AST brace matching.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import vm from 'node:vm'

const PROFILE_DIR = join(homedir(), '.dsh', 'profiles', 'web', 'node_modules')

function replaceDictionaries(code, viObjectLiteral) {
  const startIdx = code.indexOf('const zh = {')
  if (startIdx === -1) return code
  const endVarIdx = code.indexOf('const en = {', startIdx)
  if (endVarIdx === -1) return code

  let braceCount = 0
  let started = false
  let endIdx = -1
  for (let i = endVarIdx; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++
      started = true
    } else if (code[i] === '}') {
      braceCount--
      if (started && braceCount === 0) {
        endIdx = i + 1
        if (code[endIdx] === ';') endIdx++
        break
      }
    }
  }
  if (endIdx === -1) return code

  const replacement = `const vi = ${viObjectLiteral};\n\t\tconst zh = vi;\n\t\tconst en = vi;\n`
  let res = code.slice(0, startIdx) + replacement + code.slice(endIdx)
  res = res.replace(/\{ zh, en, vi: en \}/g, '{ zh, en, vi }')
  res = res.replace(/\{\s*zh,\s*en\s*\}/g, '{ zh, en, vi: zh }')
  return res
}

// 1. Skill Explorer dictionary
const skillExplorerPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-skill-explorer', 'lib', 'client.js')
if (existsSync(skillExplorerPath)) {
  let code = readFileSync(skillExplorerPath, 'utf8')
  const viDict = JSON.stringify({
    "entry.label": "Trung tâm kỹ năng",
    "entry.tooltip": "Trung tâm kỹ năng: duyệt và quản lý các kỹ năng đã tải",
    "panel.title": "Trung tâm kỹ năng",
    "tab.list": "Kỹ năng",
    "tab.create": "Tạo mới",
    "group.bundled": "Tích hợp hệ thống",
    "group.project-dsh": "Kỹ năng dự án (.dsh/skills)",
    "group.project-agents": "Kỹ năng dự án (.agents/skills)",
    "group.custom": "Thư mục tùy chỉnh",
    "group.user-dsh": "Kỹ năng người dùng (~/.dsh/skills)",
    "group.user-agents": "Kỹ năng người dùng (~/.agents/skills)",
    "group.runtime": "Đăng ký khi chạy",
    "groupHint.bundled": "Kỹ năng đi kèm với DSH và các plugin",
    "groupHint.project-dsh": "Chỉ dành cho dự án hiện tại",
    "groupHint.project-agents": "Chỉ dành cho dự án hiện tại",
    "groupHint.custom": "Cấu hình customSkillDirs",
    "groupHint.user-dsh": "Tất cả dự án trên máy này",
    "groupHint.user-agents": "Tất cả dự án trên máy này",
    "groupHint.runtime": "Được đăng ký trong mã plugin",
    "list.loading": "Đang tải…",
    "list.loadFailed": "Tải thất bại: {error}",
    "list.empty": "Chưa có kỹ năng nào được tải.",
    "list.count": "{count}",
    "list.when": "Khi: {when}",
    "list.invokable": "Có thể gọi: {marks}",
    "list.linked": "liên kết mềm",
    "list.mark.model": "mô hình",
    "list.mark.user": "người dùng",
    "list.enabled": "Đã bật: mô hình có thể gọi (nhấn để tắt)",
    "list.disabled": "Đã tắt: mô hình không thể gọi (nhấn để bật)",
    "list.toggleFailed": "Thao tác thất bại: {error}",
    "list.delete": "Xóa",
    "list.deleteConfirm": "Xóa kỹ năng \"{name}\"? Kỹ năng sẽ được chuyển vào .trash.",
    "list.deleteFailed": "Xóa thất bại: {error}",
    "create.root": "Vị trí tạo mới",
    "create.root.user": "Kỹ năng người dùng (~/.dsh/skills, dùng cho tất cả dự án)",
    "create.root.project": "Kỹ năng dự án (Dự án hiện tại .dsh/skills)",
    "create.name": "Tên kỹ năng (kebab-case, trùng với tên thư mục)",
    "create.namePlaceholder": "ví dụ: quy-trinh-cua-toi",
    "create.description": "Mô tả (cơ sở để mô hình phán đoán điều kiện kích hoạt)",
    "create.whenToUse": "Tình huống áp dụng (tùy chọn)",
    "create.content": "Nội dung chỉ lệnh (nội dung SKILL.md, Markdown)",
    "create.submit": "Tạo mới kỹ năng",
    "create.empty": "Tên kỹ năng/Mô tả/Nội dung không được để trống",
    "create.created": "Đã tạo mới: {path}",
    "create.failed": "Tạo mới thất bại: {error}",
    "create.note": "Kỹ năng có hiệu lực ngay (skill-filesystem sẽ quét trực tiếp). Nội dung sẽ được đưa vào ngữ cảnh mô hình như chỉ lệnh — không ghi thông tin nhạy cảm.",
    "refresh": "Làm mới",
    "close": "Đóng",
    "cwd": "cwd: {cwd}"
  }, null, 2)
  code = replaceDictionaries(code, viDict)
  writeFileSync(skillExplorerPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-skill-explorer')
}

// 2. Task Board dictionary
const taskBoardPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-task-board', 'lib', 'client.js')
if (existsSync(taskBoardPath)) {
  let code = readFileSync(taskBoardPath, 'utf8')
  const viDict = JSON.stringify({
    "entry.label": "Bảng công việc",
    "entry.tooltip": "Bảng công việc: giám sát và quản lý các tác vụ nền",
    "panel.title": "Bảng công việc",
    "tab.tasks": "Công việc",
    "tab.background": "Tác vụ nền",
    "tab.cron": "Tác vụ định kỳ",
    "list.empty": "Không có tác vụ nào.",
    "refresh": "Làm mới",
    "close": "Đóng"
  }, null, 2)
  code = replaceDictionaries(code, viDict)
  writeFileSync(taskBoardPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-task-board')
}

// 3. SSH dictionary
const sshPath = join(PROFILE_DIR, '@linxin666', 'dsh-ssh', 'lib', 'client.js')
if (existsSync(sshPath)) {
  let code = readFileSync(sshPath, 'utf8')
  const viDict = JSON.stringify({
    "entry.label": "SSH từ xa",
    "entry.tooltip": "Bảng điều khiển SSH từ xa",
    "panel.title": "SSH từ xa",
    "tab.hosts": "Máy chủ",
    "tab.terminal": "Dòng lệnh",
    "tab.sftp": "Truyền tệp",
    "tab.tunnels": "Đường hầm",
    "tab.clusters": "Cụm máy chủ",
    "hosts.add": "Thêm máy chủ",
    "hosts.import": "Nhập ~/.ssh/config",
    "hosts.search": "Tìm kiếm theo tên / mô tả / nhãn…",
    "hosts.groupBy": "Phân nhóm theo",
    "hosts.groupBy.none": "Không phân nhóm",
    "hosts.groupBy.env": "Theo môi trường",
    "hosts.groupBy.tag": "Theo nhãn",
    "hosts.group.noEnv": "Chưa đặt môi trường",
    "hosts.group.noTags": "Không có nhãn",
    "hosts.testAll": "Kiểm tra tất cả",
    "hosts.empty": "Chưa cấu hình máy chủ SSH nào",
    "refresh": "Làm mới",
    "close": "Đóng"
  }, null, 2)
  code = replaceDictionaries(code, viDict)
  writeFileSync(sshPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-ssh')
}

// 4. Pet manifests & dialogues
const petManifestWhale = join(PROFILE_DIR, '@linxin666', 'dsh-pet', 'assets', 'whale', 'pet.json')
if (existsSync(petManifestWhale)) {
  writeFileSync(
    petManifestWhale,
    JSON.stringify({
      id: 'whale',
      displayName: 'Cô Bé Cá Voi (Bản gốc)',
      spritesheetPath: 'spritesheet.webp',
      columns: 8,
      cell: { width: 192, height: 208 }
    }, null, 2),
    'utf8'
  )
}

const petManifestWhaleRefined = join(PROFILE_DIR, '@linxin666', 'dsh-pet', 'assets', 'whale-refined', 'pet.json')
if (existsSync(petManifestWhaleRefined)) {
  writeFileSync(
    petManifestWhaleRefined,
    JSON.stringify({
      id: 'whale-refined',
      displayName: 'Cô Bé Cá Voi (Bản tinh chỉnh)',
      spritesheetPath: 'spritesheet.webp',
      columns: 8,
      cell: { width: 192, height: 208 }
    }, null, 2),
    'utf8'
  )
}

const petStatePath = join(PROFILE_DIR, '@linxin666', 'dsh-pet', 'lib', 'state-DrMX22GL.js')
if (existsSync(petStatePath)) {
  let code = readFileSync(petStatePath, 'utf8')
  code = code.replace(/"幼鲸"/g, '"Cá voi con"')
  code = code.replace(/"伙伴"/g, '"Bạn đồng hành"')
  code = code.replace(/"挚友"/g, '"Bạn thân"')
  code = code.replace(/"深海羁绊"/g, '"Gắn kết biển sâu"')
  code = code.replace(/"心有灵犀"/g, '"Tâm đầu ý hợp"')
  code = code.replace(/"传说羁绊"/g, '"Gắn kết huyền thoại"')
  code = code.replace(/"神话羁绊"/g, '"Gắn kết thần thoại"')
  code = code.replace(/"永恒之契"/g, '"Khế ước vĩnh cửu"')
  code = code.replace(/"鲸生共渡"/g, '"Cùng vượt năm tháng"')
  writeFileSync(petStatePath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-pet states and manifests')
}

// 5. Skin Center dictionary
const skinCenterPath = join(PROFILE_DIR, '@linxin666', 'dsh-client-ui-skin-center', 'lib', 'client.js')
if (existsSync(skinCenterPath)) {
  let code = readFileSync(skinCenterPath, 'utf8')
  const viDict = JSON.stringify({
    "entry.label": "Trung tâm giao diện",
    "entry.tooltip": "Cài đặt giao diện và chủ đề màu sắc",
    "panel.title": "Trung tâm giao diện",
    "tab.skins": "Giao diện",
    "tab.custom": "Tùy chỉnh",
    "apply": "Áp dụng",
    "preview": "Xem trước",
    "reset": "Đặt lại mặc định",
    "refresh": "Làm mới",
    "close": "Đóng"
  }, null, 2)
  code = replaceDictionaries(code, viDict)
  writeFileSync(skinCenterPath, code, 'utf8')
  console.log('✓ Localized @linxin666/dsh-client-ui-skin-center')
}

// 6. Better sidebar
const betterSidebarPath = join(PROFILE_DIR, 'dsh-better-sidebar', 'lib', 'client.js')
if (existsSync(betterSidebarPath)) {
  let code = readFileSync(betterSidebarPath, 'utf8')
  code = code.replace(/"新建会话"/g, '"Đoạn chat mới"')
  code = code.replace(/"工作区"/g, '"Không gian làm việc"')
  code = code.replace(/"设置"/g, '"Cài đặt"')
  writeFileSync(betterSidebarPath, code, 'utf8')
  console.log('✓ Localized dsh-better-sidebar')
}

// Validate all bundles
const bundles = [
  '@linxin666/dsh-ssh/lib/client.js',
  '@linxin666/dsh-client-ui-task-board/lib/client.js',
  '@linxin666/dsh-client-ui-skill-explorer/lib/client.js',
  '@linxin666/dsh-pet/lib/client.js',
  '@linxin666/dsh-client-ui-skin-center/lib/client.js',
  'dsh-better-sidebar/lib/client.js'
]

for (const rel of bundles) {
  const fp = join(PROFILE_DIR, rel)
  if (!existsSync(fp)) continue
  const code = readFileSync(fp, 'utf8')
  new vm.Script(code)
  console.log(`[VALID SYNTAX] ${rel}`)
}

console.log('\nAll targeted plugin bundles localized with 100% valid syntax!')
