/** `command` namespace dictionaries (the popupSelect shell's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'search.placeholder': '搜索…',
  'search.aria': '筛选选项',
  'status.loading': '正在加载选项…',
  'status.applying': '正在应用…',
  'status.empty': '无选项',
  'overlay.aria': '/{command} 选项',
  'listbox.aria': '/{command} 匹配项',
} satisfies Record<string, string>

/** The command namespace key union. */
export type CommandKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'search.placeholder': 'Search…',
  'search.aria': 'Filter options',
  'status.loading': 'Loading options…',
  'status.applying': 'Applying…',
  'status.empty': 'No options',
  'overlay.aria': '/{command} options',
  'listbox.aria': '/{command} matches',
} satisfies Record<CommandKey, string>

/** Vietnamese dictionary, checked complete against the zh key set. */
export const vi = {
  'search.placeholder': 'Tìm kiếm…',
  'search.aria': 'Lọc tùy chọn',
  'status.loading': 'Đang tải tùy chọn…',
  'status.applying': 'Đang áp dụng…',
  'status.empty': 'Không có tùy chọn',
  'overlay.aria': 'Tùy chọn /{command}',
  'listbox.aria': 'Mục khớp /{command}',
} satisfies Record<CommandKey, string>

