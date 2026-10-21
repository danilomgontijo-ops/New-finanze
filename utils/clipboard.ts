import DOMPurify from 'dompurify';

const WORD_STYLES = `
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; text-align: justify; }
  h3 { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 12pt; font-weight: bold; color: #002f4d; margin-top: 14pt; margin-bottom: 4pt; text-transform: uppercase; }
  p { margin-top: 0; margin-bottom: 8pt; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; }
  strong { font-weight: bold; color: #0f172a; }
  ul { margin-top: 0; margin-bottom: 8pt; padding-left: 20pt; list-style-type: disc; }
  li { margin-bottom: 3pt; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; }
`;

/**
 * Copies HTML content to the clipboard with Word-friendly styling (plus a plain-text alternative).
 * Uses the async Clipboard API when available and falls back to a hidden DOM selection.
 * Resolves to true when the copy succeeded.
 */
export const copyFormattedHtml = async (content: string): Promise<boolean> => {
  if (!content) return false;

  const htmlContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const styledHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${WORD_STYLES}</style></head><body><div>${htmlContent}</div></body></html>`;
  const plainText = content.replace(/<[^>]+>/g, '');

  const fallbackDOMCopy = (): boolean => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = DOMPurify.sanitize(styledHtml);
    tempElement.style.position = 'fixed';
    tempElement.style.left = '-9999px';
    tempElement.style.top = '-9999px';
    document.body.appendChild(tempElement);

    const range = document.createRange();
    range.selectNodeContents(tempElement);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    try {
      return document.execCommand('copy');
    } catch (e) {
      console.error('Fallback copy failed', e);
      return false;
    } finally {
      if (selection) selection.removeAllRanges();
      document.body.removeChild(tempElement);
    }
  };

  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const cleanHtml = DOMPurify.sanitize(styledHtml, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style', 'head', 'meta', 'html', 'body'] });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([cleanHtml], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {
      return fallbackDOMCopy();
    }
  }
  return fallbackDOMCopy();
};
