import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  color: 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple';
  trend?: { value: number; direction: 'up' | 'down' };
  onClick?: () => void;
  selected?: boolean;
  subtitle?: string;
}

const colorClasses = {
  red: {
    bar: 'from-red-500 to-red-600',
    bg: 'bg-red-50',
    iconBg: 'group-hover:bg-red-500',
    icon: 'text-red-600 group-hover:text-white',
    value: 'text-red-600',
  },
  orange: {
    bar: 'from-orange-500 to-orange-600',
    bg: 'bg-orange-50',
    iconBg: 'group-hover:bg-orange-500',
    icon: 'text-orange-600 group-hover:text-white',
    value: 'text-orange-600',
  },
  amber: {
    bar: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50',
    iconBg: 'group-hover:bg-amber-500',
    icon: 'text-amber-600 group-hover:text-white',
    value: 'text-amber-600',
  },
  green: {
    bar: 'from-green-500 to-green-600',
    bg: 'bg-green-50',
    iconBg: 'group-hover:bg-green-500',
    icon: 'text-green-600 group-hover:text-white',
    value: 'text-green-600',
  },
  blue: {
    bar: 'from-[#2A658F] to-[#3d7ba8]',
    bg: 'bg-blue-50',
    iconBg: 'group-hover:bg-[#2A658F]',
    icon: 'text-[#2A658F] group-hover:text-white',
    value: 'text-[#2A658F]',
  },
  purple: {
    bar: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-50',
    iconBg: 'group-hover:bg-purple-500',
    icon: 'text-purple-600 group-hover:text-white',
    value: 'text-purple-600',
  },
};

export default function StatCard({
  label,
  value,
  icon,
  color,
  trend,
  onClick,
  selected,
  subtitle,
}: StatCardProps) {
  const colors = colorClasses[color];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`group relative bg-white rounded-2xl p-5 shadow-sm hover:shadow-md 
        transition-all duration-300 text-left overflow-hidden w-full
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}
        ${selected ? 'ring-2 ring-[#2A658F]' : ''}`}
    >
      {/* Top bar gradient */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors.bar}`} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-bold ${colors.value}`}>{value}</p>
            {trend && (
              <span
                className={`flex items-center text-xs font-medium ${
                  trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        <div
          className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center 
            ${colors.iconBg} transition-colors`}
        >
          <div className={`${colors.icon} transition-colors`}>{icon}</div>
        </div>
      </div>
    </Component>
  );
}
