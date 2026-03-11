import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BU_API_BASE = "https://api.browser-use.com/api/v2";

const LEGAL_SITES = [
  {
    url: "https://cms.law/en/int/expert-guides/cms-expert-guide-to-trade-secrets/slovenia",
    name: "CMS Expert Guide - Trade Secrets (Slovenia)",
    domain: "cms.law",
  },
  {
    url: "https://www.pravnisos.si/pravno-svetovanje-pomoc-in-nasveti/",
    name: "PravniSOS - Legal Advice (Slovenia)",
    domain: "pravnisos.si",
  },
  {
    url: "https://eda.europa.eu/what-we-do/industry-engagement/directories/library/",
    name: "EDA Library - European Defence Agency",
    domain: "eda.europa.eu",
  },
];

async function createTask(apiKey: string, task: string): Promise<string> {
  const response = await fetch(`${BU_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ task }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create BU task [${response.status}]: ${err}`);
  }

  const data = await response.json();
  return data.id;
}

async function pollTask(apiKey: string, taskId: string, timeoutMs = 120000): Promise<any> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${BU_API_BASE}/tasks/${taskId}`, {
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to poll BU task [${response.status}]: ${err}`);
    }

    const data = await response.json();

    if (data.status === "completed" || data.status === "finished") {
      return data;
    }
    if (data.status === "failed" || data.status === "error") {
      throw new Error(`BU task failed: ${data.error || "Unknown error"}`);
    }

    // Wait 3 seconds before polling again
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("BU task timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BROWSER_USE_API_KEY = Deno.env.get("BROWSER_USE_API_KEY");
    if (!BROWSER_USE_API_KEY) {
      throw new Error("BROWSER_USE_API_KEY is not configured");
    }

    const { query, sites } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select which sites to research (default: all configured)
    const targetSites = sites || LEGAL_SITES;

    // Create tasks in parallel for each site
    const taskPromises = targetSites.map(async (site: any) => {
      const taskDescription = `Go to ${site.url}. Search for information relevant to: "${query}". 
Read through the page content, click on relevant links or articles if needed, and look for PDFs or documents that are relevant. 
Extract and summarize all relevant legal information you find. 
If there are PDF links, note their URLs and titles.
Focus on legal content related to: ${query}
Return a comprehensive summary of what you found.`;

      try {
        const taskId = await createTask(BROWSER_USE_API_KEY, taskDescription);
        console.log(`Created BU task ${taskId} for ${site.name}`);
        const result = await pollTask(BROWSER_USE_API_KEY, taskId, 90000);
        return {
          site: site.name,
          url: site.url,
          output: result.output || result.result || "No output",
          status: "success",
        };
      } catch (err) {
        console.error(`BU task failed for ${site.name}:`, err);
        return {
          site: site.name,
          url: site.url,
          output: null,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    });

    const results = await Promise.allSettled(taskPromises);
    const outputs = results.map((r) =>
      r.status === "fulfilled" ? r.value : { status: "failed", error: "Promise rejected" }
    );

    return new Response(
      JSON.stringify({ success: true, results: outputs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("browser-research error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
