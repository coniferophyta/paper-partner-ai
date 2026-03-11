import { useState, useCallback, useRef } from 'react';
import { StepIndicator } from '@/components/StepIndicator';
import { LandingStep } from '@/components/LandingStep';
import { DocuWiseStep } from '@/components/DocuWiseStep';
import { EditingStep } from '@/components/EditingStep';
import { ReviewStep } from '@/components/ReviewStep';
import { ChatMessage } from '@/components/ChatPanel';
import { streamChat } from '@/lib/chat-service';
import { parseDocx, DocumentParagraph } from '@/lib/doc-utils';
import { TrackedChange, exportAsDocx } from '@/lib/export-utils';
import { toast } from 'sonner';

const STEPS = ['Choose Type', 'Fill Details', 'Edit & Refine', 'Review'];

interface DocumentEdit {
  paragraphId: string;
  oldText: string;
  newText: string;
  explanation: string;
}

function parseEditsFromResponse(response: string, paragraphs: DocumentParagraph[]): { message: string; edits: DocumentEdit[] } {
  const edits: DocumentEdit[] = [];
  const editRegex = /```edit\s*\nPARAGRAPH_ID:\s*(para-\d+)\s*\nOLD:\s*([\s\S]*?)\nNEW:\s*([\s\S]*?)\n```/g;

  let match;
  while ((match = editRegex.exec(response)) !== null) {
    const paragraphId = match[1].trim();
    const oldText = match[2].trim();
    const newText = match[3].trim();

    const paragraph = paragraphs.find(p => p.id === paragraphId);
    if (paragraph && paragraph.text.includes(oldText)) {
      edits.push({ paragraphId, oldText, newText, explanation: '' });
    }
  }

  const cleanMessage = response.replace(/```edit[\s\S]*?```/g, '').trim();
  return { message: cleanMessage, edits };
}

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [docType, setDocType] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Document state — paragraph-based for surgical editing
  const [paragraphs, setParagraphs] = useState<DocumentParagraph[]>([]);
  const [originalHtml, setOriginalHtml] = useState('');
  const [fileName, setFileName] = useState('');
  const [changes, setChanges] = useState<TrackedChange[]>([]);
  const originalBytesRef = useRef<ArrayBuffer | null>(null);

  const handleSelectDocType = useCallback((type: string) => {
    setDocType(type);
    setChatMessages([
      {
        role: 'assistant',
        content: `Welcome! I'm your **legal AI assistant** for creating a **${type.toUpperCase()}** document.\n\nWhile you fill in the form on the left, feel free to ask me:\n- 📋 What each field means legally\n- ⚖️ How to phrase specific clauses\n- 🔍 What terms to watch out for\n- 💡 Best practices for this document type\n\nI'm here to help — just type your question below.`,
      },
    ]);
    setCurrentStep(2);
  }, []);

  const handleDocuWiseComplete = useCallback(async (docBytes: ArrayBuffer, name: string) => {
    try {
      const blob = new Blob([docBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const file = new File([blob], name, { type: blob.type });

      const parsed = await parseDocx(file);
      if (parsed.paragraphs.length === 0) {
        toast.error('Could not extract text from the document.');
        return;
      }

      originalBytesRef.current = parsed.originalBytes;
      setParagraphs(parsed.paragraphs);
      setOriginalHtml(parsed.html);
      setFileName(name);
      setChanges([]);

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Your document is loaded and ready for editing! 📄 (${parsed.paragraphs.length} paragraphs)\n\nYou can now:\n- 🔍 Ask me to **explain any clause** in the document\n- ✏️ Request **wording changes** or improvements\n- ⚠️ Ask me to **identify potential legal risks**\n- 📝 Request **additional clauses** to strengthen the agreement\n\nWhen you're satisfied, click **"Submit for Review"** in the top right.`,
        },
      ]);
      setCurrentStep(3);
      toast.success(`Document loaded — ${parsed.paragraphs.length} paragraphs ready for editing`);
    } catch (err) {
      console.error('Failed to parse docx:', err);
      toast.error('Failed to parse the document.');
    }
  }, []);

  const handleSendChatMessage = useCallback(
    async (content: string, deepResearch?: boolean) => {
      const userMessage: ChatMessage = { role: 'user', content };
      const allMessages = [...chatMessages, userMessage];
      setChatMessages(allMessages);
      setIsChatLoading(true);
      setStreamingContent('');

      let assistantSoFar = '';

      // Build document context from paragraphs
      const docContent = paragraphs.length > 0
        ? paragraphs.map(p => `[${p.id}]: ${p.text}`).join('\n\n')
        : '';
      const documentText = paragraphs.map(p => p.text).join('\n');

      const systemContent = `You are an expert legal AI assistant specializing in ${docType.toUpperCase()} documents and contract law. Your role:
- Explain legal terminology in plain language
- Advise on clause wording, enforceability, and common pitfalls
- Flag potential legal risks or missing protections
- Suggest standard legal provisions when relevant
- Always note that you provide legal information, not legal advice, and recommend consulting a licensed attorney for binding decisions
Be concise, professional, and precise. Use legal terminology where appropriate but always explain it.

${docContent ? `DOCUMENT CONTENT (each paragraph has an ID in brackets):
${docContent}

EDITING RULES:
1. When the user asks you to explain something, explain it in simple, clear language.
2. When the user asks you to edit/change/modify the document, respond with your explanation AND include edit commands.
3. For edits, you MUST use this exact format in your response - include one or more EDIT blocks:

\`\`\`edit
PARAGRAPH_ID: para-X
OLD: exact text to find in that paragraph
NEW: replacement text
\`\`\`

4. Only edit the specific parts that need changing. Keep everything else exactly as is.
5. The OLD text must be an EXACT substring of the paragraph text. Match it precisely including punctuation and spacing.
6. You can include multiple edit blocks for multiple changes.
7. Always explain what you changed and why after the edit blocks.
8. If the user's request is unclear, ask clarifying questions before making edits.
9. Be helpful and proactive - suggest improvements when you see issues.` : ''}`;

      try {
        await streamChat({
          documentText: documentText || undefined,
          deepResearch,
          messages: [
            { role: 'system', content: systemContent },
            ...allMessages,
          ],
          onDelta: (chunk) => {
            assistantSoFar += chunk;
            // Strip edit blocks from streaming display
            const displayContent = assistantSoFar.replace(/```edit[\s\S]*?```/g, '✏️ *Applying edit...*').replace(/```edit[\s\S]*$/g, '✏️ *Preparing edit...*');
            setStreamingContent(displayContent.trim());
          },
          onDone: () => {
            setStreamingContent('');

            // Parse edits from response
            const { message, edits } = parseEditsFromResponse(assistantSoFar, paragraphs);

            if (edits.length > 0) {
              // Apply edits to paragraphs
              setParagraphs(prev => {
                const updated = [...prev];
                for (const edit of edits) {
                  const idx = updated.findIndex(p => p.id === edit.paragraphId);
                  if (idx !== -1) {
                    updated[idx] = {
                      ...updated[idx],
                      text: updated[idx].text.replace(edit.oldText, edit.newText),
                    };
                  }
                }
                return updated;
              });

              // Track changes for export
              const newChanges: TrackedChange[] = edits.map((edit, i) => ({
                id: `change-${Date.now()}-${i}`,
                paragraphId: edit.paragraphId,
                oldText: edit.oldText,
                newText: edit.newText,
                explanation: edit.explanation,
                applied: true,
                timestamp: Date.now(),
              }));
              setChanges(prev => [...prev, ...newChanges]);
              toast.success(`Applied ${edits.length} change(s) to document`);
            }

            setChatMessages((prev) => [
              ...prev,
              { role: 'assistant', content: message },
            ]);
            setIsChatLoading(false);
          },
        });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to get AI response.');
        setStreamingContent('');
        setIsChatLoading(false);
      }
    },
    [chatMessages, docType, paragraphs]
  );

  const handleSubmitForReview = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const handleReturnToEditing = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleExport = useCallback(async () => {
    if (!originalBytesRef.current) {
      toast.error('No document to export.');
      return;
    }

    try {
      await exportAsDocx(originalBytesRef.current, changes, fileName);
      toast.success('Document downloaded');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export document.');
    }
  }, [changes, fileName]);

  const handleGoBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleRestart = useCallback(() => {
    setCurrentStep(1);
    setDocType('');
    setChatMessages([]);
    setParagraphs([]);
    setOriginalHtml('');
    setFileName('');
    setChanges([]);
    originalBytesRef.current = null;
  }, []);

  const documentText = paragraphs.map(p => p.text).join('\n');

  return (
    <div className="h-screen flex flex-col bg-background">
      <StepIndicator currentStep={currentStep} steps={STEPS} onBack={handleGoBack} />

      <div className="flex-1 flex min-h-0">
        {currentStep === 1 && <LandingStep onSelectDocType={handleSelectDocType} />}

        {currentStep === 2 && (
          <DocuWiseStep
            docType={docType}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            streamingContent={streamingContent}
            onSendChatMessage={handleSendChatMessage}
            onDocuWiseComplete={handleDocuWiseComplete}
          />
        )}

        {currentStep === 3 && originalBytesRef.current && (
          <EditingStep
            originalBytes={originalBytesRef.current}
            originalHtml={originalHtml}
            fileName={fileName}
            changes={changes}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            streamingContent={streamingContent}
            onSendChatMessage={handleSendChatMessage}
            onSubmitForReview={handleSubmitForReview}
            onExport={handleExport}
          />
        )}

        {currentStep === 4 && (
          <ReviewStep
            documentText={documentText}
            onReturnToEditing={handleReturnToEditing}
            onExport={handleExport}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
