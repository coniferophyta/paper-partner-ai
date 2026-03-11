import { saveAs } from 'file-saver';
import { applyChangesToDocx } from './doc-utils';

export interface TrackedChange {
  id: string;
  paragraphId: string;
  oldText: string;
  newText: string;
  explanation: string;
  applied: boolean;
  timestamp: number;
}

/**
 * Export as modified DOCX: applies tracked changes to the original DOCX
 * via surgical XML replacements, preserving all original formatting.
 */
export async function exportAsDocx(
  originalBytes: ArrayBuffer,
  changes: TrackedChange[],
  fileName: string,
) {
  const appliedChanges = changes
    .filter(c => c.applied)
    .map(c => ({ oldText: c.oldText, newText: c.newText }));

  const modifiedBytes = await applyChangesToDocx(originalBytes, appliedChanges);

  const blob = new Blob([modifiedBytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveAs(blob, fileName.replace(/\.docx?$/i, '') + '_edited.docx');
}
