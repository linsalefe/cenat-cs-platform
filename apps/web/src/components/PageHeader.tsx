'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-sm font-medium text-primary mb-1">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
