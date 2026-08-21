/** `trajectory` namespace dictionaries (view tab label + toolbar strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'trajectory'

/** The trajectory dictionary key set (the source of truth for both locales). */
export type TrajectoryKey =
  | 'view.trajectory'
  | 'toolbar.aria'
  | 'toolbar.duration'
  | 'toolbar.useActualDuration'
  | 'toolbar.useEqualWidth'
  | 'toolbar.actualTime'
  | 'toolbar.turns'
  | 'toolbar.expandTurns'
  | 'toolbar.collapseTurns'
  | 'toolbar.calls'
  | 'toolbar.expandCalls'
  | 'toolbar.collapseCalls'
  | 'toolbar.search'
  | 'toolbar.searchPlaceholder'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The trajectory view tab label and toolbar strings. */
    'trajectory': TrajectoryKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<TrajectoryKey, string> = {
  'view.trajectory': '轨迹',
  'toolbar.aria': '轨迹工具栏',
  'toolbar.duration': '耗时',
  'toolbar.useActualDuration': '使用实际耗时',
  'toolbar.useEqualWidth': '使用等宽操作',
  'toolbar.actualTime': '实际时间',
  'toolbar.turns': '轮次',
  'toolbar.expandTurns': '展开轮次',
  'toolbar.collapseTurns': '收起轮次',
  'toolbar.calls': '调用',
  'toolbar.expandCalls': '展开调用',
  'toolbar.collapseCalls': '收起调用',
  'toolbar.search': '搜索轨迹',
  'toolbar.searchPlaceholder': '搜索',
}

/** English dictionary. */
export const en: Record<TrajectoryKey, string> = {
  'view.trajectory': 'Trajectory',
  'toolbar.aria': 'Trajectory toolbar',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': 'Actual time',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': 'Search trajectory',
  'toolbar.searchPlaceholder': 'Search',
}

/** Vietnamese dictionary. */
export const vi: Record<TrajectoryKey, string> = {
  'view.trajectory': 'Quỹ đạo',
  'toolbar.aria': 'Thanh công cụ quỹ đạo',
  'toolbar.duration': 'Thời lượng',
  'toolbar.useActualDuration': 'Dùng thời lượng thực tế',
  'toolbar.useEqualWidth': 'Dùng độ rộng bằng nhau',
  'toolbar.actualTime': 'Thời gian thực',
  'toolbar.turns': 'Lượt',
  'toolbar.expandTurns': 'Mở rộng lượt',
  'toolbar.collapseTurns': 'Thu gọn lượt',
  'toolbar.calls': 'Lượt gọi',
  'toolbar.expandCalls': 'Mở rộng lượt gọi',
  'toolbar.collapseCalls': 'Thu gọn lượt gọi',
  'toolbar.search': 'Tìm kiếm quỹ đạo',
  'toolbar.searchPlaceholder': 'Tìm kiếm',
}

