import { test, expect } from '@playwright/test';

test.describe('RAG Web UI - API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('dashboard API integration', async ({ page, request: _request }) => {
    // Test dashboard stats API
    await page.route('/api/stats', async (route) => {
      const mockStats = {
        totalDocuments: 15,
        totalQueries: 89,
        avgResponseTime: 1.3,
        successRate: 98.5,
        storageUsed: 2.1,
        storageLimit: 10.0,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      });
    });

    // Test recent queries API
    await page.route('/api/queries/recent', async (route) => {
      const mockQueries = [
        {
          id: 'q1',
          question: 'RAGシステムについて教えて',
          timestamp: new Date().toISOString(),
          responseTime: 1.2,
          resultCount: 5,
        },
        {
          id: 'q2',
          question: 'ベクトル検索の仕組みは？',
          timestamp: new Date().toISOString(),
          responseTime: 0.9,
          resultCount: 3,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueries),
      });
    });

    // Test recent documents API
    await page.route('/api/documents/recent', async (route) => {
      const mockDocuments = [
        {
          id: 'doc1',
          fileName: 'テスト文書.pdf',
          fileType: 'application/pdf',
          fileSize: 1024000,
          status: 'completed',
          uploadedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDocuments),
      });
    });

    // Navigate to dashboard and verify data loads
    await page.reload();
    
    // Verify stats are displayed
    await expect(page.locator('text=15')).toBeVisible(); // Total documents
    await expect(page.locator('text=89')).toBeVisible(); // Total queries
    await expect(page.locator('text=1.30秒')).toBeVisible(); // Avg response time
    await expect(page.locator('text=98.5%')).toBeVisible(); // Success rate

    // Verify recent queries
    await expect(page.locator('text=RAGシステムについて教えて')).toBeVisible();
    await expect(page.locator('text=ベクトル検索の仕組みは？')).toBeVisible();

    // Verify recent documents
    await expect(page.locator('text=テスト文書.pdf')).toBeVisible();
  });

  test('document upload API integration', async ({ page }) => {
    // Mock successful upload
    await page.route('/api/documents/upload', async (route) => {
      const uploadResponse = {
        id: 'upload-123',
        fileName: 'test-document.pdf',
        status: 'processing',
        uploadedAt: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(uploadResponse),
      });
    });

    // Mock processing status updates
    await page.route('/api/documents/upload-123/status', async (route) => {
      const statusResponse = {
        id: 'upload-123',
        status: 'completed',
        processedAt: new Date().toISOString(),
        progress: 100,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(statusResponse),
      });
    });

    await page.click('text=ドキュメント');

    // Simulate file upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=ファイルをドロップ');
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content')
    }]);

    // Verify upload initiated
    await expect(page.locator('text=アップロード中')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=完了')).toBeVisible({ timeout: 10000 });
  });

  test('chat API integration', async ({ page }) => {
    // Mock successful chat response
    await page.route('/api/chat', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      
      const chatResponse = {
        id: 'response-456',
        question: postData.question,
        answer: 'これはAIからの回答です。あなたの質問について詳細に説明いたします。',
        sources: [
          {
            id: 'doc1',
            fileName: '参照文書.pdf',
            relevanceScore: 0.95,
            excerpt: '関連するテキストの抜粋です...',
          },
        ],
        responseTime: 1.2,
        timestamp: new Date().toISOString(),
      };
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(chatResponse),
      });
    });

    // Navigate to chat
    await page.click('text=質問応答');

    // Send a question
    const questionInput = page.locator('textarea[placeholder*="質問を入力"]');
    await questionInput.fill('テスト質問です');
    await page.click('button[type="submit"]');

    // Verify processing state
    await expect(page.locator('text=応答を生成中')).toBeVisible();

    // Wait for response
    await expect(page.locator('text=これはAIからの回答です')).toBeVisible({ timeout: 10000 });
    
    // Verify sources are shown
    await expect(page.locator('text=参照ソース')).toBeVisible();
    await expect(page.locator('text=参照文書.pdf')).toBeVisible();
  });

  test('API error handling', async ({ page }) => {
    // Mock server error
    await page.route('/api/stats', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Navigate to dashboard
    await page.reload();

    // Verify error is displayed
    await expect(page.locator('text=Internal server error')).toBeVisible();

    // Test network error
    await page.route('/api/documents', async (route) => {
      await route.abort('connectionclosed');
    });

    await page.click('text=ドキュメント');
    
    // Should show network error message
    await expect(page.locator('text=ネットワークエラー')).toBeVisible();

    // Test timeout
    await page.route('/api/chat', async (_route) => {
      // Never resolve to simulate timeout
      await new Promise(() => {});
    });

    await page.click('text=質問応答');
    await page.locator('textarea[placeholder*="質問を入力"]').fill('timeout test');
    await page.click('button[type="submit"]');

    // Should show timeout error after waiting
    await expect(page.locator('text=タイムアウト')).toBeVisible({ timeout: 35000 });
  });

  test('API authentication and authorization', async ({ page }) => {
    // Mock unauthorized response
    await page.route('/api/**', async (route) => {
      if (!route.request().headers()['authorization']) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      }
    });

    await page.reload();

    // Should show authentication error
    await expect(page.locator('text=認証エラー')).toBeVisible();

    // Mock forbidden response
    await page.route('/api/**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      });
    });

    await page.click('text=ドキュメント');

    // Should show permission error
    await expect(page.locator('text=権限がありません')).toBeVisible();
  });

  test('API data validation', async ({ page }) => {
    // Mock validation error
    await page.route('/api/documents/upload', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Validation failed',
          details: {
            fileSize: 'File size exceeds limit',
            fileType: 'Unsupported file type',
          },
        }),
      });
    });

    await page.click('text=ドキュメント');

    // Try to upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=ファイルをドロップ');
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'large-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Large file content')
    }]);

    // Should show validation errors
    await expect(page.locator('text=File size exceeds limit')).toBeVisible();
    await expect(page.locator('text=Unsupported file type')).toBeVisible();
  });

  test('real-time updates and polling', async ({ page }) => {
    let pollCount = 0;

    // Mock polling endpoint
    await page.route('/api/documents/*/status', async (route) => {
      pollCount++;
      const statuses = ['processing', 'processing', 'completed'];
      const status = statuses[Math.min(pollCount - 1, statuses.length - 1)];
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'doc123',
          status,
          progress: pollCount * 33,
        }),
      });
    });

    await page.click('text=ドキュメント');

    // Simulate upload start
    await page.route('/api/documents/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'doc123',
          status: 'processing',
          fileName: 'test.pdf',
        }),
      });
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=ファイルをドロップ');
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test content')
    }]);

    // Wait for processing to complete through polling
    await expect(page.locator('text=完了')).toBeVisible({ timeout: 15000 });
    
    // Verify polling occurred multiple times
    expect(pollCount).toBeGreaterThan(1);
  });
});