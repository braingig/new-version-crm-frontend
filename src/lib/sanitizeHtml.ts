import DOMPurify from 'dompurify';

const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
    ALLOWED_TAGS: [
        'p',
        'br',
        'hr',
        'strong',
        'em',
        'u',
        's',
        'sub',
        'sup',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'pre',
        'code',
        'span',
        'div',
        'mark',
    ],
    ALLOWED_ATTR: [
        'href',
        'target',
        'rel',
        'class',
        'style',
        'data-type',
        'data-checked',
        /* TipTap @mention spans */
        'data-id',
        'data-label',
        'data-mention-suggestion-char',
    ],
    ALLOW_DATA_ATTR: false,
};

/** Sanitize rich HTML for safe rendering (task descriptions, etc.). Browser-only (uses `window`). */
export function sanitizeRichHtml(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') return '';
    if (typeof window === 'undefined') return '';
    return DOMPurify.sanitize(dirty, CONFIG);
}
