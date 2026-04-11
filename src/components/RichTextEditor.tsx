'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
    BoldIcon,
    ItalicIcon,
    UnderlineIcon,
    StrikethroughIcon,
    CodeBracketIcon,
    ListBulletIcon,
    NumberedListIcon,
    LinkIcon,
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

export type RichTextEditorProps = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    /** Min height of the editable area */
    minHeightClassName?: string;
};

function ToolbarButton({
    onClick,
    active,
    disabled,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            className={`rounded p-1.5 transition-colors ${
                active
                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );
}

function ToolbarDivider() {
    return <div className="w-px self-stretch bg-gray-200 dark:bg-gray-600 mx-0.5" aria-hidden />;
}

function LinkDialog({
    open,
    initialUrl,
    onClose,
    onApply,
}: {
    open: boolean;
    initialUrl: string;
    onClose: () => void;
    onApply: (url: string) => void;
}) {
    const [url, setUrl] = useState(initialUrl);

    useEffect(() => {
        if (open) setUrl(initialUrl);
    }, [open, initialUrl]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const apply = () => {
        onApply(url.trim());
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rich-text-link-dialog-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h2
                        id="rich-text-link-dialog-title"
                        className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                        Link
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                        aria-label="Close"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
                <label htmlFor="rich-text-link-url" className="sr-only">
                    URL
                </label>
                <input
                    id="rich-text-link-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            apply();
                        }
                    }}
                    placeholder="Paste or type a URL"
                    className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    autoFocus
                />
                <div className="mt-2.5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={apply}
                        title="Apply URL, or clear the field to remove the link"
                        className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write a detailed description…',
    className = '',
    minHeightClassName = 'min-h-[200px]',
}: RichTextEditorProps) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkDialogInitialUrl, setLinkDialogInitialUrl] = useState('');

    const editor = useEditor(
        {
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [1, 2, 3] },
                    bulletList: { HTMLAttributes: { class: 'list-disc pl-4' } },
                    orderedList: { HTMLAttributes: { class: 'list-decimal pl-4' } },
                    horizontalRule: {
                        HTMLAttributes: { class: 'border-gray-300 dark:border-gray-600' },
                    },
                }),
                Underline,
                Link.configure({
                    openOnClick: false,
                    /** Select link on click instead of letting the browser follow the URL */
                    enableClickSelection: true,
                    autolink: true,
                    defaultProtocol: 'https',
                    HTMLAttributes: {
                        class:
                            'text-primary-600 underline dark:text-primary-400 font-medium',
                    },
                }),
                TextAlign.configure({
                    types: ['heading', 'paragraph'],
                }),
                TextStyle,
                Color,
                Highlight.configure({ multicolor: true }),
                Subscript,
                Superscript,
                TaskList,
                TaskItem.configure({ nested: true }),
                Placeholder.configure({ placeholder }),
            ],
            content: value || '',
            editorProps: {
                attributes: {
                    class: `rich-text-editor-inner focus:outline-none px-3 py-2 ${minHeightClassName} text-gray-900 dark:text-gray-100 text-sm leading-relaxed`,
                },
                handleDOMEvents: {
                    // Block browser navigation on <a href> while editing (openOnClick: false alone is not enough).
                    click: (_view, event) => {
                        const t = event.target;
                        if (!(t instanceof Element)) return false;
                        const a = t.closest('a[href]');
                        if (a && _view.editable && _view.dom.contains(a)) {
                            event.preventDefault();
                        }
                        return false;
                    },
                },
            },
            onUpdate: ({ editor }) => {
                onChangeRef.current(editor.getHTML());
            },
        },
        [],
    );

    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        const incoming = value || '';
        if (incoming !== current) {
            editor.commands.setContent(incoming, { emitUpdate: false });
        }
    }, [value, editor]);

    const chain = useCallback(() => editor?.chain().focus(), [editor]);

    const openLinkDialog = () => {
        if (!editor) return;
        const prev = editor.getAttributes('link').href as string | undefined;
        setLinkDialogInitialUrl(prev && typeof prev === 'string' ? prev : '');
        setLinkDialogOpen(true);
    };

    const applyLinkFromDialog = (trimmed: string) => {
        if (!editor) return;
        if (trimmed === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    };

    if (!editor) {
        return (
            <div
                className={`rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 animate-pulse ${minHeightClassName} ${className}`}
                aria-hidden
            />
        );
    }

    return (
        <div
            className={`rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden ${className}`}
        >
            <LinkDialog
                open={linkDialogOpen}
                initialUrl={linkDialogInitialUrl}
                onClose={() => setLinkDialogOpen(false)}
                onApply={applyLinkFromDialog}
            />
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 dark:border-gray-600 px-1.5 py-1 bg-gray-50 dark:bg-gray-900/50">
                <ToolbarButton
                    title="Bold (Ctrl+B)"
                    active={editor.isActive('bold')}
                    onClick={() => chain()?.toggleBold().run()}
                >
                    <BoldIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Italic (Ctrl+I)"
                    active={editor.isActive('italic')}
                    onClick={() => chain()?.toggleItalic().run()}
                >
                    <ItalicIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Underline (Ctrl+U)"
                    active={editor.isActive('underline')}
                    onClick={() => chain()?.toggleUnderline().run()}
                >
                    <UnderlineIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Strikethrough"
                    active={editor.isActive('strike')}
                    onClick={() => chain()?.toggleStrike().run()}
                >
                    <StrikethroughIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Inline code"
                    active={editor.isActive('code')}
                    onClick={() => chain()?.toggleCode().run()}
                >
                    <CodeBracketIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Subscript"
                    active={editor.isActive('subscript')}
                    onClick={() => chain()?.toggleSubscript().run()}
                >
                    <span className="text-xs font-semibold">x₂</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Superscript"
                    active={editor.isActive('superscript')}
                    onClick={() => chain()?.toggleSuperscript().run()}
                >
                    <span className="text-xs font-semibold">x²</span>
                </ToolbarButton>

                <ToolbarDivider />

                <ToolbarButton
                    title="Heading 1"
                    active={editor.isActive('heading', { level: 1 })}
                    onClick={() => chain()?.toggleHeading({ level: 1 }).run()}
                >
                    <span className="text-xs font-bold">H1</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Heading 2"
                    active={editor.isActive('heading', { level: 2 })}
                    onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
                >
                    <span className="text-xs font-bold">H2</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Heading 3"
                    active={editor.isActive('heading', { level: 3 })}
                    onClick={() => chain()?.toggleHeading({ level: 3 }).run()}
                >
                    <span className="text-xs font-bold">H3</span>
                </ToolbarButton>
                <ToolbarDivider />

                <ToolbarButton
                    title="Align left"
                    active={editor.isActive({ textAlign: 'left' })}
                    onClick={() => chain()?.setTextAlign('left').run()}
                >
                    <span className="text-xs">◧</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Align center"
                    active={editor.isActive({ textAlign: 'center' })}
                    onClick={() => chain()?.setTextAlign('center').run()}
                >
                    <span className="text-xs">◫</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Align right"
                    active={editor.isActive({ textAlign: 'right' })}
                    onClick={() => chain()?.setTextAlign('right').run()}
                >
                    <span className="text-xs">◨</span>
                </ToolbarButton>

                <ToolbarDivider />

                <ToolbarButton
                    title="Bullet list"
                    active={editor.isActive('bulletList')}
                    onClick={() => chain()?.toggleBulletList().run()}
                >
                    <ListBulletIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Numbered list"
                    active={editor.isActive('orderedList')}
                    onClick={() => chain()?.toggleOrderedList().run()}
                >
                    <NumberedListIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Task list"
                    active={editor.isActive('taskList')}
                    onClick={() => chain()?.toggleTaskList().run()}
                >
                    <span className="text-xs">☑</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Quote"
                    active={editor.isActive('blockquote')}
                    onClick={() => chain()?.toggleBlockquote().run()}
                >
                    <span className="text-xs font-serif">&ldquo;</span>
                </ToolbarButton>
                <ToolbarButton
                    title="Horizontal rule"
                    onClick={() => chain()?.setHorizontalRule().run()}
                >
                    <span className="text-xs">—</span>
                </ToolbarButton>

                <ToolbarDivider />

                <ToolbarButton title="Insert or edit link" onClick={openLinkDialog}>
                    <LinkIcon className="h-4 w-4" />
                </ToolbarButton>
                <label
                    className="inline-flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Text color"
                >
                    <input
                        type="color"
                        className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                        defaultValue="#111827"
                        onChange={(e) =>
                            editor.chain().focus().setColor(e.target.value).run()
                        }
                    />
                </label>
                <label
                    className="inline-flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    title="Highlight color"
                >
                    <input
                        type="color"
                        className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                        defaultValue="#fef08a"
                        onChange={(e) =>
                            editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
                        }
                    />
                    <span className="sr-only">Highlight</span>
                </label>
                <ToolbarButton
                    title="Remove text highlight (clear marker color)"
                    active={editor.isActive('highlight')}
                    onClick={() => chain()?.unsetHighlight().run()}
                >
                    <span className="flex h-4 w-4 items-center justify-center rounded border border-amber-300 bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40">
                        <XMarkIcon className="h-3 w-3 text-amber-900 dark:text-amber-100" aria-hidden />
                    </span>
                </ToolbarButton>

                <ToolbarDivider />

                <ToolbarButton
                    title="Undo"
                    onClick={() => chain()?.undo().run()}
                    disabled={!editor.can().undo()}
                >
                    <ArrowUturnLeftIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    title="Redo"
                    onClick={() => chain()?.redo().run()}
                    disabled={!editor.can().redo()}
                >
                    <ArrowUturnRightIcon className="h-4 w-4" />
                </ToolbarButton>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
