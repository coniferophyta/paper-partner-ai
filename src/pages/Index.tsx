import { useState, useCallback, useRef } from 'react';
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

  const handleSelectDocType = useCallback((type: string) => {
    setDocType(type);
    setCurrentStep(2);
  }, []);

  const handleDocuWiseComplete = useCallback(() => {
    // TODO: Fetch generated docx from DocuWise, parse to HTML/text
    // For now, set placeholder content
    setDocumentHtml('<h1>Non-Disclosure Agreement</h1><p>This agreement is entered into by and between the parties identified herein...</p><p><em>Document content will be populated from DocuWise output.</em></p>');
    setDocumentText('Non-Disclosure Agreement\nThis agreement is entered into by and between the parties identified herein...');
    setFileName('NDA_Document.docx');
    setCurrentStep(3);
    toast.success('Document loaded — ready for editing');
  }, []);

  const handleSendChatMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: 'user', content };
      setChatMessages((prev) => [...prev, userMessage]);
      setIsChatLoading(true);
      setStreamingContent('');

      // TODO: Replace with actual Claude API call via edge function
      // Placeholder response
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content:
            'I\'m the AI assistant placeholder. Once you connect your Claude API, I\'ll be able to help you with your document. For now, the chat interface is ready and working!',
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error(err);
        toast.error('Failed to get AI response.');
      } finally {
        setIsChatLoading(false);
        setStreamingContent('');
      }
    },
    []
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
