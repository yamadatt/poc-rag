import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should not have any automatically detectable accessibility issues on dashboard', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues on documents page', async ({ page }) => {
    await page.click('text=ドキュメント');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues on chat page', async ({ page }) => {
    await page.click('text=質問応答');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Check dashboard
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('ダッシュボード');
    
    const h2Elements = page.locator('h2');
    await expect(h2Elements.first()).toBeVisible();
    
    // Navigate and check other pages
    await page.click('text=ドキュメント');
    await expect(page.locator('h1')).toHaveText('ドキュメント管理');
    
    await page.click('text=質問応答');
    await expect(page.locator('h1')).toHaveText('質問応答');
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    // Check navigation has proper ARIA
    await expect(page.locator('[aria-label="メインナビゲーション"]')).toBeVisible();
    
    // Check buttons have proper labels
    await expect(page.locator('[aria-label="テーマ切り替え"]')).toBeVisible();
    await expect(page.locator('[aria-label="通知"]')).toBeVisible();
    await expect(page.locator('[aria-label="ユーザーメニュー"]')).toBeVisible();
    
    // Check form elements
    await page.click('text=質問応答');
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveAttribute('aria-label');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    let focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    
    // Continue tabbing through interactive elements
    await page.keyboard.press('Tab');
    focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    
    // Test Enter to activate
    await page.keyboard.press('Enter');
    
    // Test navigation using keyboard
    await page.click('text=質問応答');
    await page.keyboard.press('Tab');
    
    // Focus should be on the textarea
    const textarea = page.locator('textarea:focus');
    await expect(textarea).toBeVisible();
    
    // Type and submit with keyboard
    await page.keyboard.type('テスト質問');
    await page.keyboard.press('Tab'); // Move to submit button
    await page.keyboard.press('Enter'); // Submit
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // Test with axe-core color contrast checks
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toHaveLength(0);
    
    // Test in dark mode
    await page.click('[aria-label="テーマ切り替え"]');
    
    const darkModeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const darkModeContrastViolations = darkModeResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(darkModeContrastViolations).toHaveLength(0);
  });

  test('should have readable focus indicators', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus');
    
    // Check that focus indicator is visible
    await expect(focusedElement).toHaveCSS('outline-width', /[^0].*px/);
    
    // Or check for custom focus styles
    const focusStyles = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
      };
    });
    
    // Should have some form of focus indicator
    const hasFocusIndicator = 
      focusStyles.outline !== 'none' ||
      focusStyles.boxShadow !== 'none' ||
      focusStyles.borderColor !== 'rgba(0, 0, 0, 0)';
      
    expect(hasFocusIndicator).toBeTruthy();
  });

  test('should provide alternative text for images', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const ariaLabelledBy = await img.getAttribute('aria-labelledby');
      
      // Image should have alt text or ARIA label
      const hasAlternativeText = alt !== null || ariaLabel !== null || ariaLabelledBy !== null;
      expect(hasAlternativeText).toBeTruthy();
    }
  });

  test('should announce loading states to screen readers', async ({ page }) => {
    // Navigate to documents page
    await page.click('text=ドキュメント');
    
    // Check for loading state announcements
    const loadingElements = page.locator('[aria-live]');
    if (await loadingElements.count() > 0) {
      const ariaLive = await loadingElements.first().getAttribute('aria-live');
      expect(['polite', 'assertive']).toContain(ariaLive);
    }
    
    // Check for role="status" elements
    const statusElements = page.locator('[role="status"]');
    if (await statusElements.count() > 0) {
      await expect(statusElements.first()).toBeVisible();
    }
  });

  test('should handle form validation accessibly', async ({ page }) => {
    await page.click('text=質問応答');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Check for validation messages
    const errorMessages = page.locator('[role="alert"], .error-message, [aria-invalid="true"]');
    if (await errorMessages.count() > 0) {
      await expect(errorMessages.first()).toBeVisible();
    }
  });

  test('should support high contrast mode', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    
    // Check that essential elements are still visible
    await expect(page.locator('text=RAG Web UI')).toBeVisible();
    await expect(page.locator('text=ダッシュボード')).toBeVisible();
    
    // Navigation should still work
    await page.click('text=ドキュメント');
    await expect(page.locator('text=ドキュメント管理')).toBeVisible();
  });

  test('should work with reduced motion preference', async ({ page }) => {
    // Simulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Navigation should still work without animations
    await page.click('text=ドキュメント');
    await expect(page.locator('text=ドキュメント管理')).toBeVisible();
    
    await page.click('text=質問応答');
    await expect(page.locator('text=質問応答')).toBeVisible();
  });

  test('should have semantic HTML structure', async ({ page }) => {
    // Check for proper landmarks
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    
    // Check for proper headings
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1); // Should have exactly one h1 per page
    
    // Check for proper button vs link usage
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasOnClick = await button.evaluate(el => 
        el.onclick !== null || el.getAttribute('onclick') !== null
      );
      
      // Buttons should either have click handlers or be form submissions
      const isSubmit = await button.getAttribute('type') === 'submit';
      expect(hasOnClick || isSubmit).toBeTruthy();
    }
  });
});