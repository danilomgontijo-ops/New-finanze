import { Demand } from '../types';

export interface ParsedObservationNote {
  id: string;
  date: Date;
  dateStr: string; // 'DD/MM/YYYY'
  title: string;
  prazoDias: number | null; // null if sem prazo
  limitDateStr?: string;
  isConcluded: boolean;
  concludedDateStr?: string;
  headerHtml: string;
  bodyHtml: string;
  rawBlockHtml: string;
  hasExplicitDate?: boolean;
}

export interface NoteDeadlineInfo {
  note: ParsedObservationNote;
  daysElapsed: number;
  daysRemaining: number;
  status: 'critical' | 'warning' | 'normal';
}

export interface DemandDeadlineInfo {
  activeNotes: NoteDeadlineInfo[];
  mostCriticalNote?: NoteDeadlineInfo;
  status: 'normal' | 'warning' | 'critical' | 'completed';
  isMonitored: boolean;
  totalActiveNotes: number;
  latestTitle?: string;
  formattedLastObsDate: string;
  daysElapsed: number;
  targetDaysLimit: number;
}

/**
 * Parses a PT-BR date string (DD/MM/YYYY) into a Date object.
 */
export const parsePtBrDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a Date object to DD/MM/YYYY
 */
export const formatPtBrDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a Date to YYYY-MM-DD (local time) for input[type="date"].
 * Avoids toISOString(), which is UTC and returns the next day after 21h in Brasília.
 */
export const formatIsoInputDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const decodeHtmlEntities = (text: string): string =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/**
 * Checks if HTML string has real text content
 */
export const hasObservationContent = (htmlContent?: string | null): boolean => {
  if (!htmlContent) return false;
  const clean = htmlContent.replace(/<[^>]*>/g, '').trim();
  return clean.length > 0;
};

/**
 * Parses observation HTML into structured ParsedObservationNote objects.
 * Accurately parses each distinct note without modifying, altering, or inferring notes from body text.
 */
