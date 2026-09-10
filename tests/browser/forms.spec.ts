import { test, expect } from '@playwright/test';
import { encodeAddress } from '@polkadot/util-crypto';
const recipient = encodeAddress(new Uint8Array(32), 189);
test.beforeEach(async ({ page }) => {
  // Deterministic offline UI tests: no wallet data or transaction leaves the browser.
  await page.route(
    /^https:\/\/(rpc1-mainnet\.quantus\.com|sqm\.quantus\.com)\//,
    (route) => route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('./');
});
test('query click submits and Enter remains supported', async ({ page }) => {
  await page.getByLabel('查询公开地址').fill('invalid-address');
  await page.getByRole('button', { name: '查询地址', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('地址校验失败');
  await page.getByLabel('查询公开地址').fill(recipient);
  await page.getByRole('button', { name: '查询地址', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '地址查询', exact: true }),
  ).toBeVisible();
  await page.getByLabel('查询公开地址').fill('invalid-again');
  await page.getByLabel('查询公开地址').press('Enter');
  await expect(
    page.getByRole('alert').filter({ hasText: '地址校验失败' }),
  ).toBeVisible();
});
test('8-character vault, generation, backup confirmation and unlock submit on click', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: '添加钱包', exact: true })
    .first()
    .click();
  await page.getByLabel('保险库密码', { exact: true }).fill('test1234');
  await page.getByLabel('再次输入密码').fill('test1234');
  await page.getByRole('button', { name: '创建保险库', exact: true }).click();
  await page.getByRole('button', { name: /创建新钱包/ }).click();
  await page.getByRole('button', { name: '生成助记词', exact: true }).click();
  await expect(page.locator('.mnemonic-grid > div')).toHaveCount(24);
  const words = await page
    .locator('.mnemonic-grid > div')
    .evaluateAll((nodes) =>
      nodes.map((n) => n.childNodes[n.childNodes.length - 1].textContent!),
    );
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /验证备份|下一步|已备份/ }).click();
  for (const n of [3, 11, 20])
    await page.getByLabel(`第 ${n} 个单词`).fill(words[n - 1]);
  await page.getByRole('button', { name: '确认并保存钱包' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '锁定钱包' }).click();
  await page
    .getByRole('button', { name: '解锁钱包', exact: true })
    .first()
    .click();
  await page.getByLabel('保险库密码', { exact: true }).fill('test1234');
  await page.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /导入已有钱包/ }),
  ).toBeVisible();
});

test('seed import, transfer validation and encrypted backup restore submit on click', async ({
  page,
}, testInfo) => {
  await page
    .getByRole('button', { name: '添加钱包', exact: true })
    .first()
    .click();
  await page.getByLabel('保险库密码', { exact: true }).fill('test1234');
  await page.getByLabel('再次输入密码').fill('test1234');
  await page.getByRole('button', { name: '创建保险库', exact: true }).click();
  await page.getByRole('button', { name: /导入已有钱包/ }).click();
  await page.getByRole('tab', { name: '私钥种子' }).click();
  await page
    .getByLabel('32 字节私钥种子', { exact: true })
    .fill('00'.repeat(32));
  await page.getByRole('button', { name: '验证并导入', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '导入钱包', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '转出', exact: true }).click();
  await page.getByLabel('收款地址', { exact: true }).fill('invalid');
  await page.getByLabel('转账金额 · QTC').fill('1');
  await page.getByRole('button', { name: '预览转账' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '地址校验失败',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '钱包设置' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载加密备份' }).click();
  const backup = testInfo.outputPath('test-fixture-backup.json');
  await (await downloading).saveAs(backup);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '从加密备份恢复' }).click();
  await page.getByLabel('选择本机加密备份').setInputFiles(backup);
  await page.getByLabel('该备份的保险库密码').fill('test1234');
  await page.getByRole('button', { name: '在本机解密并恢复' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '导入钱包', exact: true }),
  ).toBeVisible();
});
