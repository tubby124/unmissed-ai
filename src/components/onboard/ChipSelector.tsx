"use client";

import { cn } from "@/lib/utils";

interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectorSingleProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  multi?: false;
  className?: string;
}

interface ChipSelectorMultiProps {
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multi: true;
  className?: string;
}

type ChipSelectorProps = ChipSelectorSingleProps | ChipSelectorMultiProps;

export default function ChipSelector(props: ChipSelectorProps) {
  const { options, className } = props;

  const handleClick = (optValue: string) => {
    if (props.multi) {
      const current = props.value;
      const next = current.includes(optValue)
        ? current.filter((v) => v !== optValue)
        : [...current, optValue];
      props.onChange(next);
    } else {
      props.onChange(optValue);
    }
  };

  const isSelected = (optValue: string) => {
    if (props.multi) return props.value.includes(optValue);
    return props.value === optValue;
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const selected = isSelected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer select-none",
              selected
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-700"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
