import React from 'react';
import { Crown } from 'lucide-react';

interface AdminBadgeProps {
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ className = '' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-800/60 ${className}`}
    >
      <Crown className="h-2.5 w-2.5" />
      Admin
    </span>
  );
};
