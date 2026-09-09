export function renderLoginResend(seconds) {
  const remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (remaining > 0) return `<p class="login-resend">${remaining} 秒后可重新发送</p>`;
  return '<button class="text-button login-back" type="button" data-action="resend-login-code">重新发送验证码</button>';
}
