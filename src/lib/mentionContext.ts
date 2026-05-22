export type MentionContextType = 'comment' | 'description' | 'note';

export function mentionContextLabel(contextType: string): string {
    switch (contextType) {
        case 'comment':
            return 'In a comment';
        case 'note':
            return 'In note';
        case 'description':
        default:
            return 'In description';
    }
}

export function taskLinkWithMentionFocus(taskId: string, focusHash: string): string {
    const hash = focusHash?.startsWith('#') ? focusHash : `#${focusHash || 'task-description'}`;
    return `/dashboard/tasks/${taskId}${hash}`;
}
