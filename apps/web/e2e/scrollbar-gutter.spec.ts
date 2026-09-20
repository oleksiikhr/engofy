import { expect, test } from '@playwright/test';

// Headless Chromium hides scrollbars by default, which would make the gutter
// check vacuous.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('the layout width does not change when the page starts scrolling', async ({
  page,
}) => {
  await page.goto('/posts');
  const width = () =>
    page.evaluate(() => document.body.getBoundingClientRect().width);

  await page.setViewportSize({ width: 1280, height: 4000 });
  const tall = await width();
  await page.setViewportSize({ width: 1280, height: 300 });
  expect(await width()).toBe(tall);
});
