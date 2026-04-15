/** Detect stored task description that uses HTML from the rich text editor. */
export function isProbablyRichTextHtml(s: string | null | undefined): boolean {
    if (s == null || s === '') return false;
    const t = s.trim();
    if (!t.includes('<') || !t.includes('>')) return false;
    return /<\/?(p|div|h[1-6]|ul|ol|li|strong|em|br|blockquote|pre|code|a|mark|hr)\b/i.test(
        t,
    );
}

/** True when editor HTML has no visible text (empty paragraphs only). */
export function isEmptyRichTextHtml(html: string): boolean {
    if (!html || !html.trim()) return true;
    // Mention-only content must be treated as non-empty.
    if (/data-type=["']mention["']/i.test(html)) return false;
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text === '';
}

/** Strip tags for compact previews (e.g. kanban cards). */
export function htmlToPlainText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}
