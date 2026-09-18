import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Check,
  ChevronsUpDown,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
  Webhook,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useActiveAlertCount } from '@/hooks/useAlerts';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/stock-movements', label: 'Stock Movements', icon: ArrowLeftRight },
      { to: '/warehouses', label: 'Warehouses', icon: Warehouse },
      { to: '/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Purchasing',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: '/integrations', label: 'Integrations', icon: Webhook },
      { to: '/activity', label: 'Activity', icon: History },
      { to: '/team', label: 'Team', icon: Users },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ADMIN_SECTION = {
  title: 'Platform',
  items: [{ to: '/admin', label: 'Admin console', icon: ShieldCheck }] as NavItem[],
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile } = useAuth();
  const { workspace, workspaces, switchWorkspace } = useWorkspace();
  const { data: alertCount = 0 } = useActiveAlertCount();
  const navigate = useNavigate();

  const sections = profile?.is_super_admin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <>
      {/* mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-gray-950/40 animate-fade-in lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* brand + close (mobile) */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-text.svg" alt="Dynamico logo" className="h-[13px] w-auto" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* workspace switcher */}
        <div className="shrink-0 px-3 pt-3">
          <Dropdown
            align="start"
            className="w-[calc(16rem-1.5rem)]"
            trigger={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-2 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-700">
                  {getInitials(workspace?.name ?? 'W')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-gray-900">
                    {workspace?.name}
                  </p>
                  <p className="text-[11px] text-gray-500 capitalize">{workspace?.role}</p>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            }
          >
            {workspaces.map((ws) => (
              <DropdownItem key={ws.id} onClick={() => switchWorkspace(ws.id)}>
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.id === workspace?.id && <Check className="h-4 w-4 text-brand-600" />}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem icon={<Plus />} onClick={() => navigate('/onboarding?new=1')}>
              Create workspace
            </DropdownItem>
          </Dropdown>
        </div>

        {/* navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/alerts' && alertCount > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-red-700">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
