import { test, expect, chromium } from '@playwright/test';

/** 
 * Note: Due to the online, single room nature of this app, the room ID is changed during testing to
 * use a different channel to the live game. This is to ensure no confusion between who is host.
 * 
 * For this reason too, tests cannot be run in parallel as it would throw off the player count.
 * 
 * Only some tests have been written here, not all, in the interest of brevity. With time, tests for the
 * following would be written:
 * - Players should be able to join the game until it starts.
 * - Once the game starts, no more players can join.
 * - The game engine generates and assigns unique Bingo cards to each player.
 * - The game engine calls out numbers randomly.
 * - The players' cards should be updated in real-time.
 * - The player's should be able to call out when they have bingo
 * - The winner should be reported to all the players
 * 
 * */

test('test initialises correctly', async ({ page }) => {
  // Add a constant so our app can detect test mode and alter the room ID to a private test one
  await page.addInitScript({ content: 'window.TEST_MODE = true;'});
  await page.goto('/');
  await expect(page).toHaveTitle(/BINGO!/);
});

test('app initially loads with me as host', async ({ page }) => {
  await page.addInitScript({ content: 'window.TEST_MODE = true;'});
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Waiting for players...', { timeout: 10000 });
  await expect(page.locator('#players .player')).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('#players .player').first()).toHaveClass(/you/);
  await expect(page.locator('#players .player').first()).toHaveClass(/host/);
  await expect(page.locator('#start')).toBeDisabled();
  await expect(page.locator('#reset')).toBeDisabled();
  await expect(page.locator('#called')).toBeEmpty();
  await expect(page.locator('#gamecard')).toBeEmpty();
  await expect(page.locator('#next')).toBeEmpty();
})

test('two browsers load, one as host, one as player, and can play', async ({ page }) => {
  test.setTimeout(120000) // This test has a few waits to allow the slower playwright browser to connect

  await page.addInitScript({ content: 'window.TEST_MODE = true;'});

  // Open our host page for our host
  await page.goto('/');

  // Create a second page for a player
  const browser = await chromium.launch();
  const pagetwo = await browser.newPage();
  await pagetwo.addInitScript({ content: 'window.TEST_MODE = true;'});
  await pagetwo.waitForTimeout(5000); // We do this to avoid race condition between tests
  await pagetwo.goto('/');

  // Check our host setup - this should be first player in list
  await expect(page.locator('#status')).toHaveText('Ready to start', { timeout: 30000 }); // Playwright JS execution can be slow, hence the large timeout here.
  await expect(page.locator('#players .player')).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator('#players .player').first()).toHaveClass(/you/);
  await expect(page.locator('#players .player').first()).toHaveClass(/host/);
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#reset')).toBeDisabled();
  await expect(page.locator('#called')).toBeEmpty();
  await expect(page.locator('#gamecard')).toBeEmpty();
  await expect(page.locator('#next')).toBeEmpty();

  // Check our player setup - this should be last player in list.
  await expect(pagetwo.locator('#status')).toHaveText('Waiting for players...', { timeout: 10000 });
  await expect(pagetwo.locator('#players .player')).toHaveCount(2, { timeout: 10000 });
  await expect(pagetwo.locator('#players .player').last()).toHaveClass(/you/);
  await expect(pagetwo.locator('#players .player').last()).not.toHaveClass(/host/);
  await expect(pagetwo.locator('#start')).toBeDisabled();
  await expect(pagetwo.locator('#reset')).toBeDisabled();
  await expect(pagetwo.locator('#called')).toBeEmpty();
  await expect(pagetwo.locator('#gamecard')).toBeEmpty();
  await expect(pagetwo.locator('#next')).toBeEmpty();

  // Now start the game
  await page.locator('#start').click();

  // Check initial game setup
  await expect(pagetwo.locator('#status')).toHaveText('Game is starting...', { timeout: 10000 });

  // Check gamecard generation
  await expect(page.locator('#gamecard span')).toHaveCount(25);
  await expect(pagetwo.locator('#gamecard span')).toHaveCount(25);

  // Now make sure a number is called
  await page.waitForTimeout(7000) // Wait a little over 5 seconds for the first number to be called
  await expect(page.locator('#next')).not.toBeEmpty();

  // And make sure this is reflected in the second player
  await expect(pagetwo.locator('#next')).not.toBeEmpty();

  // Make sure we close off the browser now.
  await browser.close();

})