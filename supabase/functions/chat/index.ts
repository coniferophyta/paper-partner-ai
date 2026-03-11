import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LITELLM_BASE_URL = "https://llm.505labs.ai";
const TFL_BASE_URL = "https://www.tax-fin-lex.si/api/v1";

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
