import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seedDevice, signUpThroughUi } from './helpers/ui';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

function adminToken(): string {
  const p = path.join(__dirname, '..', '..', '.auth', 'admin.json');
  return (JSON.parse(fs.readFileSync(p, 'utf8')) as { token: string }).token;
}

test.describe('live run streaming', () => {
  test('log lines and the terminal status arrive over the socket without a reload', async ({ page, request }) => {
    const device = await seedDevice(request);
    await signUpThroughUi(page);

    // A run that emits a few lines slowly, so the page is open while it talks.
    const res = await request.post(`${API_BASE_URL}/api/execution`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
      data: {
        machineId: device.machineId,
        deviceUdid: device.udid,
        project: 'stream-spec',
        branch: 'main',
        suite: 'streaming',
        run: {
          command: 'node',
          args: [
            '-e',
            'let i=0;const t=setInterval(()=>{console.log("line "+(++i));if(i>=4){clearInterval(t);process.exit(0)}},500)',
          ],
        },
      },
    });
    const run = (await res.json()) as { _id: string };

    await page.goto(`/execution/${run._id}`);

    // The connection state is never hidden (guidelines: the banner is non-negotiable).
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });

    const output = page.locator('pre[aria-label="Run output"]');
    await expect(output).toContainText('line 2', { timeout: 20000 });

    // Terminal status must land without the user reloading anything.
    await expect(page.getByText('Passed', { exact: true })).toBeVisible({ timeout: 25000 });
    await expect(output).toContainText('line 4');
  });

  test('signed out, the viewer says streaming needs sign-in rather than waiting silently', async ({
    page,
    request,
  }) => {
    const device = await seedDevice(request);
    const res = await request.post(`${API_BASE_URL}/api/execution`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
      data: {
        machineId: device.machineId,
        deviceUdid: device.udid,
        project: 'stream-spec',
        branch: 'main',
        suite: 'signed-out',
        run: { command: 'node', args: ['-e', 'process.exit(0)'] },
      },
    });
    const run = (await res.json()) as { _id: string };

    await page.goto(`/execution/${run._id}`);
    await expect(page.getByText(/Sign in to stream logs/i)).toBeVisible();
    await expect(page.getByText(/Sign in to see live output/i)).toBeVisible();
  });
});
