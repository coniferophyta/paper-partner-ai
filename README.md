# Paper Partner AI

An AI-powered legal document assistant that helps you create, edit, and refine legal documents with an intelligent chatbot co-pilot.

![Paper Partner AI](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Tailwind](https://img.shields.io/badge/TailwindCSS-3-teal)

## ✨ Features

- **📄 Document Generation** — Choose from multiple legal document types (NDA, Employment Agreement, Service Agreement, etc.) and fill in structured forms to generate professional DOCX files
- **🤖 AI Chat Co-pilot** — Context-aware legal AI assistant that can explain clauses, suggest improvements, and flag potential risks
- **✏️ Live Document Editing** — AI makes surgical, paragraph-level edits to your document in real-time while preserving all original formatting
- **🔍 Deep Research Mode** — Toggle deep research for thorough legal analysis powered by web search
- **📥 DOCX Export** — Download your edited document as a properly formatted Word file with all changes applied to the original XML structure
- **📊 Change Tracking** — Visual diff of all AI-made edits with old vs. new text comparison

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui
- **Document Processing:** Mammoth.js (DOCX → HTML), JSZip (surgical XML editing)
- **Backend:** Lovable Cloud (Edge Functions for AI chat, document generation, and browser research)
- **AI:** Streaming chat with contextual document awareness

## 🚀 Getting Started

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project
cd paper-partner-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatPanel.tsx        # AI chat interface with markdown rendering
│   ├── DocuWiseStep.tsx     # Document form + generation step
│   ├── DocumentPreview.tsx  # Live DOCX preview with change tracking
│   ├── EditingStep.tsx      # Document editing workspace
│   ├── LandingStep.tsx      # Document type selection
│   ├── ReviewStep.tsx       # Final review before export
│   └── StepIndicator.tsx    # Progress stepper
├── lib/
│   ├── chat-service.ts      # Streaming AI chat client
│   ├── doc-utils.ts         # DOCX parsing & XML manipulation
│   └── export-utils.ts      # Document export with tracked changes
├── pages/
│   └── Index.tsx            # Main app orchestrator
└── supabase/functions/
    ├── chat/                # AI chat edge function
    ├── docuwise-document/   # Document generation edge function
    └── browser-research/    # Deep research edge function
```

## 🔄 Workflow

1. **Choose Type** → Select your legal document type
2. **Fill Details** → Complete the structured form with AI guidance
3. **Edit & Refine** → Review the generated document, ask the AI to make changes
4. **Review & Export** → Final review, then download as `.docx`

## 📝 License

This project is private.
