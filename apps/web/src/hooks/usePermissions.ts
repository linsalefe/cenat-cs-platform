import { useAuth } from '@/contexts/auth-context';

const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  admin: {
    dashboard: ['read'],
    students: ['read', 'create', 'update', 'delete'],
    tickets: ['read', 'create', 'update', 'delete'],
    conversations: ['read', 'create', 'update'],
    broadcasts: ['read', 'create', 'update', 'delete'],
    automations: ['read', 'create', 'update', 'delete'],
    reports: ['read', 'export'],
    financial: ['read', 'update', 'sync'],
    users: ['read', 'create', 'update', 'delete'],
    workflows: ['read', 'create', 'update', 'delete'],
  },
  gestor: {
    dashboard: ['read'],
    students: ['read', 'create', 'update', 'delete'],
    tickets: ['read', 'create', 'update', 'delete'],
    conversations: ['read', 'create', 'update'],
    broadcasts: ['read', 'create', 'update', 'delete'],
    automations: ['read'],
    reports: ['read', 'export'],
    financial: ['read', 'update', 'sync'],
    users: [],
    workflows: ['read', 'create', 'update'],
  },
  atendente: {
    dashboard: ['read'],
    students: ['read'],
    tickets: ['read', 'create', 'update'],
    conversations: ['read', 'create', 'update'],
    broadcasts: [],
    automations: [],
    reports: [],
    financial: [],
    users: [],
    workflows: [],
  },
  visualizador: {
    dashboard: ['read'],
    students: ['read'],
    tickets: ['read'],
    conversations: ['read'],
    broadcasts: [],
    automations: [],
    reports: ['read'],
    financial: ['read'],
    users: [],
    workflows: ['read'],
  },
};

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || 'visualizador';
  const perms = ROLE_PERMISSIONS[role] || {};

  const can = (module: string, action: string = 'read') => {
    return (perms[module] || []).includes(action);
  };

  return { can, role };
}