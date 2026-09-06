import React, { useId, type ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name for the switch control. */
  label: ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

const SIZES = {
  sm: { track: 'h-5 w-9', knobOn: 'left-[18px]', knobOff: 'left-0.5', knob: 'h-4 w-4' },
  md: { track: 'h-6 w-11', knobOn: 'left-[22px]', knobOff: 'left-0.5', knob: 'h-5 w-5' },
} as const;

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  size = 'md',
  disabled = false,
  className,
}) => {
  const labelId = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`switch-label-${labelId}`}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
    >
      <span
        id={`switch-label-${labelId}`}
        className="text-sm text-ink-mid"
      >
        {label}
      </span>
      <span
        className={`relative shrink-0 rounded-full transition-colors duration-150 ${
          checked ? 'bg-accent-deep' : 'bg-line'
        } ${SIZES[size].track}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 rounded-full bg-white shadow transition-all duration-150 ${
            checked ? SIZES[size].knobOn : SIZES[size].knobOff
          } ${SIZES[size].knob}`}
        />
      </span>
    </button>
  );
};

export default Switch;
