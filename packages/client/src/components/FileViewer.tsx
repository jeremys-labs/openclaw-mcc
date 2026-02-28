import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  folder: string;
  filename: string;
}

export function FileViewer({ folder, filename }: Props) {
  const [content, setContent] = useState<string>('');
  const ext = filename.split('.').pop()?.toLowerCase();

  useEffect(() => {
    fetch(`/api/files/${folder}/${filename}`)
      .then((r) => r.text())
      .then(setContent);
  }, [folder, filename]);

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <img src={`/api/files/${folder}/${filename}`} alt={filename} className="max-w-full" />;
  }

  if (ext === 'md') {
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  if (ext === 'json') {
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2);
      return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{formatted}</pre>;
    } catch {
      return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{content}</pre>;
    }
  }

  return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{content}</pre>;
}
