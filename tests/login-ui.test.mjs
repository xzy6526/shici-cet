import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLoginResend } from '../src/login-ui.js';

test('renders countdown and resend action states', () => {
  assert.match(renderLoginResend(59), /59 秒后可重新发送/);
  assert.match(renderLoginResend(0), /data-action="resend-login-code"/);
});
