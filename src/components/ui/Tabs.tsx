import React, {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (next: string) => void;
  baseId: string;
  triggersRef: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>.');
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (next: string) => void;
  children: ReactNode;
  className?: string;
}

/** Accessible tab set (ARIA tabs pattern with roving tabindex). */
export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
  const baseId = useId().replace(/[:]/g, '-');
  const triggersRef = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId, triggersRef }}>
      <div className={className ?? ''}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabListProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className, 'aria-label': ariaLabel }) => {
  const { baseId } = useTabsContext();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) => {
      const clamped = (index + tabs.length) % tabs.length;
      tabs[clamped]?.focus();
    };

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      tabs[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      tabs[tabs.length - 1]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-1 ${className ?? ''}`}
    >
      {children}
    </div>
  );
};

interface TabTriggerProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({ value, children, icon, className }) => {
  const { value: current, onValueChange, baseId, triggersRef } = useTabsContext();
  const selected = current === value;
  const id = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      ref={(el) => {
        triggersRef.current.set(value, el);
      }}
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={() => {
        onValueChange(value);
        triggersRef.current.get(value)?.focus();
      }}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150',
        selected
          ? 'border border-line-strong bg-surface-4 text-ink-hi'
          : 'border border-transparent text-ink-faint hover:bg-surface-3 hover:text-ink-mid',
        className ?? '',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
};

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ value, children, className }) => {
  const { value: current, baseId } = useTabsContext();
  const id = `${baseId}-panel-${value}`;
  const tabId = `${baseId}-tab-${value}`;

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId}
      hidden={current !== value}
      tabIndex={0}
      className={className ?? ''}
    >
      {children}
    </div>
  );
};

export default Tabs;