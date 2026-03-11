import { FileText, ArrowRight } from 'lucide-react';

interface LandingStepProps {
  onSelectDocType: (type: string) => void;
}

const documentTypes = [
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement',
    description: 'Protect confidential information shared between parties.',
    icon: FileText,
  },
];

export function LandingStep({ onSelectDocType }: LandingStepProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-10 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-serif text-foreground">Per Partes</h1>
          <p className="text-muted-foreground text-base">
            Create legally sound documents with AI assistance, step by step.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Choose document type
          </p>
          <div className="grid gap-3">
            {documentTypes.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onSelectDocType(doc.id)}
                className="group flex items-center gap-4 w-full rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <doc.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          More document types coming soon.
        </p>
      </div>
    </div>
  );
}
