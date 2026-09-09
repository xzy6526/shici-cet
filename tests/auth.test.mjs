import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService, validateEmail } from '../src/services/auth.js';

test('validates an email before sending an OTP', () => {
  assert.equal(validateEmail('name@example.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
  const service = createAuthService({ client: null });
  return service.sendEmailOtp('not-an-email').then((result) => {
    assert.deepEqual(result, { ok: false, error: '请输入正确的邮箱地址。' });
  });
});

test('does not pretend an OTP can be sent without Supabase configuration', async () => {
  const result = await createAuthService({ client: null }).sendEmailOtp('name@example.com');
  assert.deepEqual(result, { ok: false, error: '尚未配置 Supabase 邮箱登录。' });
});

test('uses Supabase email OTP and returns the authenticated email', async () => {
  const calls = [];
  const client = { auth: {
    signInWithOtp: async (payload) => { calls.push(payload); return { error: null }; },
    verifyOtp: async () => ({ data: { user: { id: 'user-1', email: 'name@example.com' } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: 'user-1', email: 'name@example.com' } } }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } };
  const service = createAuthService({ client });
  assert.deepEqual(await service.sendEmailOtp('Name@Example.com'), { ok: true });
  assert.equal(calls[0].email, 'name@example.com');
  assert.deepEqual(await service.verifyEmailOtp('name@example.com', '123456'), { ok: true, user: { id: 'user-1', email: 'name@example.com' } });
});
