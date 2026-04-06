'use client';

/**
 * Highlights @mentions: email form (@a@b.com) or names with optional spaces (aligned with server catalog parsing).
 */
export function MentionFormattedText({ text }: { text: string }) {
    const parts = text.split(
        /(@(?:[^\s@]+@[^\s@]+\.[^\s@]+|(?:[^\s@]+\s+)+[^\s@]+|[^\s@]+))/g,
    );
    return (
        <>
            {parts.map((part, i) =>
                part.startsWith('@') ? (
                    <span
                        key={i}
                        className="font-medium text-primary-600 dark:text-primary-400"
                    >
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </>
    );
}
