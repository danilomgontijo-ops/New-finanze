import React from 'react';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  text: string;
  className?: string;
}

/**
 * Renders AI summaries / answers (light markdown + HTML), normalizing line breaks around
 * ACHADO / CONDIÇÃO / ANÁLISE / CONCLUSÃO headers, and sanitizing the result.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  text,
  className = 'text-slate-700 text-xs sm:text-sm leading-relaxed text-justify',
}) => {
  if (!text) return null;
  const formattedText = text
    .replace(/\r\n/g, '\n')
    // Guarantee line breaks before key headers if lumped
    .replace(/([^\n])\s*(ACHADO\s*[\d\w/]+|TÓPICO\s*[\d\w/]+):/gi, '$1\n\n$2:')
    // Guarantee line break AFTER ACHADO/TÓPICO header title line
    .replace(/((?:ACHADO|TÓPICO)[^\n]+)\n*(?=[^\n])/gi, '$1\n\n')
    .replace(/([^\n])\s*(-|•)?\s*(\*\*?(?:CONDIÇÃO|SITUAÇÃO ENCONTRADA))/gi, '$1\n\n- $3')
    .replace(/([^\n])\s*(-|•)?\s*(\*\*?(?:ANÁLISE DA EQUIPE|ANÁLISE TÉCNICA))/gi, '$1\n\n- $3')
    .replace(/([^\n])\s*(-|•)?\s*(\*\*?(?:CONCLUSÃO|RECOMENDAÇÃO|ENCAMINHAMENTO))/gi, '$1\n\n- $3')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  const processedText = DOMPurify.sanitize(formattedText, {
    ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'a', 'strong', 'b', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'code', 'pre'],
    ADD_ATTR: ['class', 'style', 'href', 'target', 'rel', 'colspan', 'rowspan'],
  });

  return <div className={className} dangerouslySetInnerHTML={{ __html: processedText }} />;
};

export default MarkdownRenderer;
