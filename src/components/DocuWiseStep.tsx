import { ChatPanel, ChatMessage } from './ChatPanel';

interface DocuWiseStepProps {
  docType: string;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  streamingContent: string;
  onSendChatMessage: (message: string) => void;
  onDocuWiseComplete: () => void;
}

export function DocuWiseStep({
  docType,
  chatMessages,
  isChatLoading,
  streamingContent,
  onSendChatMessage,
  onDocuWiseComplete,
}: DocuWiseStepProps) {
  const docuWiseUrl = 'https://app.docuwise.eu/en/share/4a65057f-5248-4e52-9fe2-239269626851';

  return (
    <div className="flex-1 flex h-full min-h-0">
      {/* Left: DocuWise iframe */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">DocuWise Form</p>
            <h2 className="text-sm font-semibold text-foreground">Fill in document details</h2>
          </div>
          <button
            onClick={onDocuWiseComplete}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Continue to Editing →
          </button>
        </div>
        <div className="flex-1 bg-background">
          <iframe
            src={docuWiseUrl}
            className="w-full h-full border-0"
            title="DocuWise Form"
          />
        </div>
      </div>

      {/* Right: Chat */}
      <div className="w-[380px] flex-shrink-0">
        <ChatPanel
          messages={chatMessages}
          isLoading={isChatLoading}
          streamingContent={streamingContent}
          onSendMessage={onSendChatMessage}
          title="Document Helper"
          subtitle="Ask questions while filling the form"
          placeholder="Ask about the document fields..."
        />
      </div>
    </div>
  );
}
