"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

export type Option<T extends string | number> = { value: T; label: string };

/**
 * A shadcn Select for a fixed list of options. Shows the selected option's label.
 */
export function OptionSelect<T extends string | number>({
    value,
    options,
    onChange,
    disabled,
    size = "default",
    id,
    "aria-label": ariaLabel,
    className,
}: {
    value: T;
    options: Option<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    size?: "sm" | "default";
    id?: string;
    "aria-label"?: string;
    className?: string;
}) {
    return (
        <Select
            value={value}
            items={options}
            disabled={disabled}
            onValueChange={(next) => {
                if (next !== null) onChange(next as T);
            }}
        >
            <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={className}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
