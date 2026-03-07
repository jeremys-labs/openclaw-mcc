import { useCallback, useState } from 'react';

interface Props {
  url: string;
  filename: string;
  /** Raw text content if already fetched (avoids double-fetch) */
  content?: string;
}

function getFileMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    html: 'text/html',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['md', 'txt', 'json', 'html', 'ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'yaml', 'yml', 'toml', 'csv'].includes(ext);
}

export function FileActions({ url, filename, content }: Props) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // --- Print ---
  const handlePrint = useCallback(async () => {
    // For text/markdown files, open a styled print window
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf') {
      // PDFs: open in new tab and let browser print natively
      window.open(url, '_blank');
      return;
    }

    // Fetch content if not already provided
    let text = content;
    if (!text && isTextFile(filename)) {
      try {
        const res = await fetch(url);
        text = await res.text();
      } catch {
        text = '(Unable to load file content)';
      }
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print this file.');
      return;
    }

    const isMarkdown = ext === 'md';
    const escapedContent = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 1in;
      max-width: 8.5in;
      margin: 0 auto;
    }
    h1 { font-size: 16pt; border-bottom: 1px solid #ccc; padding-bottom: 6pt; margin-bottom: 12pt; }
    h2 { font-size: 14pt; margin: 10pt 0 6pt; }
    h3 { font-size: 12pt; margin: 8pt 0 4pt; }
    p { margin-bottom: 8pt; }
    ul, ol { margin-left: 20pt; margin-bottom: 8pt; }
    li { margin-bottom: 2pt; }
    code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f4f4f4; padding: 1pt 3pt; border-radius: 2pt; }
    pre { font-family: 'Courier New', monospace; font-size: 10pt; background: #f4f4f4; padding: 8pt; border-radius: 4pt; white-space: pre-wrap; word-break: break-all; margin-bottom: 8pt; }
    blockquote { border-left: 3pt solid #ccc; padding-left: 10pt; color: #555; margin-bottom: 8pt; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8pt; }
    th, td { border: 1pt solid #ccc; padding: 4pt 8pt; text-align: left; }
    th { background: #f4f4f4; font-weight: bold; }
    hr { border: none; border-top: 1pt solid #ccc; margin: 10pt 0; }
    a { color: #000; text-decoration: underline; }
    .filename { font-size: 9pt; color: #666; margin-bottom: 16pt; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="filename">${filename}</div>
  ${isMarkdown ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:12pt;background:none;padding:0;">${escapedContent}</pre>` : `<pre>${escapedContent}</pre>`}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }, [url, filename, content]);

  // --- Share ---
  const handleShare = useCallback(async () => {
    setSharing(true);
    setShareError(null);

    try {
      const mimeType = getFileMimeType(filename);
      let blob: Blob;

      if (isTextFile(filename) && content) {
        blob = new Blob([content], { type: mimeType });
      } else {
        const res = await fetch(url);
        blob = await res.blob();
      }

      const file = new File([blob], filename, { type: mimeType });

      // Try sharing as a file first (iOS/iPad share sheet → iMessage, AirDrop, etc.)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
      } else if (isTextFile(filename)) {
        // Fallback: share as text (works on more browsers)
        const text = content || await (await fetch(url)).text();
        await navigator.share({
          title: filename,
          text: text,
        });
      } else {
        // Last resort: trigger download
        triggerDownload(blob, filename);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        // AbortError = user cancelled share sheet, not a real error
        setShareError('Share failed');
        setTimeout(() => setShareError(null), 3000);
      }
    } finally {
      setSharing(false);
    }
  }, [url, filename, content]);

  // --- Download (desktop fallback) ---
  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      triggerDownload(blob, filename);
    } catch {
      setShareError('Download failed');
      setTimeout(() => setShareError(null), 3000);
    }
  }, [url, filename]);

  return (
    <div className="flex items-center gap-1.5">
      {/* Share (mobile-first: uses native share sheet on iOS/iPad) */}
      {canShare ? (
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-surface-overlay hover:bg-surface text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          title="Share via iMessage, AirDrop, etc."
        >
          <ShareIcon />
          {sharing ? 'Sharing…' : 'Share'}
        </button>
      ) : (
        /* Desktop: download instead */
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-surface-overlay hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
          title="Download file"
        >
          <DownloadIcon />
          Download
        </button>
      )}

      {/* Print */}
      <button
        onClick={handlePrint}
        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-surface-overlay hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
        title="Print file"
      >
        <PrintIcon />
        Print
      </button>

      {/* Error feedback */}
      {shareError && (
        <span className="text-xs text-red-400">{shareError}</span>
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
