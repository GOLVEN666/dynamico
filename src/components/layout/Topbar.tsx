import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useActiveAlertCount } from '@/hooks/useAlerts';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { getErrorMessage } from '@/lib/utils';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: alertCount = 0 } = useActiveAlertCount();
  const toast = useToast();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.email || 'Account';

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Sign out failed', getErrorMessage(error));
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <Link
          to="/alerts"
          className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="Alerts"
        >
          <Bell className="h-[18px] w-[18px]" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>

        <Dropdown
          trigger={
            <button type="button" className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-gray-100">
              <Avatar name={displayName} src={profile?.avatar_url} size="sm" />
            </button>
          }
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-semibold text-gray-900">{displayName}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem icon={<User />} onClick={() => navigate('/settings')}>
            Account settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<LogOut />} destructive onClick={() => void handleSignOut()}>
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
