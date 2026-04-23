'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  tone?: Tone;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  actionLabel?: ReactNode;
}

const toneConfig: Record<
  Tone,
  { iconColor: string; iconBg: string; accent: string; label: string }
> = {
  default: {
    iconColor: 'text-muted-foreground',
    iconBg: 'bg-muted',
    accent: 'text-muted-foreground',
    label: 'text-muted-foreground',
  },
  primary: {
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    accent: 'text-primary',
    label: 'text-primary',
  },
  info: {
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    accent: 'text-blue-600 dark:text-blue-400',
    label: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    accent: 'text-emerald-600 dark:text-emerald-400',
    label: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    iconColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-50 dark:bg-orange-500/10',
    accent: 'text-orange-600 dark:text-orange-400',
    label: 'text-orange-600 dark:text-orange-400',
  },
  danger: {
    iconColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    accent: 'text-red-600 dark:text-red-400',
    label: 'text-red-600 dark:text-red-400',
  },
};

const trendConfig = {
  up: {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  down: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

export default function KpiCard({
  label,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendValue,
  tone = 'default',
  href,
  onClick,
  loading,
  className,
  actionLabel,
}: KpiCardProps) {
  if (loading) return <KpiSkeleton />;

  const t = toneConfig[tone];
  const clickable = !!(href || onClick);
  const trendInfo = trend ? trendConfig[trend] : null;
  const TrendIcon = trendInfo?.icon;

  const inner = (
    <Card
      className={cn(
        'p-5 transition-all duration-200 group',
        clickable &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/15',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-widest',
            t.label
          )}
        >
          {label}
        </span>
        {Icon && (
          <div
            className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
              t.iconBg
            )}
          >
            <Icon
              className={cn('w-[18px] h-[18px]', t.iconColor)}
              strokeWidth={1.75}
            />
          </div>
        )}
      </div>

      <p className="text-3xl font-semibold text-foreground tabular-nums leading-tight">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>

      <div className="flex items-center justify-between gap-2 mt-2 min-h-[20px]">
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-tight">
            {subtitle}
          </p>
        )}
        {trendValue && trendInfo && TrendIcon ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded',
              trendInfo.color,
              trendInfo.bg
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
        ) : clickable ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium transition-all',
              t.accent,
              'group-hover:translate-x-0.5'
            )}
          >
            {actionLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        ) : null}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left w-full focus:outline-none"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

function KpiSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28 mb-2" />
      <Skeleton className="h-3 w-32" />
    </Card>
  );
}
