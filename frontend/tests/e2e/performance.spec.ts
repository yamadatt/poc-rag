import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    // Enable performance tracking
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();
    
    const startTime = Date.now();
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);
    
    // Performance budget: should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime,
        largestContentfulPaint: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime,
      };
    });
    
    console.log('Performance metrics:', performanceMetrics);
    
    // Performance thresholds
    if (performanceMetrics.firstContentfulPaint) {
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000); // 2s
    }
    
    if (performanceMetrics.largestContentfulPaint) {
      expect(performanceMetrics.largestContentfulPaint).toBeLessThan(2500); // 2.5s
    }
    
    // Stop coverage and analyze
    const [jsCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage(),
    ]);
    
    // Calculate unused code percentage
    const jsUnusedBytes = jsCoverage.reduce((acc, entry) => {
      const unused = entry.ranges.reduce((sum, range) => sum + (range.end - range.start), 0);
      return acc + unused;
    }, 0);
    
    const jsTotalBytes = jsCoverage.reduce((acc, entry) => acc + entry.text.length, 0);
    const jsUsagePercent = ((jsTotalBytes - jsUnusedBytes) / jsTotalBytes) * 100;
    
    console.log(`JavaScript usage: ${jsUsagePercent.toFixed(2)}%`);
    
    // Should have reasonable code usage (at least 30%)
    expect(jsUsagePercent).toBeGreaterThan(30);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Mock large dataset response
    await page.route('**/api/documents', async (route) => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `doc-${i}`,
        fileName: `document-${i}.pdf`,
        fileType: 'application/pdf',
        fileSize: Math.floor(Math.random() * 10000000),
        status: 'completed',
        uploadedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        processedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeDataset),
      });
    });
    
    await page.goto('/documents');
    
    // Measure rendering time for large list
    const renderStart = Date.now();
    await page.waitForSelector('text=document-0.pdf');
    await page.waitForSelector('text=document-99.pdf', { timeout: 10000 });
    const renderTime = Date.now() - renderStart;
    
    console.log(`Large dataset render time: ${renderTime}ms`);
    
    // Should render within reasonable time
    expect(renderTime).toBeLessThan(5000);
    
    // Scrolling should be smooth
    const scrollStart = Date.now();
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(100);
    const scrollTime = Date.now() - scrollStart;
    
    expect(scrollTime).toBeLessThan(500);
  });

  test('should optimize image and asset loading', async ({ page }) => {
    // Track network requests
    const requests: any[] = [];
    page.on('request', request => requests.push({
      url: request.url(),
      resourceType: request.resourceType(),
      size: request.postDataBuffer()?.length || 0,
    }));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Analyze asset loading
    const imageRequests = requests.filter(req => req.resourceType === 'image');
    const scriptRequests = requests.filter(req => req.resourceType === 'script');
    const stylesheetRequests = requests.filter(req => req.resourceType === 'stylesheet');
    
    console.log(`Image requests: ${imageRequests.length}`);
    console.log(`Script requests: ${scriptRequests.length}`);
    console.log(`Stylesheet requests: ${stylesheetRequests.length}`);
    
    // Should have reasonable number of requests
    expect(imageRequests.length).toBeLessThan(20);
    expect(scriptRequests.length).toBeLessThan(10);
    expect(stylesheetRequests.length).toBeLessThan(5);
    
    // Check for resource compression
    const responses = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((entry: any) => ({
        name: entry.name,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      }));
    });
    
    const compressedResources = responses.filter(response => 
      response.transferSize < response.decodedBodySize
    );
    
    console.log(`Compressed resources: ${compressedResources.length}/${responses.length}`);
    
    // Should have some compression
    expect(compressedResources.length).toBeGreaterThan(0);
  });

  test('should maintain performance during user interactions', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation performance
    const navigationTests = [
      { from: '/', to: '/documents', text: 'ドキュメント' },
      { from: '/documents', to: '/chat', text: '質問応答' },
      { from: '/chat', to: '/', text: 'ダッシュボード' },
    ];
    
    for (const nav of navigationTests) {
      const navStart = Date.now();
      await page.click(`text=${nav.text}`);
      await page.waitForURL(`**${nav.to}`);
      const navTime = Date.now() - navStart;
      
      console.log(`Navigation ${nav.from} → ${nav.to}: ${navTime}ms`);
      expect(navTime).toBeLessThan(1000);
    }
    
    // Test theme toggle performance
    const themeStart = Date.now();
    await page.click('[aria-label="テーマ切り替え"]');
    await page.waitForTimeout(100);
    const themeTime = Date.now() - themeStart;
    
    console.log(`Theme toggle time: ${themeTime}ms`);
    expect(themeTime).toBeLessThan(500);
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
    
    if (initialMemory) {
      console.log('Initial memory usage:', initialMemory);
    }
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await page.click('text=ドキュメント');
      await page.waitForTimeout(100);
      await page.click('text=質問応答');
      await page.waitForTimeout(100);
      await page.click('text=ダッシュボード');
      await page.waitForTimeout(100);
    }
    
    // Check memory usage after operations
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
    
    if (initialMemory && finalMemory) {
      console.log('Final memory usage:', finalMemory);
      
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.used) * 100;
      
      console.log(`Memory increase: ${memoryIncrease} bytes (${memoryIncreasePercent.toFixed(2)}%)`);
      
      // Memory increase should be reasonable (less than 50%)
      expect(memoryIncreasePercent).toBeLessThan(50);
    }
  });

  test('should optimize bundle size', async ({ page }) => {
    // Enable network tracking
    await page.route('**/*.js', async (route) => {
      const response = await route.fetch();
      const buffer = await response.body();
      
      console.log(`JS file: ${route.request().url().split('/').pop()} - ${buffer.length} bytes`);
      
      // Individual JS bundles shouldn't be too large
      expect(buffer.length).toBeLessThan(1024 * 1024); // 1MB max per bundle
      
      route.fulfill({ response });
    });
    
    await page.route('**/*.css', async (route) => {
      const response = await route.fetch();
      const buffer = await response.body();
      
      console.log(`CSS file: ${route.request().url().split('/').pop()} - ${buffer.length} bytes`);
      
      // CSS files shouldn't be too large
      expect(buffer.length).toBeLessThan(512 * 1024); // 512KB max per CSS file
      
      route.fulfill({ response });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle concurrent requests efficiently', async ({ page }) => {
    // Mock multiple concurrent API calls
    let requestCount = 0;
    const requestTimings: number[] = [];
    
    await page.route('**/api/**', async (route) => {
      const start = Date.now();
      requestCount++;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const timing = Date.now() - start;
      requestTimings.push(timing);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: `Response ${requestCount}` }),
      });
    });
    
    const pageLoadStart = Date.now();
    
    // Load page which should trigger multiple API calls
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const pageLoadTime = Date.now() - pageLoadStart;
    
    console.log(`Concurrent requests: ${requestCount}`);
    console.log(`Average request time: ${requestTimings.reduce((a, b) => a + b, 0) / requestTimings.length}ms`);
    console.log(`Total page load time: ${pageLoadTime}ms`);
    
    // Should handle concurrent requests efficiently
    expect(requestCount).toBeGreaterThan(0);
    expect(pageLoadTime).toBeLessThan(5000);
    
    // Requests should complete in reasonable time
    const avgRequestTime = requestTimings.reduce((a, b) => a + b, 0) / requestTimings.length;
    expect(avgRequestTime).toBeLessThan(1000);
  });

  test('should optimize for slow network conditions', async ({ page, context }) => {
    // Simulate slow 3G connection
    await context.route('**/*', async (route) => {
      // Add delay to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });
    
    const loadStart = Date.now();
    await page.goto('/', { timeout: 30000 });
    
    // Should show loading states
    const loadingElements = page.locator('[role="status"], .loading, text=読み込み中');
    if (await loadingElements.count() > 0) {
      await expect(loadingElements.first()).toBeVisible();
    }
    
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - loadStart;
    
    console.log(`Slow network load time: ${loadTime}ms`);
    
    // Should still load within reasonable time
    expect(loadTime).toBeLessThan(15000);
    
    // Content should be visible
    await expect(page.locator('text=RAG Web UI')).toBeVisible();
  });

  test('should implement efficient lazy loading', async ({ page }) => {
    await page.goto('/documents');
    
    // Mock large number of documents
    await page.route('**/api/documents', async (route) => {
      const documents = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc-${i}`,
        fileName: `document-${i}.pdf`,
        fileSize: 1024000,
        status: 'completed',
        uploadedAt: new Date().toISOString(),
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(documents),
      });
    });
    
    await page.reload();
    
    // Initial render should be fast
    const renderStart = Date.now();
    await page.waitForSelector('text=document-0.pdf');
    const initialRender = Date.now() - renderStart;
    
    console.log(`Initial render time: ${initialRender}ms`);
    expect(initialRender).toBeLessThan(2000);
    
    // Not all items should be in DOM initially
    const visibleItems = page.locator('[data-testid="document-item"]');
    const itemCount = await visibleItems.count();
    
    // Should render only visible items (virtual scrolling or pagination)
    expect(itemCount).toBeLessThan(100);
  });
});