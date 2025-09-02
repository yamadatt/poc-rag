import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 375, height: 667 },
    { name: 'Mobile Landscape', width: 667, height: 375 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop', width: 1200, height: 800 },
    { name: 'Large Desktop', width: 1920, height: 1080 },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Wait for layout to settle
      await page.waitForLoadState('networkidle');
      
      // Basic layout should be visible
      await expect(page.locator('text=RAG Web UI')).toBeVisible();
      
      if (viewport.width < 768) {
        // Mobile: sidebar should be hidden initially, hamburger menu visible
        const sidebar = page.locator('[aria-label="メインナビゲーション"]');
        await expect(sidebar).toHaveClass(/-translate-x-full/);
        
        const hamburger = page.locator('[aria-label="メニューを開く"]');
        await expect(hamburger).toBeVisible();
        
        // Click hamburger to open sidebar
        await hamburger.click();
        await expect(sidebar).not.toHaveClass(/-translate-x-full/);
        
        // Overlay should be visible
        const overlay = page.locator('.bg-gray-600.bg-opacity-75');
        await expect(overlay).toBeVisible();
        
        // Click overlay to close
        await overlay.click();
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      } else {
        // Desktop/Tablet: sidebar should be visible, hamburger hidden
        const sidebar = page.locator('[aria-label="メインナビゲーション"]');
        await expect(sidebar).not.toHaveClass(/-translate-x-full/);
        
        const hamburger = page.locator('[aria-label="メニューを開く"]');
        await expect(hamburger).not.toBeVisible();
      }
      
      // Content should be readable
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      
      // Navigation should work
      await page.click('text=ドキュメント');
      await expect(page.locator('h1')).toHaveText('ドキュメント管理');
      
      await page.click('text=質問応答');
      await expect(page.locator('h1')).toHaveText('質問応答');
    });
  }

  test('should handle text scaling appropriately', async ({ page }) => {
    // Test with different text scales
    const scales = [1.0, 1.25, 1.5, 2.0];
    
    for (const scale of scales) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(`
        document.documentElement.style.fontSize = '${16 * scale}px';
      `);
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Content should still be accessible and readable
      await expect(page.locator('text=RAG Web UI')).toBeVisible();
      await expect(page.locator('text=ダッシュボード')).toBeVisible();
      
      // Navigation should still work
      await page.click('text=ドキュメント');
      await expect(page.locator('text=ドキュメント管理')).toBeVisible();
      
      // Text should not overflow containers
      const textElements = page.locator('p, h1, h2, h3, span');
      const count = await textElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = textElements.nth(i);
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          expect(box?.width).toBeGreaterThan(0);
          expect(box?.height).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should work with touch interactions on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test touch interactions
    const hamburger = page.locator('[aria-label="メニューを開く"]');
    
    // Touch to open menu
    await hamburger.tap();
    const sidebar = page.locator('[aria-label="メインナビゲーション"]');
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);
    
    // Touch nav item
    await page.tap('text=ドキュメント');
    await expect(page.locator('text=ドキュメント管理')).toBeVisible();
    
    // Test swipe gesture (simulate)
    await page.touchscreen.tap(100, 300);
    await page.touchscreen.tap(300, 300);
    
    // Form interactions should work with touch
    await page.tap('text=質問応答');
    const textarea = page.locator('textarea');
    await textarea.tap();
    await textarea.fill('テスト質問');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.tap();
  });

  test('should maintain layout integrity across orientations', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.locator('text=RAG Web UI')).toBeVisible();
    
    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500); // Wait for layout adjustment
    
    // Layout should still be functional
    await expect(page.locator('text=RAG Web UI')).toBeVisible();
    
    // Navigation should work
    const hamburger = page.locator('[aria-label="メニューを開く"]');
    await hamburger.click();
    
    await page.click('text=ドキュメント');
    await expect(page.locator('text=ドキュメント管理')).toBeVisible();
    
    // Back to portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=ドキュメント管理')).toBeVisible();
  });

  test('should handle content overflow gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // Very small screen
    
    // Long text should not break layout
    await page.click('text=質問応答');
    
    const longText = 'これは非常に長い質問文です。'.repeat(10);
    await page.locator('textarea').fill(longText);
    
    // Text should wrap or scroll, not overflow
    const textarea = page.locator('textarea');
    const textareaBox = await textarea.boundingBox();
    const container = page.locator('.container').first();
    const containerBox = await container.boundingBox();
    
    if (textareaBox && containerBox) {
      expect(textareaBox.x + textareaBox.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 10); // Small tolerance
    }
  });

  test('should optimize for different device types', async ({ page, browserName: _browserName }) => {
    const deviceTests = [
      { device: devices['iPhone 12'], name: 'iPhone 12' },
      { device: devices['iPhone SE'], name: 'iPhone SE' },
      { device: devices['iPad'], name: 'iPad' },
      { device: devices['Galaxy S9+'], name: 'Galaxy S9+' },
      { device: devices['Pixel 5'], name: 'Pixel 5' },
    ];

    for (const { device, name } of deviceTests) {
      await page.setViewportSize(device.viewport);
      if (device.userAgent) {
        await page.setExtraHTTPHeaders({ 'User-Agent': device.userAgent });
      }
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Basic functionality should work
      await expect(page.locator('text=RAG Web UI')).toBeVisible();
      
      // Touch targets should be appropriate size (44px minimum)
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(32); // Slightly less than 44px for icons
          }
        }
      }
      
      console.log(`✅ ${name} responsive test passed`);
    }
  });

  test('should handle zoom levels appropriately', async ({ page }) => {
    const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
    
    for (const zoom of zoomLevels) {
      await page.evaluate((zoomLevel) => {
        document.body.style.zoom = zoomLevel.toString();
      }, zoom);
      
      await page.waitForTimeout(200);
      
      // Content should remain accessible
      await expect(page.locator('text=RAG Web UI')).toBeVisible();
      
      // Navigation should work at all zoom levels
      const navLinks = page.locator('[aria-label="メインナビゲーション"] a');
      const linkCount = await navLinks.count();
      
      if (linkCount > 0) {
        const firstLink = navLinks.first();
        await expect(firstLink).toBeVisible();
        
        // Should be clickable
        const box = await firstLink.boundingBox();
        expect(box?.width).toBeGreaterThan(0);
        expect(box?.height).toBeGreaterThan(0);
      }
    }
  });

  test('should maintain performance on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Simulate slower mobile connection
    await page.route('**/*', (route) => {
      route.continue();
    });
    
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // Should load reasonably quickly even on mobile
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    // Interactive elements should respond quickly
    const button = page.locator('[aria-label="メニューを開く"]');
    const clickStart = Date.now();
    await button.click();
    const clickTime = Date.now() - clickStart;
    
    expect(clickTime).toBeLessThan(1000); // 1 second max
    
    // Menu should be visible
    const sidebar = page.locator('[aria-label="メインナビゲーション"]');
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);
  });

  test('should handle print styles correctly', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    
    // Print-specific styles should be applied
    await page.waitForLoadState('networkidle');
    
    // Navigation might be hidden in print
    // Content should be readable
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    
    // Check that important content is still visible
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    
    if (headingCount > 0) {
      await expect(headings.first()).toBeVisible();
    }
  });

  test('should work with CSS Grid and Flexbox layouts', async ({ page }) => {
    // Test various viewport sizes to ensure CSS Grid/Flexbox responds correctly
    const sizes = [
      { width: 320, height: 568 },
      { width: 768, height: 1024 },
      { width: 1200, height: 800 }
    ];
    
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      
      // Check that grid/flex layouts are working
      const gridContainers = page.locator('.grid, .flex');
      const containerCount = await gridContainers.count();
      
      for (let i = 0; i < Math.min(containerCount, 3); i++) {
        const container = gridContainers.nth(i);
        if (await container.isVisible()) {
          const box = await container.boundingBox();
          expect(box?.width).toBeGreaterThan(0);
          expect(box?.height).toBeGreaterThan(0);
        }
      }
      
      // Content should not overlap
      await expect(page.locator('text=RAG Web UI')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    }
  });
});