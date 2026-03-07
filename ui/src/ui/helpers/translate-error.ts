/**
 * Translate common server-side error messages to Chinese.
 * Server errors come in English; this maps known patterns to localized strings.
 */

const SIMPLE_TRANSLATIONS: Array<[RegExp, string]> = [
  [
    /unauthorized:\s*too many failed authentication attempts.*retry later.*/i,
    "未授权：认证失败次数过多，请稍后再试",
  ],
  [
    /unauthorized:\s*gateway token mismatch.*/i,
    "未授权：网关令牌不匹配，请在控制面板设置中粘贴正确的令牌",
  ],
  [/unauthorized:\s*invalid.*token/i, "未授权：无效的令牌"],
  [/unauthorized:\s*password.*incorrect/i, "未授权：密码不正确"],
  [/unauthorized/i, "未授权"],
  [/pairing required/i, "需要配对"],
  [/connect failed/i, "连接失败"],
  [/device identity required/i, "需要设备身份验证"],
  [/connection.*refused/i, "连接被拒绝"],
  [/connection.*timeout/i, "连接超时"],
  [/network.*error/i, "网络错误"],
  [/too many requests/i, "请求过于频繁"],
  [/internal server error/i, "服务器内部错误"],
  [/gateway.*unavailable/i, "网关不可用"],
  [/session.*not found/i, "会话未找到"],
  [/invalid.*request/i, "无效请求"],
];

export function translateError(error: string | null | undefined): string {
  if (!error) {
    return "";
  }

  // Handle "disconnected (CODE): reason" pattern
  const disconnectMatch = error.match(/disconnected\s*\((\d+)\):\s*(.+)/i);
  if (disconnectMatch) {
    const code = disconnectMatch[1];
    const reason = translateError(disconnectMatch[2]);
    return `断开连接 (${code}): ${reason}`;
  }

  for (const [pattern, replacement] of SIMPLE_TRANSLATIONS) {
    if (pattern.test(error)) {
      return replacement;
    }
  }

  return error; // Return original if no match
}
