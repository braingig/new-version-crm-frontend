'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

type Option = {
    value: string;
    label: string;
};

interface ModalDropdownProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function ModalDropdown({
    value,
    options,
    onChange,
    placeholder = 'Select',
    disabled = false,
}: ModalDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, []);

    const selected = options.find((o) => o.value === value);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-left text-sm text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <span className={selected ? '' : 'text-gray-500 dark:text-gray-400'}>
                    {selected?.label ?? placeholder}
                </span>
                <ChevronDownIcon
                    className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ease-out ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </button>

            <div
                className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 shadow-lg max-h-56 overflow-y-auto origin-top transition-all duration-200 ease-out ${
                    open
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                }`}
            >
                {options.map((option) => {
                    const active = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                active
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                    : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600/60'
                            }`}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
