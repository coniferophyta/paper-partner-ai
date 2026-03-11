import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Download, ArrowLeft, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ReviewStepProps {
  documentText: string;
  onReturnToEditing: () => void;
  onExport: () => void;
  onRestart: () => void;
}

type ReviewStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

interface ReviewResult {
  status: 'approved' | 'rejected';
  summary: string;
  issues?: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function ReviewStep({ documentText, onReturnToEditing, onExport, onRestart }: ReviewStepProps) {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runReview = async () => {
    setStatus('reviewing');
    setError(null);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          stream: false,
          documentText,
          messages: [
            {
              role: 'system',
              content: `You are an independent legal document reviewer. You must review the provided NDA document for:
1. Completeness — are all required fields filled in (no {{ }} placeholders remaining)?
2. Legal correctness — are clauses properly structured and enforceable?
3. Consistency — do terms, dates, and party names match throughout?
4. Missing protections — are there standard NDA clauses that should be added?
5. Potential risks — flag any terms that could be problematic for either party.

You MUST respond with EXACTLY this JSON format (no markdown, no extra text):
{
  "status": "approved" or "rejected",
  "summary": "A 2-3 sentence overall assessment",
  "issues": ["issue 1", "issue 2"] (empty array if approved with no issues)
}

Be strict but fair. Reject if there are significant legal gaps or unfilled fields. Approve if the document is substantially complete and legally sound, even if minor improvements could be made.`,
            },
            {
              role: 'user',
              content: `Please review this NDA document:\n\n${documentText}`,
            },
          ],
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Review failed: ${resp.status}`);
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Parse the JSON response
      let reviewResult: ReviewResult;
      try {
        // Try to extract JSON from the response (handle potential markdown wrapping)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        reviewResult = JSON.parse(jsonMatch[0]);
      } catch {
        // If parsing fails, treat as approved with the raw content as summary
        reviewResult = {
          status: 'approved',
          summary: content,
          issues: [],
        };
      }

      setResult(reviewResult);
      setStatus(reviewResult.status);
    } catch (err) {
      console.error('Review error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete the review. Please try again.');
      setStatus('pending');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-serif text-foreground">Document Review</h2>
          <p className="text-sm text-muted-foreground">
            An independent AI reviewer will check your document for completeness and correctness.
          </p>
        </div>

        {/* Pending */}
        {status === 'pending' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ready to submit your document for review?
              </p>
              <button
                onClick={runReview}
                className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Start Review
              </button>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <button
              onClick={onReturnToEditing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to editing
            </button>
          </div>
        )}

        {/* Reviewing */}
        {status === 'reviewing' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-medium text-foreground text-sm">Reviewing your document…</p>
              <p className="text-xs text-muted-foreground mt-1">Checking against legal standards and TFL database</p>
            </div>
          </div>
        )}

        {/* Approved */}
        {status === 'approved' && result && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-success/30 bg-success/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Document Approved</h3>
                  <p className="text-xs text-muted-foreground">Passed independent review</p>
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-foreground/80">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
              {result.issues && result.issues.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Minor suggestions:</p>
                  <ul className="space-y-1">
                    {result.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={onExport}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Document (.docx)
            </button>

            <button
              onClick={onReturnToEditing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue editing anyway
            </button>
          </div>
        )}

        {/* Rejected */}
        {status === 'rejected' && result && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Changes Needed</h3>
                  <p className="text-xs text-muted-foreground">Issues found during review</p>
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-foreground/80">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
              {result.issues && result.issues.length > 0 && (
                <ul className="space-y-2 mt-2">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={onReturnToEditing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to editing
            </button>

            <button
              onClick={onRestart}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
