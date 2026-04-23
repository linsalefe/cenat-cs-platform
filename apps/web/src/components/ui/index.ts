// Barrel para componentes legacy do CENAT (mantido para compat das páginas)
// Re-exporta Avatar, Badge, EmptyState, StatCard de components/
//
// ATENÇÃO: Os componentes shadcn (kebab-case) ficam em @/components/ui/<nome>
// e devem ser importados diretamente, ex: `import { Avatar } from '@/components/ui/avatar'`
// Este arquivo NÃO re-exporta os componentes shadcn para evitar colisão de nomes.

export { default as Avatar, getInitials, getAvatarColor } from '../Avatar';
export { default as Badge } from '../Badge';
export { default as EmptyState } from '../EmptyState';
export { default as StatCard } from '../StatCard';
