import { ReactNode } from 'react';

interface BadgeProps {
  variant: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning';
  children: ReactNode;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const variantClasses = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-green-100 text-green-800 border-green-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({ variant, children, icon, size = 'md', pulse = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border
        ${variantClasses[variant]} ${sizeClasses[size]} ${pulse ? 'animate-pulse' : ''}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
