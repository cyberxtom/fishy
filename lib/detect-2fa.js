export function detectTwofaInUrl(url) {
  if (!url) return false;
  const patterns = [
    '/challenge', '/2fa', '/two-factor', '/twofactor', '/mfa',
    '/verify', '/verification', '/otp', '/checkpoint',
    'authenticator', 'multifactor', '2sv', 'two_step',
    'login_approval', 'code_confirm',
  ];
  const lower = url.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

export function detectTwofaInHtml(html, additionalKeywords = []) {
  if (!html) return false;
  const keywords = [
    'two-factor', 'two factor', '2-factor', '2 factor', '2fa', '2FA',
    'two-step', 'two step', '2-step', '2 step',
    'verification code', 'verification code',
    'authenticator', 'multi-factor', 'multifactor',
    'otp', 'one-time', 'one time',
    'security code', 'login code', 'confirmation code',
    'approvals_code', 'checkpoint',
    'mfa', 'MFA',
    '2sv',
    'enter the code', 'enter code',
    '6-digit', 'six-digit',
    ...additionalKeywords,
  ];
  const lower = html.toLowerCase();
  return keywords.some(k => lower.includes(k));
}
