import React, { type ReactNode } from 'react';

// ─── NavItem ────────────────────────────────────────────────────────────────

interface NavItemProps {
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Single navigation row (sidebar / top bar). Links become buttons by default. */
export const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, onClick, className }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150',
        active
          ? 'border-line-strong bg-surface-4 text-ink-hi'
          : 'border-transparent text-ink-low hover:bg-surface-3 hover:text-ink-mid',
        className ?? '',
      ].join(' ')}
    >
      <span className={active ? 'text-accent' : 'text-ink-faint'} aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
};

// ─── BottomNavigation ───────────────────────────────────────────────────────

export interface BottomNavItem {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
  /** Accessibility name (defaults to label). */
  'aria-label'?: string;
}

interface BottomNavigationProps {
  items: BottomNavItem[];
  className?: string;
  /** Render in-flow (e.g. inside a phone-frame preview) instead of fixed to the viewport. */
  embedded?: boolean;
}

/**
 * Mobile bottom navigation (desktop hidden by default). Max five slots per the
 * product spec — Journal · Memories · Timeline · Ask · Profile.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ items, className, embedded = false }) => {
  return (
    <nav
      aria-label="Primary"
      className={[
        embedded
          ? 'border-t border-line bg-surface-1 pb-[env(safe-area-inset-bottom)]'
          : 'fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden',
        className ?? '',
      ].join(' ')}
    >
      <div className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const active = item.active ?? false;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-label={item['aria-label'] ?? (typeof item.label === 'string' ? item.label : undefined)}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors duration-150',
                active ? 'text-accent' : 'text-ink-faint hover:text-ink-mid',
              ].join(' ')}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavItem;
