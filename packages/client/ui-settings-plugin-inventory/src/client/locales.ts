/** Copy dictionaries for the plugin inventory Settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '插件列表',
  loading: '正在读取插件…',
  error: '暂时无法读取插件。',
  retry: '重试',
  search: '搜索插件',
  catalog: '插件列表',
  empty: '暂无插件。',
  emptySearch: '没有匹配的插件。',
  enabledTag: '已启用',
  disabledTag: '已停用',
  configuration: '配置状态',
  cordis: 'Cordis 状态',
  unobserved: '未挂载',
  pending: '等待依赖',
  loadingPhase: '加载中',
  active: '已挂载',
  failed: '挂载失败',
  unloading: '卸载中',
} satisfies Record<string, string>

/** Plugin inventory locale key union. */
export type PluginInventoryLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Plugin list',
  loading: 'Reading plugins…',
  error: 'Plugins are temporarily unavailable.',
  retry: 'Retry',
  search: 'Search plugins',
  catalog: 'Plugin list',
  empty: 'No plugins are available.',
  emptySearch: 'No matching plugins.',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  configuration: 'Configuration',
  cordis: 'Cordis status',
  unobserved: 'Not mounted',
  pending: 'Waiting for dependencies',
  loadingPhase: 'Loading',
  active: 'Mounted',
  failed: 'Mount failed',
  unloading: 'Unloading',
} satisfies Record<PluginInventoryLocaleKey, string>

/** Vietnamese dictionary checked against the Chinese key set. */
export const vi = {
  tab: 'Danh sách plugin',
  loading: 'Đang đọc danh sách plugin…',
  error: 'Tạm thời không thể đọc danh sách plugin.',
  retry: 'Thử lại',
  search: 'Tìm kiếm plugin',
  catalog: 'Danh sách plugin',
  empty: 'Chưa có plugin nào.',
  emptySearch: 'Không tìm thấy plugin phù hợp.',
  enabledTag: 'Đã bật',
  disabledTag: 'Đã tắt',
  configuration: 'Trạng thái cấu hình',
  cordis: 'Trạng thái Cordis',
  unobserved: 'Chưa gắn (unmounted)',
  pending: 'Chờ phụ thuộc',
  loadingPhase: 'Đang tải',
  active: 'Đã gắn (mounted)',
  failed: 'Gắn thất bại',
  unloading: 'Đang gỡ bỏ',
} satisfies Record<PluginInventoryLocaleKey, string>

