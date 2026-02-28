import { useEffect, useState } from 'react';
import { FileViewer } from './FileViewer';

interface FileList {
  inbox: string[];
  approved: string[];
  archive: string[];
}

export function FileReview() {
  const [files, setFiles] = useState<FileList>({ inbox: [], approved: [], archive: [] });
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'approved' | 'archive'>('inbox');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const refresh = () => fetch('/api/files').then((r) => r.json()).then(setFiles);

  useEffect(() => { refresh(); }, []);

  const moveFile = async (filename: string, from: string, to: string) => {
    await fetch(`/api/files/${from}/${filename}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    setSelectedFile(null);
    refresh();
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-white/10 flex flex-col">
        <div className="flex border-b border-white/10">
          {(['inbox', 'approved', 'archive'] as const).map((folder) => (
            <button
              key={folder}
              onClick={() => { setActiveFolder(folder); setSelectedFile(null); }}
              className={`flex-1 px-2 py-2 text-xs capitalize ${
                activeFolder === folder ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {folder} ({files[folder]?.length || 0})
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {files[activeFolder]?.map((filename) => (
            <button
              key={filename}
              onClick={() => setSelectedFile(filename)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${
                selectedFile === filename ? 'bg-accent/20' : 'hover:bg-surface-overlay'
              }`}
            >
              {filename}
            </button>
          ))}
          {files[activeFolder]?.length === 0 && (
            <div className="text-xs text-text-secondary p-2">No files</div>
          )}
        </div>
      </div>

      <div className="flex-1">
        {selectedFile ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <span className="text-sm font-medium">{selectedFile}</span>
              <div className="ml-auto flex gap-2">
                {activeFolder === 'inbox' && (
                  <button
                    onClick={() => moveFile(selectedFile, 'inbox', 'approved')}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white"
                  >
                    Approve
                  </button>
                )}
                {activeFolder !== 'archive' && (
                  <button
                    onClick={() => moveFile(selectedFile, activeFolder, 'archive')}
                    className="px-3 py-1 text-xs bg-surface-overlay hover:bg-surface rounded text-text-secondary"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <FileViewer folder={activeFolder} filename={selectedFile} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary text-sm">
            Select a file to review
          </div>
        )}
      </div>
    </div>
  );
}
