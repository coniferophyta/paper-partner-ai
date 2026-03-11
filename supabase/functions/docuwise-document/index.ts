const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'X-API-Key': token,
    'Accept': 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const accessToken = Deno.env.get('DOCUWISE_ACCESS_TOKEN');
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'DOCUWISE_ACCESS_TOKEN not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, documentId } = await req.json();
    const authHeaders = getAuthHeaders(accessToken);

    if (action === 'list') {
      const response = await fetch('https://app.docuwise.eu/api/integrations/documents', {
        headers: authHeaders,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Docuwise list error:', response.status, errText);
        return new Response(JSON.stringify({ error: `Docuwise API error ${response.status}: ${errText}` }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'download' && documentId) {
      const metaResponse = await fetch(`https://app.docuwise.eu/api/integrations/documents/${documentId}`, {
        headers: authHeaders,
      });

      if (!metaResponse.ok) {
        const errText = await metaResponse.text();
        return new Response(JSON.stringify({ error: `Failed to get document: ${errText}` }), {
          status: metaResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const meta = await metaResponse.json();
      console.log('Document metadata:', JSON.stringify(meta).slice(0, 3000));

      const fileUrl = meta.docx_path || meta.file_url || meta.docx_url || meta.download_url
        || meta.url || meta.document_url;

      if (!fileUrl) {
        return new Response(JSON.stringify({ metadata: meta, error: 'No download URL found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to download file' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fileBytes = await fileResponse.arrayBuffer();
      return new Response(fileBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${meta.name || meta.title || 'document'}.docx"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "list" or "download".' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
