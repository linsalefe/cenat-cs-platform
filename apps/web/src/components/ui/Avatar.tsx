interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const colors = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
];

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${getAvatarColor(name)} 
        flex items-center justify-center text-white font-semibold
        shadow-lg shadow-gray-200 ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
