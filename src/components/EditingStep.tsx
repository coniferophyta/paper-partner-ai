import { ChatPanel, ChatMessage } from './ChatPanel';
import { DocumentPreview } from './DocumentPreview';
import { TrackedChange } from '@/lib/export-utils';
import { Download } from 'lucide-react';

interface EditingStepProps {
  originalBytes: ArrayBuffer;
  originalHtml: string;
  fileName: string;
  changes: TrackedChange[];
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  streamingContent: string;
  onSendChatMessage: (message: string, deepResearch?: boolean) => void;
  onSubmitForReview: () => void;
  onExport: () => void;
}

export function EditingStep({
  originalBytes,
  originalHtml,
  fileName,
  changes,
  chatMessages,
  isChatLoading,
  streamingContent,
  onSendChatMessage,
  onSubmitForReview,
  onExport,
}: EditingStepProps) {
  return (
    <div className="flex-1 flex h-full min-h-0">
      {/* Left: Document preview */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <DocumentPreview
          originalBytes={originalBytes}
          originalHtml={originalHtml}
          fileName={fileName}
          changes={changes}
        />
      </div>

      {/* Right: Chat */}
      <div className="w-[380px] flex-shrink-0">
        <ChatPanel
          messages={chatMessages}
          isLoading={isChatLoading}
          streamingContent={streamingContent}
          onSendMessage={onSendChatMessage}
          title="Legal Editor"
          subtitle="Request changes or ask about clauses"
          placeholder="Ask about the document or request changes..."
          showDeepResearch
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-chat-muted text-chat-foreground/70 hover:text-chat-foreground transition-colors"
              >
                <Download className="w-3 h-3" />
                .docx
              </button>
              <button
                onClick={onSubmitForReview}
                className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                Submit for Review
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
