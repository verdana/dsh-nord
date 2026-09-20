/** `dshNord` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const LOCALE_NS = 'dshNord'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': 'Nord 主题',
  'card.summary': 'Nord 配色与 Maple Mono 字体栈',
  'card.theme': 'Nord 配色',
  'card.themeHint': '把界面配色替换为 Nord 调色板，跟随明暗模式',
  'card.font': 'Maple Mono 字体',
  'card.fontHint': '界面与代码统一使用 Maple Mono 字体栈',
  'card.balance': '底部余额条',
  'card.balanceHint': '在输入框下方显示账户余额，点击可查看明细',
  'card.refresh': '刷新间隔（秒）',
  'card.refreshHint': '自动查询余额的间隔，最少 15 秒',
  'card.baseURL': 'API 地址',
  'card.baseURLHint': '余额查询请求的 DeepSeek API 地址',
  'card.readonly': '当前连接不写入主机设置，改动只在本页生效',
  'card.unavailable': '未检测到 Host 半边，设置不可用',
  'card.saveFailed': '保存失败',
  'balance.label': '余额',
  'balance.loading': '查询中',
  'balance.insufficient': '余额不足',
  'balance.unavailable': '不可用',
  'balance.dialog.title': '余额明细',
  'balance.dialog.granted': '赠金余额',
  'balance.dialog.toppedUp': '充值余额',
  'balance.dialog.status': '账户状态',
  'balance.dialog.available': '可调用',
  'balance.dialog.updated': '更新时间',
  'error.credentials-missing': '未配置 DEEPSEEK_API_KEY',
  'error.credentials-unavailable': '凭据服务不可用',
  'error.disabled': '已关闭',
  'error.upstream-failed': '上游返回错误',
  'error.malformed-response': '响应格式异常',
  'error.request-failed': '网络请求失败',
  'error.unknown': '查询失败',
}

/** English dictionary (same key set). */
export const en: Record<NordKey, string> = {
  'card.title': 'Nord theme',
  'card.summary': 'Nord palette and Maple Mono font stacks',
  'card.theme': 'Nord palette',
  'card.themeHint': 'Replace the interface palette with Nord, following light and dark mode',
  'card.font': 'Maple Mono font',
  'card.fontHint': 'Use the Maple Mono stacks for both interface and code',
  'card.balance': 'Balance bar',
  'card.balanceHint': 'Show the account balance under the composer; click it for details',
  'card.refresh': 'Refresh interval (s)',
  'card.refreshHint': 'How often the balance is re-read; 15 seconds minimum',
  'card.baseURL': 'API base URL',
  'card.baseURLHint': 'DeepSeek API address used for balance lookups',
  'card.readonly': 'This connection does not write host settings; changes stay on this page',
  'card.unavailable': 'Host half is not mounted; settings are unavailable',
  'card.saveFailed': 'Save failed',
  'balance.label': 'Balance',
  'balance.loading': 'Checking',
  'balance.insufficient': 'Insufficient',
  'balance.unavailable': 'Unavailable',
  'balance.dialog.title': 'Balance detail',
  'balance.dialog.granted': 'Granted balance',
  'balance.dialog.toppedUp': 'Topped up',
  'balance.dialog.status': 'Account status',
  'balance.dialog.available': 'Usable',
  'balance.dialog.updated': 'Updated',
  'error.credentials-missing': 'DEEPSEEK_API_KEY is not configured',
  'error.credentials-unavailable': 'Credential service unavailable',
  'error.disabled': 'Disabled',
  'error.upstream-failed': 'Upstream returned an error',
  'error.malformed-response': 'Malformed upstream response',
  'error.request-failed': 'Request failed',
  'error.unknown': 'Lookup failed',
}

/** Union of this namespace's dictionary keys. */
export type NordKey = keyof typeof zh
