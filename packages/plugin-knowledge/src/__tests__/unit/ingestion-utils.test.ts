import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ingestGitHubRepository, ingestWebPage } from '../../ingestion-utils';
import type { GitHubIngestionOptions, WebPageIngestionOptions } from '../../types';

// Mock fetch globally
const mockFetch = mock();
global.fetch = mockFetch as any;

describe('GitHub Repository Ingestion', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('should parse GitHub URL correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            type: 'file',
            name: 'README.md',
            path: 'README.md',
            size: 1000,
            download_url: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('# Test README\nThis is a test file.'),
    });

    const options: GitHubIngestionOptions = {
      repoUrl: 'https://github.com/owner/repo',
    };

    const result = await ingestGitHubRepository(options);

    expect(result.totalFiles).toBe(1);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].filename).toBe('README.md');
    expect(result.documents[0].content).toBe('# Test README\nThis is a test file.');
  });

  it('should filter files by subdirectories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            type: 'file',
            name: 'test.md',
            path: 'docs/test.md',
            size: 500,
            download_url: 'https://raw.githubusercontent.com/owner/repo/main/docs/test.md',
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('# Documentation\nTest content.'),
    });

    const options: GitHubIngestionOptions = {
      repoUrl: 'https://github.com/owner/repo',
      subdirectories: ['docs'],
    };

    const result = await ingestGitHubRepository(options);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].path).toBe('docs/test.md');
  });

  it('should handle GitHub API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const options: GitHubIngestionOptions = {
      repoUrl: 'https://github.com/nonexistent/repo',
      subdirectories: ['nonexistent'],
    };

    const result = await ingestGitHubRepository(options);

    // Should complete but with no processed files
    expect(result.processedFiles).toBe(0);
    expect(result.totalFiles).toBe(0);
  });

  it('should filter large files', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            type: 'file',
            name: 'large-file.txt',
            path: 'large-file.txt',
            size: 10 * 1024 * 1024, // 10MB
            download_url: 'https://raw.githubusercontent.com/owner/repo/main/large-file.txt',
          },
          {
            type: 'file',
            name: 'small-file.txt',
            path: 'small-file.txt',
            size: 1000,
            download_url: 'https://raw.githubusercontent.com/owner/repo/main/small-file.txt',
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('Small file content'),
    });

    const options: GitHubIngestionOptions = {
      repoUrl: 'https://github.com/owner/repo',
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    };

    const result = await ingestGitHubRepository(options);

    expect(result.totalFiles).toBe(2);
    expect(result.documents).toHaveLength(1); // Only small file processed
    expect(result.documents[0].filename).toBe('small-file.txt');
    expect(result.skippedFiles).toBe(1); // Large file skipped
  });
});

describe('Web Page Ingestion', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('should extract text from HTML page', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <main>
            <h1>Main Heading</h1>
            <p>This is a paragraph with sufficient text content to meet the minimum length requirement.</p>
            <p>Another paragraph with meaningful content that should be extracted.</p>
          </main>
          <nav>Navigation menu that should be excluded</nav>
          <script>console.log('script');</script>
        </body>
      </html>
    `;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'text/html',
      },
      text: () => Promise.resolve(mockHtml),
    });

    const options: WebPageIngestionOptions = {
      url: 'https://example.com/test-page',
      minTextLength: 30,
    };

    const result = await ingestWebPage(options);

    expect(result.url).toBe('https://example.com/test-page');
    expect(result.title).toBe('Test Page');
    expect(result.extractedText).toContain('paragraph with sufficient text');
    expect(result.extractedText).not.toContain('Navigation menu');
    expect(result.extractedText).not.toContain('console.log');
    expect(result.textLength).toBeGreaterThan(0);
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const options: WebPageIngestionOptions = {
      url: 'https://unreachable-site.com',
    };

    const result = await ingestWebPage(options);

    expect(result.url).toBe('https://unreachable-site.com');
    expect(result.extractedText).toBe('');
    expect(result.textLength).toBe(0);
    expect(result.error).toContain('Network error');
  });

  it('should handle non-HTML content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      text: () => Promise.resolve('{"error": "not html"}'),
    });

    const options: WebPageIngestionOptions = {
      url: 'https://api.example.com/data.json',
    };

    const result = await ingestWebPage(options);

    expect(result.error).toContain('Not an HTML page');
  });

  it('should filter short text elements', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <p>Short</p>
          <p>This is a longer paragraph that meets the minimum text length requirement and should be included.</p>
          <span>X</span>
        </body>
      </html>
    `;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'text/html',
      },
      text: () => Promise.resolve(mockHtml),
    });

    const options: WebPageIngestionOptions = {
      url: 'https://example.com/test',
      minTextLength: 30,
    };

    const result = await ingestWebPage(options);

    expect(result.extractedText).toContain('longer paragraph');
    expect(result.extractedText).not.toContain('Short');
    expect(result.extractedText).not.toContain('X');
  });
});
