import { useState } from 'react';
import { Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { ChatPanel, ChatMessage } from './ChatPanel';

interface DocuWiseStepProps {
  docType: string;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  streamingContent: string;
  onSendChatMessage: (message: string, deepResearch?: boolean) => void;
  onDocuWiseComplete: (docBytes: ArrayBuffer, fileName: string) => void;
}

const DOCUWISE_SHARE_URL = 'https://app.docuwise.eu/en/share/4a65057f-5248-4e52-9fe2-239269626851';

export function DocuWiseStep({
  docType,
  chatMessages,
  isChatLoading,
  streamingContent,
  onSendChatMessage,
  onDocuWiseComplete,
}: DocuWiseStepProps) {
  const [status, setStatus] = useState<'filling' | 'fetching' | 'error'>('filling');
  const [error, setError] = useState('');

  const fetchLatestDocument = async () => {
    setStatus('fetching');
    setError('');

    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/docuwise-document`;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    try {
      // Step 1: List documents to get the latest one
      const listResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body: JSON.stringify({ action: 'list' }),
      });

      if (!listResponse.ok) {
        const errData = await listResponse.text();
        throw new Error(`Failed to list documents: ${errData}`);
      }

      const documents = await listResponse.json();
      const docList = Array.isArray(documents)
        ? documents
        : documents.data || documents.documents || documents.results || [];

      if (!docList || docList.length === 0) {
        throw new Error('No documents found. Please submit the form first, then try again.');
      }

      const latestDoc = docList[docList.length - 1];
      const documentId = latestDoc.id || latestDoc.document_id;

      // Step 2: Download the document
      const downloadResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body: JSON.stringify({ action: 'download', documentId }),
      });

      if (!downloadResponse.ok) {
        const errData = await downloadResponse.text();
        throw new Error(`Failed to download document: ${errData}`);
      }

      const contentType = downloadResponse.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const jsonData = await downloadResponse.json();
        throw new Error(jsonData.error || 'Unexpected response format');
      }

      const bytes = await downloadResponse.arrayBuffer();
      const title = latestDoc.title || latestDoc.name || 'docuwise-document';
      onDocuWiseComplete(bytes, `${title}.docx`);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch document');
      setStatus('error');
    }
  };

  return (
    <div className="flex-1 flex h-full min-h-0">
      {/* Left: DocuWise iframe */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">DocuWise Form</p>
            <h2 className="text-sm font-semibold text-foreground">Fill in document details</h2>
          </div>

          {status === 'filling' && (
            <button
              onClick={fetchLatestDocument}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue to Editing
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {status === 'fetching' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Fetching your document...
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-destructive max-w-xs truncate">{error}</span>
              <button
                onClick={fetchLatestDocument}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
              <button
                onClick={() => setStatus('filling')}
                className="px-3 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <iframe
            src={DOCUWISE_SHARE_URL}
            className="w-full h-full border-0"
            title="DocuWise Form"
            allow="clipboard-write"
          />

          {status === 'fetching' && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-card rounded-2xl p-8 shadow-lg border border-border text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Fetching your document...</h2>
                <p className="text-sm text-muted-foreground">
                  Retrieving the latest generated document from DocuWise
                </p>
              </div>
            </div>
          )}
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
          showDeepResearch
        />
      </div>
    </div>
  );
}
