import { useState, useCallback, useRef } from 'react';
import mammoth from 'mammoth';
import { StepIndicator } from '@/components/StepIndicator';
import { LandingStep } from '@/components/LandingStep';
import { DocuWiseStep } from '@/components/DocuWiseStep';
import { EditingStep } from '@/components/EditingStep';
import { ReviewStep } from '@/components/ReviewStep';
import { ChatMessage } from '@/components/ChatPanel';
import { streamChat } from '@/lib/chat-service';
import { toast } from 'sonner';

const STEPS = ['Choose Type', 'Fill Details', 'Edit & Refine', 'Review'];

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [docType, setDocType] = useState('');

  // Chat state (shared context between steps 2 & 3)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Document state for editing (step 3)
  const [documentHtml, setDocumentHtml] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [fileName, setFileName] = useState('');
  const docBytesRef = useRef<ArrayBuffer | null>(null);

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
      docBytesRef.current = docBytes;
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer: docBytes });
      const textResult = await mammoth.extractRawText({ arrayBuffer: docBytes });
      setDocumentHtml(htmlResult.value);
      setDocumentText(textResult.value);
      setFileName(name);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Your document is loaded and ready for review! 📄\n\nYou can now:\n- 🔍 Ask me to **explain any clause** in the document\n- ✏️ Request **wording changes** or improvements\n- ⚠️ Ask me to **identify potential legal risks**\n- 📝 Request **additional clauses** to strengthen the agreement\n\nWhen you're satisfied, click **"Submit for Review"** in the top right.`,
        },
      ]);
      setCurrentStep(3);
      toast.success(`Document loaded — ready for editing`);
    } catch (err) {
      console.error('Failed to parse docx:', err);
      toast.error('Failed to parse the document.');
    }
  }, []);

  const handleSendChatMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: 'user', content };
      const allMessages = [...chatMessages, userMessage];
      setChatMessages(allMessages);
      setIsChatLoading(true);
      setStreamingContent('');

      let assistantSoFar = '';

      try {
        await streamChat({
          messages: [
            {
              role: 'system',
              content: `You are a helpful legal AI assistant for creating ${docType.toUpperCase()} documents. Help the user understand legal terms, fill in fields, and review clauses. Be concise and professional.`,
            },
            ...allMessages,
          ],
          onDelta: (chunk) => {
            assistantSoFar += chunk;
            setStreamingContent(assistantSoFar);
          },
          onDone: () => {
            setStreamingContent('');
            setChatMessages((prev) => [
              ...prev,
              { role: 'assistant', content: assistantSoFar },
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
    [chatMessages, docType]
  );

  const handleSubmitForReview = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const handleReturnToEditing = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleExport = useCallback(() => {
    // TODO: Implement actual docx export
    toast.info('Export functionality will be available once integrations are configured.');
  }, []);

  const handleGoBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleRestart = useCallback(() => {
    setCurrentStep(1);
    setDocType('');
    setChatMessages([]);
    setDocumentHtml('');
    setDocumentText('');
    setFileName('');
  }, []);

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

        {currentStep === 3 && (
          <EditingStep
            documentHtml={documentHtml}
            fileName={fileName}
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
