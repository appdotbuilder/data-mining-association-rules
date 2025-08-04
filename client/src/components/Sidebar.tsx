
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { User } from '../../../server/src/schema';

interface SidebarProps {
  user: User;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

export function Sidebar({ user, currentView, onViewChange, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'transactions', label: '💳 Transaksi', icon: '💳' },
    { id: 'mining', label: '⚡ Data Mining', icon: '⚡' },
  ];

  // Add items management for admin only
  if (user.role === 'admin') {
    menuItems.splice(1, 0, { id: 'items', label: '📦 Barang', icon: '📦' });
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h2 className="font-bold text-lg">Data Mining</h2>
            <p className="text-sm text-gray-500">Apriori & FP-Growth</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm">
              {user.role === 'admin' ? '👑' : '👤'}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">{user.username}</p>
            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="text-xs">
              {user.role}
            </Badge>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'default' : 'ghost'}
              className="w-full justify-start gap-3"
              onClick={() => onViewChange(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={onLogout}
        >
          <span>🚪</span>
          Keluar
        </Button>
      </div>
    </div>
  );
}
