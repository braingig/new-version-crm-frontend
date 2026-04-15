'use client';

import RichTextEditor from '@/components/RichTextEditor';
import type { MentionUser } from '@/components/MentionTextarea';

type DescriptionRichTextFieldProps = {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeightClassName?: string;
  mentionUsers?: MentionUser[];
  helperText?: React.ReactNode;
};

export default function DescriptionRichTextField({
  label = 'Description',
  value,
  onChange,
  placeholder = 'Write details...',
  required = false,
  minHeightClassName = 'min-h-[180px]',
  mentionUsers = [],
  helperText,
}: DescriptionRichTextFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required ? ' *' : ''}
      </label>
      {helperText ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{helperText}</p>
      ) : null}
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeightClassName={minHeightClassName}
        mentionUsers={mentionUsers}
      />
    </div>
  );
}
