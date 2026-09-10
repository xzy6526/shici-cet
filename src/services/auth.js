import { createGuestAccount } from '../account.js';

function configValue(name) {
  return String(globalThis.__SHICI_ENV__?.[name] || import.meta.env?.[name] || '').trim();
}

export function getSupabaseConfig() {
  return { url: configValue('VITE_SUPABASE_URL'), anonKey: configValue('VITE_SUPABASE_ANON_KEY') };
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeOtp(value) {
  const normalized = sanitizeOtpInput(value);
  return /^\d{6}$/.test(normalized) ? normalized : '';
}

export function sanitizeOtpInput(value) {
  return String(value || '').replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0)).replace(/\D/g, '').slice(0, 6);
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function errorMessage(error) {
  const text = String(error?.message || '登录服务暂时不可用。');
  if (/rate|too many|频繁/i.test(text)) return '请求过于频繁，请稍后再试。';
  if (/expired/i.test(text)) return '验证码已过期，请重新获取。';
  if (/token|code|otp|invalid/i.test(text)) return '验证码不正确，请重试。';
  if (/network|fetch/i.test(text)) return '网络不可用，请稍后重试。';
  return '登录服务暂时不可用，请稍后重试。';
}

export function createAuthService(options = {}) {
  const config = options.config || getSupabaseConfig();
  const client = Object.hasOwn(options, 'client') ? options.client : (config.url && config.anonKey ? globalThis.supabase?.createClient(config.url, config.anonKey) : null);
  const unavailable = () => ({ ok: false, error: '尚未配置 Supabase 邮箱登录。' });
  return {
    client,
    configured: Boolean(client),
    async getCurrentUser() {
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.user?.email) return null;
        return { id: data.session.user.id, email: data.session.user.email };
      } catch {
        return null;
      }
    },
    async getSession() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      return error ? null : data.session;
    },
    async sendEmailOtp(value) {
      const email = normalizedEmail(value);
      if (!validateEmail(email)) return { ok: false, error: '请输入正确的邮箱地址。' };
      if (!client) return unavailable();
      try {
        const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        return error ? { ok: false, error: errorMessage(error) } : { ok: true };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    async verifyEmailOtp(value, token) {
      const email = normalizedEmail(value);
      if (!validateEmail(email)) return { ok: false, error: '请输入正确的邮箱地址。' };
      const normalizedToken = normalizeOtp(token);
      if (!normalizedToken) return { ok: false, error: '请输入 6 位验证码。' };
      if (!client) return unavailable();
      try {
        const { data, error } = await client.auth.verifyOtp({ email, token: normalizedToken, type: 'email' });
        const user = data?.user;
        return error || !user?.email ? { ok: false, error: errorMessage(error) } : { ok: true, user: { id: user.id, email: user.email } };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    async signOut() {
      if (!client) return { ok: true };
      try {
        const { error } = await client.auth.signOut();
        return error ? { ok: false, error: errorMessage(error) } : { ok: true };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    onAuthStateChange(callback) {
      if (!client) { callback?.(createGuestAccount()); return () => {}; }
      const { data } = client.auth.onAuthStateChange((_event, session) => callback?.(session?.user?.email ? { status: 'authenticated', user: { id: session.user.id, email: session.user.email } } : createGuestAccount()));
      return () => data.subscription.unsubscribe();
    },
  };
}

export const authService = createAuthService();
