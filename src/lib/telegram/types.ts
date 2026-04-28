export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

export type AssistantIntent = 'urgent' | 'schedule' | 'minutes' | 'knowledge' | 'generic'
