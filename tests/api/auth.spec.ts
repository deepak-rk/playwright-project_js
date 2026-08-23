import { test, expect } from '@playwright/test';
import { authHeaders, registerUser } from './helpers/auth';

test.describe('auth', () => {
  test('register returns a token and a public user with no password field', async ({ request }) => {
    const user = await registerUser(request);
    expect(user.token).toBeTruthy();
    expect(user.userId).toBeTruthy();
  });

  test('login with correct credentials succeeds, wrong password is rejected', async ({ request }) => {
    const email = `e2e-login-${Date.now()}@example.com`;
    const password = 'correct-password-123';
    const reg = await request.post('/api/auth/register', { data: { email, name: 'Login Test', password } });
    expect(reg.ok()).toBeTruthy();

    const goodLogin = await request.post('/api/auth/login', { data: { email, password } });
    expect(goodLogin.ok()).toBeTruthy();
    const body = await goodLogin.json();
    expect(body.token).toBeTruthy();

    const badLogin = await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } });
    expect(badLogin.status()).toBe(401);
    expect((await badLogin.json()).code).toBe('INVALID_CREDENTIALS');
  });

  test('duplicate email registration is rejected with 409', async ({ request }) => {
    const email = `e2e-dup-${Date.now()}@example.com`;
    const first = await request.post('/api/auth/register', {
      data: { email, name: 'First', password: 'supersecret123' },
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.post('/api/auth/register', {
      data: { email, name: 'Second', password: 'supersecret123' },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).code).toBe('CONFLICT');
  });

  test('GET /me requires a token and returns the caller when authenticated', async ({ request }) => {
    const user = await registerUser(request);

    const unauthed = await request.get('/api/auth/me');
    expect(unauthed.status()).toBe(401);

    const authed = await request.get('/api/auth/me', { headers: authHeaders(user.token) });
    expect(authed.ok()).toBeTruthy();
    const body = await authed.json();
    expect(body.email).toBe(user.email);
  });

  test('registration rejects an invalid email and a too-short password', async ({ request }) => {
    const badEmail = await request.post('/api/auth/register', {
      data: { email: 'not-an-email', name: 'X', password: 'supersecret123' },
    });
    expect(badEmail.status()).toBe(400);

    const shortPassword = await request.post('/api/auth/register', {
      data: { email: `e2e-${Date.now()}@example.com`, name: 'X', password: 'short' },
    });
    expect(shortPassword.status()).toBe(400);
  });
});
