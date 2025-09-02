import { test, expect } from '@playwright/test';

test.describe('RAG Web UI - User Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('complete user workflow: upload document -> ask question -> get answer', async ({ page }) => {
    // 1. Verify dashboard loads correctly
    await expect(page.locator('h1')).toContainText('ダッシュボード');
    await expect(page.locator('text=RAG Web UI')).toBeVisible();

    // 2. Navigate to documents page
    await page.click('text=ドキュメント');
    await expect(page).toHaveURL('/documents');
    await expect(page.locator('h1')).toContainText('ドキュメント管理');

    // 3. Upload a document (simulate file upload)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=ファイルをドロップ');
    const fileChooser = await fileChooserPromise;
    
    // Create a mock PDF file buffer
    await page.evaluateHandle(() => {
      const content = 'テストドキュメントの内容です。これはRAGシステムのテスト用ファイルです。';
      const blob = new Blob([content], { type: 'application/pdf' });
      const file = new File([blob], 'test-document.pdf', { type: 'application/pdf' });
      return file;
    });
    
    await fileChooser.setFiles([{
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content for testing RAG system')
    }]);

    // 4. Verify upload progress and completion
    await expect(page.locator('text=アップロード中')).toBeVisible();
    
    // Wait for processing to complete (with timeout)
    await expect(page.locator('text=完了')).toBeVisible({ timeout: 10000 });

    // 5. Navigate to chat interface
    await page.click('text=質問応答');
    await expect(page).toHaveURL('/chat');
    await expect(page.locator('h1')).toContainText('質問応答');

    // 6. Ask a question
    const questionInput = page.locator('textarea[placeholder*="質問を入力"]');
    await expect(questionInput).toBeVisible();
    
    const testQuestion = 'アップロードしたドキュメントについて教えてください';
    await questionInput.fill(testQuestion);
    
    // Click send button
    await page.click('button[type="submit"]');

    // 7. Verify question appears in chat history
    await expect(page.locator('text=' + testQuestion)).toBeVisible();

    // 8. Wait for AI response
    await expect(page.locator('text=応答を生成中')).toBeVisible();
    
    // Wait for response to appear (with timeout)
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible({ timeout: 15000 });

    // 9. Verify response contains relevant information
    const response = page.locator('[data-testid="ai-response"]');
    await expect(response).toContainText('ドキュメント');

    // 10. Check if source references are shown
    await expect(page.locator('text=参照ソース')).toBeVisible();

    // 11. Return to dashboard to verify statistics updated
    await page.click('text=ダッシュボード');
    await expect(page).toHaveURL('/');
    
    // Check that document count increased
    await expect(page.locator('text=総ドキュメント数')).toBeVisible();
    await expect(page.locator('text=総質問数')).toBeVisible();
    
    // Verify recent activity shows our actions
    await expect(page.locator('text=最近の質問')).toBeVisible();
    await expect(page.locator('text=最近のドキュメント')).toBeVisible();
  });

  test('navigation and layout functionality', async ({ page }) => {
    // Test sidebar navigation
    await expect(page.locator('[aria-label="メインナビゲーション"]')).toBeVisible();
    
    // Test all navigation links
    const navLinks = ['ダッシュボード', 'ドキュメント', '質問応答'];
    
    for (const linkText of navLinks) {
      await page.click(`text=${linkText}`);
      await expect(page.locator(`text=${linkText}`)).toHaveClass(/bg-gray-900/);
    }

    // Test theme toggle
    const themeToggle = page.locator('[aria-label="テーマ切り替え"]');
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    
    // Verify dark mode applied
    await expect(page.locator('body')).toHaveClass(/dark/);
    
    // Toggle back to light mode
    await themeToggle.click();
    await expect(page.locator('body')).not.toHaveClass(/dark/);

    // Test responsive design - mobile menu
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile menu button should be visible
    const menuButton = page.locator('[aria-label="メニューを開く"]');
    await expect(menuButton).toBeVisible();
    
    // Click to open sidebar
    await menuButton.click();
    await expect(page.locator('[aria-label="メインナビゲーション"]')).toBeVisible();
    
    // Click overlay to close
    await page.click('.bg-gray-600.bg-opacity-75');
    await expect(page.locator('[aria-label="メインナビゲーション"]')).toHaveClass(/-translate-x-full/);
  });

  test('error handling and user feedback', async ({ page }) => {
    // Navigate to documents
    await page.click('text=ドキュメント');
    
    // Test invalid file upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=ファイルをドロップ');
    const fileChooser = await fileChooserPromise;
    
    // Try to upload an invalid file type
    await fileChooser.setFiles([{
      name: 'invalid-file.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('Invalid file content')
    }]);

    // Should show error notification
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('text=無効なファイル形式')).toBeVisible();

    // Navigate to chat
    await page.click('text=質問応答');
    
    // Test sending empty question
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();
    
    // Should show validation error
    await expect(page.locator('text=質問を入力してください')).toBeVisible();

    // Test very long question
    const longQuestion = 'これは非常に長い質問です。'.repeat(100);
    await page.locator('textarea[placeholder*="質問を入力"]').fill(longQuestion);
    await sendButton.click();
    
    // Should show length error
    await expect(page.locator('text=質問が長すぎます')).toBeVisible();
  });

  test('accessibility features', async ({ page }) => {
    // Check that main navigation has proper ARIA labels
    await expect(page.locator('[aria-label="メインナビゲーション"]')).toBeVisible();
    
    // Check button labels
    await expect(page.locator('[aria-label="テーマ切り替え"]')).toBeVisible();
    await expect(page.locator('[aria-label="通知"]')).toBeVisible();
    await expect(page.locator('[aria-label="ユーザーメニュー"]')).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Should activate focused element
    
    // Check focus management
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Navigate to chat and test form accessibility
    await page.click('text=質問応答');
    
    const textarea = page.locator('textarea[placeholder*="質問を入力"]');
    await expect(textarea).toHaveAttribute('aria-label');
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toHaveAttribute('aria-label');

    // Test color contrast and text readability
    const bodyText = page.locator('body');
    await expect(bodyText).toHaveCSS('font-family', /system-ui|sans-serif/);
  });

  test('performance and loading states', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    // Page should load within reasonable time
    expect(loadTime).toBeLessThan(5000);

    // Test loading states
    await page.click('text=ドキュメント');
    
    // Should show loading spinner when fetching data
    await expect(page.locator('[role="status"]')).toBeVisible();
    
    // Navigate to chat
    await page.click('text=質問応答');
    
    // Submit a question and verify loading state
    await page.locator('textarea[placeholder*="質問を入力"]').fill('テスト質問');
    await page.click('button[type="submit"]');
    
    // Should show generating response message
    await expect(page.locator('text=応答を生成中')).toBeVisible();
    
    // Verify that loading states are accessible
    const loadingElement = page.locator('[role="status"]');
    await expect(loadingElement).toHaveAttribute('aria-live', 'polite');
  });
});