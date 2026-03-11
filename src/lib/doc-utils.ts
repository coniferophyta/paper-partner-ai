import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface DocumentParagraph {
  id: string;
  text: string;
  pageNumber: number;
}

export interface ParsedDocument {
  paragraphs: DocumentParagraph[];
  originalBytes: ArrayBuffer;
  numPages: number;
  html: string;
}

/**
 * Parse a DOCX file: extract paragraphs for AI context and HTML for preview.
 */
export async function parseDocx(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer: arrayBuffer.slice(0) },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );

  const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
  const rawLines = textResult.value.split('\n').filter(line => line.trim().length > 0);

  const paragraphs: DocumentParagraph[] = rawLines.map((text, i) => ({
    id: `para-${i}`,
    text: text.trim(),
    pageNumber: 1,
  }));

  return {
    paragraphs,
    originalBytes: arrayBuffer,
    numPages: 1,
    html: result.value,
  };
}

/**
 * Apply text changes to the original DOCX by doing surgical XML replacements.
 * Preserves all original formatting, styles, fonts, etc.
 */
export async function applyChangesToDocx(
  originalBytes: ArrayBuffer,
  changes: { oldText: string; newText: string }[],
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(originalBytes.slice(0));

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Invalid DOCX: no document.xml');

  let docXml = await docXmlFile.async('string');

  for (const change of changes) {
    docXml = replaceTextInXml(docXml, change.oldText, change.newText);
  }

  zip.file('word/document.xml', docXml);

  const newBytes = await zip.generateAsync({ type: 'arraybuffer' });
  return newBytes;
}

function replaceTextInXml(xml: string, oldText: string, newText: string): string {
  if (xml.includes(oldText)) {
    return xml.replace(oldText, newText);
  }

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;

  return xml.replace(paragraphRegex, (paraXml) => {
    const textParts: { fullMatch: string; text: string; index: number }[] = [];
    const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let match;

    while ((match = textRegex.exec(paraXml)) !== null) {
      textParts.push({
        fullMatch: match[0],
        text: match[1],
        index: match.index,
      });
    }

    const fullText = textParts.map(p => p.text).join('');

    if (!fullText.includes(oldText)) return paraXml;

    const newFullText = fullText.replace(oldText, newText);

    let result = paraXml;
    let isFirst = true;
    for (const part of textParts) {
      if (isFirst) {
        const newTag = part.fullMatch.replace(
          />([^<]*)<\/w:t>/,
          ` xml:space="preserve">${newFullText}</w:t>`
        );
        result = result.replace(part.fullMatch, newTag);
        isFirst = false;
      } else {
        const emptyTag = part.fullMatch.replace(/>([^<]*)<\/w:t>/, `></w:t>`);
        result = result.replace(part.fullMatch, emptyTag);
      }
    }

    return result;
  });
}

/**
 * Convert modified DOCX bytes to HTML for live preview.
 */
export async function docxBytesToHtml(bytes: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.slice(0) });
  return result.value;
}
