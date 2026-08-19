/** `feedback` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.like': '好的回答',
  'action.likeActive': '取消标记',
  'action.dislike': '有问题的回答',
  'action.dislikeActive': '取消标记',
  'note.open': '补充说明',
  'note.placeholder': '这条回答哪里好，或哪里有问题？（可选）',
  'note.save': '保存',
  'note.cancel': '取消',
  'note.aria': '反馈说明',
  'error.conflict': '这条反馈已在别处改动，已显示最新状态',
  'error.load': '反馈状态加载失败',
  'error.generic': '反馈保存失败',
} satisfies Record<string, string>

/** The feedback namespace key union. */
export type MessageFeedbackKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The per-message feedback controls' copy. */
    feedback: MessageFeedbackKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.like': 'Good response',
  'action.likeActive': 'Remove rating',
  'action.dislike': 'Bad response',
  'action.dislikeActive': 'Remove rating',
  'note.open': 'Add a note',
  'note.placeholder': 'What was good, or what went wrong? (optional)',
  'note.save': 'Save',
  'note.cancel': 'Cancel',
  'note.aria': 'Feedback note',
  'error.conflict': 'This feedback changed elsewhere; the latest state is shown',
  'error.load': 'Could not load feedback',
  'error.generic': 'Could not save feedback',
} satisfies Record<MessageFeedbackKey, string>

/** Vietnamese dictionary, checked complete against the zh key set. */
export const vi = {
  'action.like': 'Phản hồi tốt',
  'action.likeActive': 'Bỏ đánh giá',
  'action.dislike': 'Phản hồi chưa tốt',
  'action.dislikeActive': 'Bỏ đánh giá',
  'note.open': 'Thêm ghi chú',
  'note.placeholder': 'Câu trả lời tốt ở đâu hoặc có vấn đề gì? (tùy chọn)',
  'note.save': 'Lưu',
  'note.cancel': 'Hủy',
  'note.aria': 'Ghi chú phản hồi',
  'error.conflict': 'Phản hồi này đã bị thay đổi ở nơi khác; hiển thị trạng thái mới nhất',
  'error.load': 'Không thể tải phản hồi',
  'error.generic': 'Không thể lưu phản hồi',
} satisfies Record<MessageFeedbackKey, string>

