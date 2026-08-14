/** `prompt-optimizer` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'button.label': '优化提示词',
  'button.aria': '优化提示词',
  'button.tooltip': '优化提示词',
  'notice.optimizing': '正在优化提示词…',
  'notice.empty': '请输入内容后再优化',
  'notice.failed': '优化失败：{message}',
} satisfies Record<string, string>

/** The prompt-optimizer namespace key union. */
export type PromptOptimizerKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'button.label': 'Optimize prompt',
  'button.aria': 'Optimize prompt',
  'button.tooltip': 'Optimize prompt',
  'notice.optimizing': 'Optimizing prompt…',
  'notice.empty': 'Type something before optimizing',
  'notice.failed': 'Optimization failed: {message}',
} satisfies Record<PromptOptimizerKey, string>
