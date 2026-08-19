/** `settings.permission` namespace dictionaries (the Permission row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '权限',
  'description': '选择新会话的默认权限模式',
  'loading': '加载中',
  'unavailable': '不可用',
  'confirm.title': '确认启用 Full access？',
  'confirm.description': '启用 Full access 后，新会话将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任后续任务时使用。',
  'confirm.acknowledge': '我已了解风险，并愿意继续',
  'confirm.cancel': '取消',
  'confirm.enable': '启用 Full access',
} satisfies Record<string, string>

/** The settings.permission namespace key union. */
export type PermissionSettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Permission',
  'description': 'Choose the default permission mode for new sessions',
  'loading': 'Loading',
  'unavailable': 'Unavailable',
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access lets new sessions reduce confirmation steps and perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust subsequent tasks.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
} satisfies Record<PermissionSettingsKey, string>

/** Vietnamese dictionary, checked complete against the zh key set. */
export const vi = {
  'title': 'Quyền hạn',
  'description': 'Chọn chế độ quyền mặc định cho các đoạn chat mới',
  'loading': 'Đang tải',
  'unavailable': 'Không khả dụng',
  'confirm.title': 'Bật quyền Full access?',
  'confirm.description': 'Bật Full access giúp các đoạn chat mới giảm bớt bước xác nhận và có thể thực thi trực tiếp nhiều thao tác hơn, bao gồm thao tác nhạy cảm, thay đổi file hoặc lệnh ngoài. Chỉ nên dùng khi bạn tin tưởng các tác vụ tiếp theo.',
  'confirm.acknowledge': 'Tôi hiểu rõ rủi ro và muốn tiếp tục',
  'confirm.cancel': 'Hủy',
  'confirm.enable': 'Bật Full access',
} satisfies Record<PermissionSettingsKey, string>

/** Simplified Chinese dictionary for the current-session popup gate. */
export const accessZh = {
  'confirm.title': '确认启用 Full access？',
  'confirm.description': '启用 Full access 后，agent 将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。',
  'confirm.acknowledge': '我已了解风险，并愿意继续',
  'confirm.cancel': '取消',
  'confirm.enable': '启用 Full access',
} satisfies Record<string, string>

/** Current-session popup-gate key union. */
export type PermissionAccessKey = keyof typeof accessZh

/** English dictionary for the current-session popup gate. */
export const accessEn = {
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
} satisfies Record<PermissionAccessKey, string>

/** Vietnamese dictionary for the current-session popup gate. */
export const accessVi = {
  'confirm.title': 'Bật quyền Full access?',
  'confirm.description': 'Bật Full access giúp agent giảm thiểu các bước xác nhận và có thể thực thi trực tiếp nhiều thao tác hơn, bao gồm thao tác nhạy cảm, thay đổi file hoặc lệnh ngoài. Chỉ nên dùng khi bạn tin tưởng tác vụ hiện tại.',
  'confirm.acknowledge': 'Tôi hiểu rõ rủi ro và muốn tiếp tục',
  'confirm.cancel': 'Hủy',
  'confirm.enable': 'Bật Full access',
} satisfies Record<PermissionAccessKey, string>

