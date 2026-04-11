'use client';

import { useEffect, useState } from 'react';
import { sanitizeRichHtml } from '@/lib/sanitizeHtml';
import { isProbablyRichTextHtml } from '@/lib/richText';
import { MentionFormattedText } from '@/components/MentionFormattedText';

type Props = {
    htmlOrText: string;
    className?: string;
};

/**
 * Renders task description: sanitized HTML when from the rich editor, otherwise plain text with @mention styling.
 */
export function RichTextContent({ htmlOrText, className = '' }: Props) {
    const [safeHtml, setSafeHtml] = useState('');

    useEffect(() => {
        if (isProbablyRichTextHtml(htmlOrText)) {
            setSafeHtml(sanitizeRichHtml(htmlOrText));
        }
    }, [htmlOrText]);

    if (!htmlOrText) return null;

    if (isProbablyRichTextHtml(htmlOrText)) {
        if (!safeHtml) {
            return (
                <div
                    className={`min-h-[4rem] rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}
                    aria-hidden
                />
            );
        }
        return (
            <div
                className={`rich-text-content text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${className}`}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
        );
    }

    return (
        <p className={`whitespace-pre-wrap text-sm ${className}`}>
            <MentionFormattedText text={htmlOrText} />
        </p>
    );
}
