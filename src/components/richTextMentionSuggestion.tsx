import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import {
    RichTextMentionList,
    type RichTextMentionItem,
} from '@/components/RichTextMentionList';
import type { MentionUser } from '@/components/MentionTextarea';

/** Tippy’s typings require a non-null DOMRect; TipTap may return null while measuring. */
function getReferenceClientRect(
    clientRect: (() => DOMRect | null) | null | undefined,
): (() => DOMRect) | undefined {
    if (!clientRect) return undefined;
    return () => clientRect() ?? new DOMRect(0, 0, 0, 0);
}

type Ctx = {
    usersRef: MutableRefObject<MentionUser[]>;
    currentUserIdRef: MutableRefObject<string | undefined>;
};

function buildItems(query: string, ctx: Ctx): RichTextMentionItem[] {
    const q = query.toLowerCase();
    const pool = ctx.usersRef.current.filter((u) => u.id !== ctx.currentUserIdRef.current);
    const filtered = !q
        ? pool
        : pool.filter(
              (u) =>
                  u.name.toLowerCase().includes(q) ||
                  u.email.toLowerCase().includes(q),
          );
    return filtered.slice(0, 8).map((u) => ({
        id: u.id,
        label: (u.name || '').trim() || u.email,
        email: u.email,
    }));
}

/**
 * TipTap suggestion `render` factory for @mentions (same matching rules as MentionTextarea).
 */
export function createRichTextMentionSuggestionRender(ctx: Ctx) {
    return () => {
        let component: ReactRenderer | null = null;
        let popup: Instance | null = null;

        return {
            onStart: (props: SuggestionProps<RichTextMentionItem>) => {
                component = new ReactRenderer(RichTextMentionList, {
                    props: {
                        items: props.items,
                        command: (item: RichTextMentionItem) => {
                            // Only id + label are stored on the mention node (matches backend / MentionTextarea).
                            props.command({ id: item.id, label: item.label } as RichTextMentionItem);
                        },
                    },
                    editor: props.editor,
                });

                if (!props.clientRect) {
                    return;
                }

                popup = tippy(document.body, {
                    getReferenceClientRect: getReferenceClientRect(props.clientRect),
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                    offset: [0, 6],
                    maxWidth: 340,
                    animation: 'fade',
                    duration: [120, 80],
                    arrow: false,
                    theme: 'mention-suggestion',
                    zIndex: 10060,
                });
            },

            onUpdate(props: SuggestionProps<RichTextMentionItem>) {
                component?.updateProps({
                    items: props.items,
                    command: (item: RichTextMentionItem) => {
                        props.command({ id: item.id, label: item.label } as RichTextMentionItem);
                    },
                });
                popup?.setProps({
                    getReferenceClientRect: getReferenceClientRect(props.clientRect),
                });
            },

            onKeyDown(props: SuggestionKeyDownProps) {
                if (props.event.key === 'Escape') {
                    popup?.hide();
                    return true;
                }
                const handler = (
                    component?.ref as unknown as {
                        onKeyDown?: (p: SuggestionKeyDownProps) => boolean;
                    }
                )?.onKeyDown;
                return handler?.(props) ?? false;
            },

            onExit() {
                popup?.destroy();
                component?.destroy();
                popup = null;
                component = null;
            },
        };
    };
}

/** Mention extension items callback — keeps latest users via ref. */
export function createMentionItemsResolver(ctx: Ctx) {
    return ({ query }: { query: string; editor: Editor }) =>
        buildItems(query, ctx);
}
