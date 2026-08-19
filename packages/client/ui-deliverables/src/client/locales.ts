/** `deliverables` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'deliverables'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'produced.label': '产物',
  'produced.moreOne': '+ 1 个文件',
  'produced.more': '+ {count} 个文件',
  'produced.open': '打开 {name}',
  'produced.showInFolder': '在文件夹中显示',
}

/** English dictionary (same key set). */
export const en: Record<DeliverablesKey, string> = {
  'produced.label': 'Produced',
  'produced.moreOne': '+ 1 file',
  'produced.more': '+ {count} files',
  'produced.open': 'Open {name}',
  'produced.showInFolder': 'Show in folder',
}

/** Vietnamese dictionary (same key set). */
export const vi: Record<DeliverablesKey, string> = {
  'produced.label': 'Sản phẩm đầu ra',
  'produced.moreOne': '+ 1 tệp',
  'produced.more': '+ {count} tệp',
  'produced.open': 'Mở {name}',
  'produced.showInFolder': 'Hiển thị trong thư mục',
}

/** Union of this namespace's dictionary keys. */
export type DeliverablesKey = keyof typeof zh

