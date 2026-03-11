import { useEffect, useRef, useState } from 'react';
import { TrackedChange } from '@/lib/export-utils';
import { applyChangesToDocx, docxBytesToHtml } from '@/lib/doc-utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentPreviewProps {
  originalBytes: ArrayBuffer;
  originalHtml: string;
  fileName: string;
  changes: TrackedChange[];
}

export function DocumentPreview({ originalBytes, originalHtml, fileName, changes }: DocumentPreviewProps) {
  const [showChanges, setShowChanges] = useState(true);
  const [previewHtml, setPreviewHtml] = useState(originalHtml);
  const contentRef = useRef<HTMLDivElement>(null);

  const appliedChanges = changes.filter(c => c.applied);

  useEffect(() => {
    let cancelled = false;

    async function update() {
      if (appliedChanges.length === 0) {
        setPreviewHtml(originalHtml);
        return;
      }
      try {
        const changeList = appliedChanges.map(c => ({ oldText: c.oldText, newText: c.newText }));
        const modifiedBytes = await applyChangesToDocx(originalBytes, changeList);
        const html = await docxBytesToHtml(modifiedBytes);
        if (!cancelled) setPreviewHtml(html);
      } catch (err) {
        console.error('Failed to apply changes for preview:', err);
      }
    }

    update();
    return () => { cancelled = true; };
  }, [originalBytes, originalHtml, appliedChanges.length, changes]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-card">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {appliedChanges.length > 0 ? 'Live Preview' : 'Original Document'}
          </p>
          <h2 className="text-sm font-semibold text-foreground font-sans">{fileName}</h2>
        </div>
      </div>

      {appliedChanges.length > 0 && (
        <div className="border-b border-border bg-secondary/50">
          <button
            onClick={() => setShowChanges(!showChanges)}
            className="w-full px-6 py-2 flex items-center justify-between text-xs hover:bg-secondary transition-colors"
          >
            <span className="text-foreground font-medium">
              {appliedChanges.length} change{appliedChanges.length !== 1 ? 's' : ''} applied
            </span>
            {showChanges ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </button>
          {showChanges && (
            <div className="px-6 pb-3 space-y-2 max-h-48 overflow-y-auto">
              {appliedChanges.map((change) => (
                <div key={change.id} className="text-xs rounded-md bg-card p-3 border border-border">
                  <p className="text-muted-foreground mb-1">{change.explanation || 'Text replacement'}</p>
                  <div className="flex gap-2">
                    <span className="line-through text-destructive/70 flex-1 break-words">"{change.oldText.slice(0, 80)}{change.oldText.length > 80 ? '...' : ''}"</span>
                    <span className="text-foreground flex-1 break-words font-medium">"{change.newText.slice(0, 80)}{change.newText.length > 80 ? '...' : ''}"</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto doc-scroll bg-background">
        <div className="max-w-3xl mx-auto py-12 px-16">
          <div
            ref={contentRef}
            className="prose prose-sm max-w-none text-foreground
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4
              [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3
              [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2
              [&_p]:mb-3 [&_p]:leading-relaxed
              [&_table]:border-collapse [&_table]:w-full [&_table]:mb-4
              [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm
              [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold [&_th]:bg-muted
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
              [&_li]:mb-1
              [&_strong]:font-semibold
              [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}