export const parseObservations = (htmlContent?: string | null): ParsedObservationNote[] => {
  if (!htmlContent || !hasObservationContent(htmlContent)) return [];

  const sanitizedContent = htmlContent.trim();

  // 1. If structured .observation-note-card entries are present, parse them with 100% precision
  if (sanitizedContent.includes('observation-note-card')) {
    const cardRegex = /<div[^>]*class="[^"]*observation-note-card[^"]*"([^>]*)>([\s\S]*?)<\/div>(?=\s*<div[^>]*class="[^"]*observation-note-card|\s*$)/gi;
    const cards: ParsedObservationNote[] = [];
    let match;
    let cardIdx = 0;

    while ((match = cardRegex.exec(sanitizedContent)) !== null) {
      const attrs = match[1] || '';
      const content = match[2] || '';

      const dateMatch = /data-date="([^"]+)"/i.exec(attrs);
      const prazoMatch = /data-prazo="([^"]+)"/i.exec(attrs);
      const limitMatch = /data-limit="([^"]*)"/i.exec(attrs);
      const concludedMatch = /data-concluded="true"/i.test(attrs);
      const concludedDateMatch = /data-concluded-date="([^"]*)"/i.exec(attrs);

      const headerMatch = /<p[^>]*class="[^"]*observation-note-header[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(content) ||
                          /<p[^>]*>([\s\S]*?)<\/p>/i.exec(content);
      const bodyMatch = /<div[^>]*class="[^"]*observation-note-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(content);

      const headerText = headerMatch ? headerMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const dateStr = dateMatch ? dateMatch[1] : formatPtBrDate(new Date());
      const parsedDate = parsePtBrDate(dateStr) || new Date();

      // Header format: "[dd/mm/yyyy] Título (Prazo: N dias - Limite: x) ✓".
      // Only the trailing deadline parenthesis is metadata, so titles may contain their own parentheses.
      const title = decodeHtmlEntities(
        headerText
          .replace(/^\s*\[\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*/, '')
          .replace(/\s*[✓✔✅]\s*$/, '')
          .replace(/\s*\((?:Prazo:[^)]*|Sem prazo)\)\s*$/i, '')
          .trim()
      ) || 'Observação';

      const prazoVal = prazoMatch ? (prazoMatch[1] === 'none' || prazoMatch[1] === '' ? null : parseInt(prazoMatch[1], 10)) : null;
      // Structured cards carry an explicit data-concluded flag; the text heuristic is only for cards without it
      const hasConcludedAttr = /data-concluded="/i.test(attrs);

      cards.push({
        id: `note_${dateStr.replace(/\//g, '_')}_${cardIdx++}`,
        date: parsedDate,
        dateStr,
        title,
        prazoDias: isNaN(prazoVal as any) ? null : prazoVal,
        limitDateStr: limitMatch && limitMatch[1] ? limitMatch[1] : undefined,
        isConcluded: hasConcludedAttr ? concludedMatch : (/CONCLU[ÍI]DO/i.test(headerText) || /✅/i.test(headerText)),
        concludedDateStr: concludedDateMatch && concludedDateMatch[1] ? concludedDateMatch[1] : undefined,
        headerHtml: headerMatch ? headerMatch[0] : `<p><strong>[${dateStr}]</strong> ${title}</p>`,
        bodyHtml: bodyMatch ? bodyMatch[1] : '',
        rawBlockHtml: match[0],
        hasExplicitDate: true,
      });
    }

    if (cards.length > 0) {
      return cards;
    }
  }

  // 2. Legacy HTML parser (block-level):
  // Extract top-level block elements (<p>, <div>, <h1>-<h6>, <ul>, <ol>, <blockquote>, etc.)
  const blockRegex = /<(p|h[1-6]|ul|ol|blockquote|div)[^>]*>(.*?)<\/\1>/gis;
  const blocks: string[] = [];
  let m;
  while ((m = blockRegex.exec(sanitizedContent)) !== null) {
    if (m[0]) blocks.push(m[0]);
  }

  // Fallback if no block tags found
  const blocksToProcess = blocks.length > 0 ? blocks : sanitizedContent.split('\n');

  const notes: ParsedObservationNote[] = [];
  let currentNote: Partial<ParsedObservationNote> | null = null;
  let noteIndex = 0;

  for (const block of blocksToProcess) {
    const textClean = block.replace(/<[^>]*>/g, '').trim();
    if (!textClean) continue;

    // A block is an explicit note header ONLY IF it starts with a bracketed date [DD/MM/YYYY]
    // (optionally preceded by a conclusion prefix such as [CONCLUÍDO em ...] or checkmark).
    // It MUST NOT match a date appearing in the middle of a sentence or normal paragraph!
    const leadingHeaderMatch = /^\s*(?:(?:\[CONCLU[ÍI]DO(?:\s*em\s*\d{1,2}\/\d{1,2}\/\d{2,4})?\]|[✅✔✓])\s*)*\[(\d{1,2}\/\d{1,2}\/\d{2,4})\]/i.exec(textClean);

    if (leadingHeaderMatch) {
      if (currentNote && (currentNote.date || currentNote.headerHtml)) {
        notes.push(finalizeParsedNote(currentNote, noteIndex++));
      }

      const dateStr = leadingHeaderMatch[1];
      const parsedDate = parsePtBrDate(dateStr) || new Date();

      // Extract title: remove leading date and conclusion headers
      let title = 'Observação';
      const titleMatch = /(?:TÍTULO|TITULO):\s*([^<(\[]+)/i.exec(textClean);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      } else {
        let afterHeader = textClean
          .replace(/^\s*(?:(?:\[CONCLU[ÍI]DO(?:\s*em\s*\d{1,2}\/\d{1,2}\/\d{2,4})?\]|[✅✔✓])\s*)*\[?\d{1,2}\/\d{1,2}\/\d{2,4}\]?\s*(?:(?:\[CONCLU[ÍI]DO(?:\s*em\s*\d{1,2}\/\d{1,2}\/\d{2,4})?\]|[✅✔✓])\s*)*/i, '')
          .replace(/^(?:TÍTULO|TITULO):\s*/i, '')
          .replace(/^[-–:]\s*/, '')
          .trim();

        // Cut off metadata in parentheses like (Prazo: ...), (Sem prazo), (Limite: ...)
        const cutoffMatch = /^([^(]+)/.exec(afterHeader);
        if (cutoffMatch && cutoffMatch[1].trim()) {
          title = cutoffMatch[1].trim();
        } else if (afterHeader) {
          title = afterHeader;
        }
      }

      // Extract isConcluded
      const isConcluded = /\[?CONCLUÍDO/i.test(textClean) || /\[?CONCLUIDO/i.test(textClean) || /✅/i.test(textClean) || /✔/i.test(textClean) || /✓/i.test(textClean);

      // Extract deadline
      let prazoDias: number | null = null;
      if (/sem\s*prazo/i.test(textClean)) {
        prazoDias = null;
      } else {
        const prazoMatch = /Prazo:\s*(\d+)\s*dias?/i.exec(textClean) || /Prazo\s*de\s*(\d+)\s*dias?/i.exec(textClean);
        if (prazoMatch && prazoMatch[1]) {
          prazoDias = parseInt(prazoMatch[1], 10);
        } else if (textClean.toLowerCase().includes('prazo')) {
          prazoDias = 30;
        }
      }

      // Extract limit date
      let limitDateStr: string | undefined = undefined;
      const limitMatch = /Limite:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(textClean);
      if (limitMatch && limitMatch[1]) {
        limitDateStr = limitMatch[1];
      }

      currentNote = {
        date: parsedDate,
        dateStr,
        title,
        prazoDias,
        limitDateStr,
        isConcluded,
        headerHtml: block,
        bodyHtml: '',
        rawBlockHtml: block,
        hasExplicitDate: true,
      };
    } else {
      // Non-header block (details paragraph, list item, or general body text)
      if (currentNote) {
        // Attach to the current active note!
        currentNote.bodyHtml = (currentNote.bodyHtml || '') + block;
        currentNote.rawBlockHtml = (currentNote.rawBlockHtml || '') + block;
      } else {
        // If no note header has been found yet, group initial paragraphs into a fallback note
        const fallbackDate = new Date();
        currentNote = {
          date: fallbackDate,
          dateStr: formatPtBrDate(fallbackDate),
          title: 'Observação / Histórico',
          prazoDias: null,
          isConcluded: false,
          headerHtml: block,
          bodyHtml: '',
          rawBlockHtml: block,
          hasExplicitDate: false,
        };
      }
    }
  }

  if (currentNote && (currentNote.date || currentNote.headerHtml)) {
    notes.push(finalizeParsedNote(currentNote, noteIndex++));
  }

  return notes;
};

const finalizeParsedNote = (partial: Partial<ParsedObservationNote>, index: number): ParsedObservationNote => {
  const date = partial.date || new Date();
  const dateStr = partial.dateStr || formatPtBrDate(date);
  const titleSlug = (partial.title || 'obs').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 15);
  const id = `note_${dateStr.replace(/\//g, '_')}_${index}_${titleSlug}`;
  return {
    id,
    date,
    dateStr,
    title: decodeHtmlEntities(partial.title || 'Observação'),
    prazoDias: partial.prazoDias !== undefined ? partial.prazoDias : null,
    limitDateStr: partial.limitDateStr,
    isConcluded: !!partial.isConcluded,
    headerHtml: partial.headerHtml || '',
    bodyHtml: partial.bodyHtml || '',
    rawBlockHtml: partial.rawBlockHtml || (partial.headerHtml || '') + (partial.bodyHtml || ''),
    hasExplicitDate: partial.hasExplicitDate,
  };
};

/**
 * Sorts observation notes chronologically from oldest (top) to newest (bottom).
 */
export const sortObservationsChronologically = (notes: ParsedObservationNote[]): ParsedObservationNote[] => {
  return [...notes].sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * Serializes an array of observation notes into a clean HTML string.
 */
export const serializeObservationsToHtml = (notes: ParsedObservationNote[]): string => {
  const sorted = sortObservationsChronologically(notes);
  return sorted.map((n) => {
    const prazoText = n.prazoDias !== null && n.prazoDias !== undefined 
      ? `Prazo: ${n.prazoDias} dias${n.limitDateStr ? ` - Limite: ${n.limitDateStr}` : ''}`
      : 'Sem prazo';
    const concludedBadge = n.isConcluded
      ? ` <span class="text-emerald-600 font-bold inline-flex items-center gap-1 ms-1.5" title="Concluído${n.concludedDateStr ? ` em ${n.concludedDateStr}` : ''}">✓</span>`
      : '';
    const cleanBody = (n.bodyHtml || '').trim();

    return `<div class="observation-note-card" data-date="${n.dateStr}" data-prazo="${n.prazoDias !== null && n.prazoDias !== undefined ? n.prazoDias : 'none'}" data-limit="${n.limitDateStr || ''}" data-concluded="${n.isConcluded ? 'true' : 'false'}" data-concluded-date="${n.concludedDateStr || ''}">` +
      `<p class="observation-note-header"><strong>[${n.dateStr}]</strong> ${escapeHtml(n.title)} (${prazoText})${concludedBadge}</p>` +
      `<div class="observation-note-body">${cleanBody}</div>` +
      `</div>`;
  }).join('\n');
};

/**
 * Takes existing HTML content, parses it, adds a new formatted observation note HTML,
 * and returns the entire HTML sorted chronologically from oldest to newest!
 */
export const addAndSortNewObservation = (existingHtml: string | undefined | null, newNoteHtml: string): string => {
  const existingNotes = parseObservations(existingHtml);
  const newNotes = parseObservations(newNoteHtml);

  const combined = [...existingNotes, ...newNotes];
  const sorted = sortObservationsChronologically(combined);

  return serializeObservationsToHtml(sorted);
};

/**
 * Marks a specific observation note as concluded [CONCLUÍDO em DD/MM/YYYY] in the HTML
 * Optionally updates the details / body content of the note
 */
export const concludeObservationNote = (
  htmlContent: string, 
  noteId: string, 
  customConcludedDateStr?: string,
  conclusionDetailsHtml?: string
): string => {
  const notes = parseObservations(htmlContent);
  const target = notes.find((n) => n.id === noteId);

  if (!target) return htmlContent;

  const concludedDateStr = customConcludedDateStr || formatPtBrDate(new Date());
  target.isConcluded = true;
  target.concludedDateStr = concludedDateStr;

  // Update target.bodyHtml if conclusionDetailsHtml is provided
  if (conclusionDetailsHtml !== undefined) {
    const trimmed = conclusionDetailsHtml.trim();
    if (trimmed === '<p></p>' || trimmed === '') {
      target.bodyHtml = '';
    } else {
      target.bodyHtml = trimmed;
    }
  }

  return serializeObservationsToHtml(notes);
};

/**
 * Deadline status of a single note: critical when the deadline is reached,
 * warning from 2/3 of the deadline, normal otherwise. Returns null for notes without deadline.
 */
export const computeNoteDeadline = (note: ParsedObservationNote): NoteDeadlineInfo | null => {
  if (!note.prazoDias || note.prazoDias <= 0) return null;
  const diffTime = Date.now() - note.date.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const daysRemaining = note.prazoDias - daysElapsed;
  const warningThreshold = Math.floor(note.prazoDias * 0.66);

  let status: NoteDeadlineInfo['status'] = 'normal';
  if (daysElapsed >= note.prazoDias) {
    status = 'critical';
  } else if (daysElapsed >= warningThreshold) {
    status = 'warning';
  }

  return { note, daysElapsed, daysRemaining, status };
};

/**
 * Calculates demand deadline info considering all individual observation notes
 */
export const getDemandDeadlineInfo = (demand: Demand): DemandDeadlineInfo => {
  const notes = parseObservations(demand.observacoes);

  if (notes.length === 0) {
    return {
      activeNotes: [],
      status: 'completed',
      isMonitored: false,
      totalActiveNotes: 0,
      formattedLastObsDate: '-',
      daysElapsed: 0,
      targetDaysLimit: 30,
    };
  }

  // Active notes are those that are NOT concluded and HAVE a prazoDias > 0
  const activeNotes: NoteDeadlineInfo[] = [];

  for (const note of notes) {
    if (!note.isConcluded) {
      const info = computeNoteDeadline(note);
      if (info) activeNotes.push(info);
    }
  }

  if (activeNotes.length === 0) {
    const sorted = sortObservationsChronologically(notes);
    const lastNote = sorted[sorted.length - 1];

    return {
      activeNotes: [],
      status: 'completed',
      isMonitored: false,
      totalActiveNotes: 0,
      latestTitle: lastNote?.title,
      formattedLastObsDate: lastNote ? lastNote.dateStr : '-',
      daysElapsed: 0,
      targetDaysLimit: 30,
    };
  }

  // Sort active notes by status severity: critical > warning > normal, then by daysElapsed descending
  activeNotes.sort((a, b) => {
    const severityMap = { critical: 3, warning: 2, normal: 1 };
    if (severityMap[b.status] !== severityMap[a.status]) {
      return severityMap[b.status] - severityMap[a.status];
    }
    return b.daysElapsed - a.daysElapsed;
  });

  const mostCritical = activeNotes[0];
  let overallStatus: 'normal' | 'warning' | 'critical' = mostCritical.status;

  return {
    activeNotes,
    mostCriticalNote: mostCritical,
    status: overallStatus,
    isMonitored: true,
    totalActiveNotes: activeNotes.length,
    latestTitle: mostCritical.note.title,
    formattedLastObsDate: mostCritical.note.dateStr,
    daysElapsed: mostCritical.daysElapsed,
    targetDaysLimit: mostCritical.note.prazoDias || 30,
  };
};

/**
 * Finds the newly added note (by comparing with oldHtml) or the latest note in newHtml.
 * Properly handles retroactive dates!
 */
export const findNewlyAddedOrLatestNote = (newHtml: string | undefined | null, oldHtml?: string | undefined | null): string | undefined => {
  if (!newHtml || !hasObservationContent(newHtml)) return undefined;

  const newNotes = parseObservations(newHtml);
  if (newNotes.length === 0) {
    return newHtml;
  }

  if (oldHtml && hasObservationContent(oldHtml)) {
    const oldNotes = parseObservations(oldHtml);
    const oldRawBlocks = new Set(oldNotes.map(n => n.rawBlockHtml.trim()));

    // Find notes in newNotes that were NOT in oldNotes
    const addedNotes = newNotes.filter(n => !oldRawBlocks.has(n.rawBlockHtml.trim()));
    if (addedNotes.length > 0) {
      return addedNotes.map(n => n.rawBlockHtml).join('');
    }
  }

  // If no oldHtml or no difference found, check if any note matches today's date
  const todayStr = formatPtBrDate(new Date());
  const todayNotes = newNotes.filter(n => n.dateStr === todayStr);
  if (todayNotes.length > 0) {
    return todayNotes.map(n => n.rawBlockHtml).join('');
  }

  // Otherwise, return the most recent note chronologically
  const sorted = sortObservationsChronologically(newNotes);
  return sorted[sorted.length - 1].rawBlockHtml;
};

export interface NoteDiffResult {
  addedNotes: ParsedObservationNote[];
  removedNotes: ParsedObservationNote[];
}

/**
 * Compares old observation HTML and new observation HTML to determine which notes were added and which were removed/deleted.
 */
export const diffObservationNotes = (oldHtml?: string | null, newHtml?: string | null): NoteDiffResult => {
  const oldNotes = parseObservations(oldHtml);
  const newNotes = parseObservations(newHtml);

  const oldRawBlocks = new Map<string, ParsedObservationNote>();
  oldNotes.forEach((n) => oldRawBlocks.set(n.rawBlockHtml.trim(), n));

  const newRawBlocks = new Map<string, ParsedObservationNote>();
  newNotes.forEach((n) => newRawBlocks.set(n.rawBlockHtml.trim(), n));

  const addedNotes: ParsedObservationNote[] = [];
  const removedNotes: ParsedObservationNote[] = [];

  newNotes.forEach((note) => {
    if (!oldRawBlocks.has(note.rawBlockHtml.trim())) {
      addedNotes.push(note);
    }
  });

  oldNotes.forEach((note) => {
    if (!newRawBlocks.has(note.rawBlockHtml.trim())) {
      removedNotes.push(note);
    }
  });

  return { addedNotes, removedNotes };
};

