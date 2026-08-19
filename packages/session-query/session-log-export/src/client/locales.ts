/** Locale namespace owned by Session export browser feedback. */
export const NS = 'session-log-download'

/** Simplified-Chinese Session export strings. */
export const zh = {
  'dialog.preparingTitle': '正在导出 Session',
  'dialog.preparingDescription': '正在准备包含当前 Session、子 Session 和附件的 ZIP 文件。',
  'dialog.successTitle': 'Session 导出已开始下载',
  'dialog.successDescription': '浏览器正在下载 Session ZIP 文件。',
  'dialog.errorTitle': 'Session 导出失败',
  'dialog.close': '关闭',
  'dialog.commandFailed': '无法启动 Session 导出。',
} as const

/** English Session export strings. */
export const en: Record<keyof typeof zh, string> = {
  'dialog.preparingTitle': 'Exporting Session',
  'dialog.preparingDescription': 'Preparing a ZIP containing this Session, its sub-Sessions, and attachments.',
  'dialog.successTitle': 'Session download started',
  'dialog.successDescription': 'The browser is downloading the Session ZIP.',
  'dialog.errorTitle': 'Session export failed',
  'dialog.close': 'Close',
  'dialog.commandFailed': 'Could not start the Session export.',
}

/** Vietnamese Session export strings. */
export const vi: Record<keyof typeof zh, string> = {
  'dialog.preparingTitle': 'Đang xuất đoạn chat',
  'dialog.preparingDescription': 'Đang chuẩn bị tệp ZIP chứa đoạn chat này, các sub-session và tệp đính kèm.',
  'dialog.successTitle': 'Đã bắt đầu tải xuống đoạn chat',
  'dialog.successDescription': 'Trình duyệt đang tải xuống tệp ZIP của đoạn chat.',
  'dialog.errorTitle': 'Xuất đoạn chat thất bại',
  'dialog.close': 'Đóng',
  'dialog.commandFailed': 'Không thể khởi động xuất đoạn chat.',
}

/** Stable locale keys consumed by the shared modal. */
export type SessionLogDownloadKey = keyof typeof zh

