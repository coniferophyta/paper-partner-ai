import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LITELLM_BASE_URL = "https://llm.505labs.ai";
const TFL_BASE_URL = "https://www.tax-fin-lex.si/api/v1";

const NDA_TEMPLATE = `NON-DISCLOSURE AGREEMENT TEMPLATE (DocuWise Form Template)

1 PARTIES
This Non-Disclosure Agreement ("Agreement") is entered into on {{ effective_date }} (the "Effective Date"), by and between:
- Disclosing Party: company ({{ disclosing_company_name }}, reg. {{ disclosing_company_reg }}, address {{ disclosing_address }}, represented by {{ disclosing_representative }}) OR individual ({{ disclosing_name }}, address {{ disclosing_address }})
- Receiving Party: company ({{ receiving_company_name }}, reg. {{ receiving_company_reg }}, address {{ receiving_address }}, represented by {{ receiving_representative }}) OR individual ({{ receiving_name }}, address {{ receiving_address }})

2 PURPOSE
The Parties agree to exchange certain confidential information for the purpose of {{ purpose_of_agreement }}.

3 DEFINITION OF CONFIDENTIAL INFORMATION
3.1 The Receiving Party agrees not to disclose, copy, clone, or modify any confidential information related to the Disclosing Party.
3.2 "Confidential information" refers to any data/information related to the Disclosing Party, including discoveries, processes, techniques, programs, knowledge bases, customer lists, potential customers, business partners, affiliated partners, leads, know-how, or any other services.

4 OBLIGATIONS OF THE RECEIVING PARTY
4.1.1 Treat all Confidential Information as strictly confidential
4.1.2 Not disclose to third parties except employees/collaborators who need access for Section 2 purpose
4.1.3 Use information solely for Section 2 purpose
4.1.4 Prevent unauthorized copying, reproduction, transmission or removal
4.1.5 Implement appropriate technical and organizational security measures

5 PERMITTED DISCLOSURES
5.1.1 Required by law (court, tax authority)
5.1.2 Written consent from Disclosing Party
5.1.3 Necessary for legal proceedings/public administration, with prompt written notice to Disclosing Party

6 RETURN OF CONFIDENTIAL INFORMATION
Upon termination or request: return physical media, irreversibly destroy copies, erase digital versions.

7 TERM
Fixed term of {{ confidentiality_term_years }} years OR indefinite period while information remains secret.

8 OWNERSHIP
Not transferable without written consent of both Parties.

9 LIQUIDATED DAMAGES
{{ liquidated_damages_amount }} EUR per breach. Disclosing Party may claim actual damages exceeding liquidated damages.

10 INDEMNIFICATION
Receiving Party liable for all damages unless proves no fault or force majeure.

11 GOVERNING LAW
Governed by laws of {{ governing_law }}.

12 TERMINATION
Terminates when: term expires; Disclosing Party gives {{ termination_notice_days }} days' written notice. Confidentiality obligations survive termination.

13 AMENDMENTS
Modifications valid only if in writing and signed by both Parties.

14 SIGNATURE AND DATE
Both parties sign with company details or individual details as applicable.`;


async function searchTFL(query: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(`${TFL_BASE_URL}/search?q=${encodeURIComponent(query)}&pageSize=5`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!response.ok) {
      console.error("TFL search failed:", response.status);
      return "";
    }

    const result = await response.json();
    const items = result?.data?.items || [];

    if (items.length === 0) return "";

    const formatted = items.map((item: any, i: number) => {
      const parts = [`[${i + 1}] ${item.title}`];
      if (item.type) parts.push(`Type: ${item.type}`);
      if (item.date) parts.push(`Date: ${item.date}`);
      if (item.contentSnippet) parts.push(`Excerpt: ${item.contentSnippet}`);
      if (item.url) parts.push(`Source: https://www.tax-fin-lex.si${item.url}`);
      return parts.join("\n");
    });

    return formatted.join("\n\n");
  } catch (err) {
    console.error("TFL search error:", err);
    return "";
  }
}

async function extractReferences(text: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(`${TFL_BASE_URL}/references/extract`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return "";

    const result = await response.json();
    const refs = result?.data?.references || [];

    if (refs.length === 0) return "";

    const formatted = refs.map((ref: any) =>
      `- "${ref.text || ref.matchedText}" → ${ref.title || ref.resolvedTitle || ref.rootEntityId || "unknown"}`
    ).join("\n");

    return `\n\nLegal references found in the document:\n${formatted}`;
  } catch (err) {
    console.error("TFL reference extraction error:", err);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LITELLM_API_KEY = Deno.env.get("LITELLM_API_KEY");
    if (!LITELLM_API_KEY) {
      throw new Error("LITELLM_API_KEY is not configured");
    }

    const TFL_API_KEY = Deno.env.get("TFL_API_KEY");

    const { messages, stream = true, documentText } = await req.json();

    // Extract the latest user message for TFL search
    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || "";

    // Search TFL for relevant legal context
    let tflContext = "";
    let refContext = "";

    if (TFL_API_KEY && latestUserMessage) {
      const [searchResults, docRefs] = await Promise.all([
        searchTFL(latestUserMessage, TFL_API_KEY),
        documentText ? extractReferences(documentText.slice(0, 3000), TFL_API_KEY) : Promise.resolve(""),
      ]);
      tflContext = searchResults;
      refContext = docRefs;
    }

    // Enrich the system message with TFL context
    const enrichedMessages = messages.map((msg: any) => {
      if (msg.role === "system") {
        let enrichedContent = msg.content;

        // Always include the NDA template as reference
        enrichedContent += `\n\n---\nNDA DOCUMENT TEMPLATE REFERENCE (this is the template the user is filling out in DocuWise):\n${NDA_TEMPLATE}\n\nUse this template to understand the document structure, explain fields the user needs to fill in (marked with {{ }}), and advise on clause-specific legal implications.`;

        if (tflContext) {
          enrichedContent += `\n\n---\nRELEVANT LEGAL SOURCES FROM TAX-FIN-LEX DATABASE (Slovenian law):\n${tflContext}\n\nUse these sources to ground your answers. Cite them when relevant (e.g., "According to [source title]..."). Always provide the source URL when referencing legislation or court decisions.`;
        }

        if (refContext) {
          enrichedContent += refContext;
        }

        return { ...msg, content: enrichedContent };
      }
      return msg;
    });

    const response = await fetch(`${LITELLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LITELLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "global.anthropic.claude-sonnet-4-6",
        messages: enrichedMessages,
        stream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LiteLLM error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please check your LiteLLM balance." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `LiteLLM error [${response.status}]: ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
