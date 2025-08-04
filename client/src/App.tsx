
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  LoginInput
} from '../../server/src/schema';

// Components
import { LoginForm } from '@/components/LoginForm';
import { ItemsManagement } from '@/components/ItemsManagement';
import { TransactionsManagement } from '@/components/TransactionsManagement';
import { MiningDashboard } from '@/components/MiningDashboard';
import { Sidebar } from '@/components/Sidebar';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  // Authentication handler
  const handleLogin = async (credentials: LoginInput) => {
    setIsLoading(true);
    try {
      const response = await trpc.login.mutate(credentials);
      if (response) {
        setUser(response.user);
        localStorage.setItem('auth_token', response.token);
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    setCurrentView('dashboard');
  };

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      trpc.getCurrentUser.query(token)
        .then((userData) => {
          if (userData) {
            setUser(userData);
          } else {
            localStorage.removeItem('auth_token');
          }
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
        });
    }
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Data Mining App</h1>
            <p className="text-gray-600">Analisis Apriori & FP-Growth</p>
          </div>
          <LoginForm onLogin={handleLogin} isLoading={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        user={user}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 p-6 ml-64">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {currentView === 'dashboard' && '📊 Dashboard'}
              {currentView === 'items' && '📦 Manajemen Barang'}
              {currentView === 'transactions' && '💳 Manajemen Transaksi'}
              {currentView === 'mining' && '⚡ Data Mining'}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                {user.role === 'admin' ? '👑 Admin' : '👤 User'}
              </Badge>
              <span className="text-sm text-gray-500">Halo, {user.username}!</span>
            </div>
          </div>

          {currentView === 'dashboard' && (
            <DashboardView user={user} />
          )}

          {currentView === 'items' && user.role === 'admin' && (
            <ItemsManagement />
          )}

          {currentView === 'transactions' && (
            <TransactionsManagement userRole={user.role} />
          )}

          {currentView === 'mining' && (
            <MiningDashboard />
          )}

          {currentView === 'items' && user.role !== 'admin' && (
            <Alert>
              <AlertDescription>
                Anda tidak memiliki akses untuk mengelola barang. Hanya admin yang dapat mengakses fitur ini.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>
    </div>
  );
}

// Dashboard Overview Component
function DashboardView({ user }: { user: User }) {
  const [stats, setStats] = useState({
    itemsCount: 0,
    transactionsCount: 0,
    miningResultsCount: 0
  });

  const loadStats = useCallback(async () => {
    try {
      const [items, transactions, miningResults] = await Promise.all([
        trpc.getItems.query(),
        trpc.getTransactions.query(),
        trpc.getMiningResults.query()
      ]);
      
      setStats({
        itemsCount: items.length,
        transactionsCount: transactions.length,
        miningResultsCount: miningResults.length
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Barang</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itemsCount}</div>
            <p className="text-xs text-muted-foreground">Item dalam database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <span className="text-2xl">💳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transactionsCount}</div>
            <p className="text-xs text-muted-foreground">Transaksi tersimpan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hasil Mining</CardTitle>
            <span className="text-2xl">⚡</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.miningResultsCount}</div>
            <p className="text-xs text-muted-foreground">Analisis selesai</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚀 Selamat Datang di Data Mining App</CardTitle>
          <CardDescription>
            Aplikasi untuk analisis aturan asosiasi menggunakan algoritma Apriori dan FP-Growth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">🔍 Fitur Utama:</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                <li>Manajemen data barang dan transaksi</li>
                <li>Import data dari file Excel</li>
                <li>Analisis dengan algoritma Apriori</li>
                <li>Analisis dengan algoritma FP-Growth</li>
                <li>Perbandingan performa kedua algoritma</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">📊 Yang Bisa Anda Lakukan:</h3>
              <div className="space-y-2">
                {user.role === 'admin' ? (
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                    <li>Kelola semua data barang (CRUD)</li>
                    <li>Kelola semua data transaksi</li>
                    <li>Lihat semua hasil analisis</li>
                    <li>Import data dari Excel</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                    <li>Input data transaksi</li>
                    <li>Import transaksi dari Excel</li>
                    <li>Jalankan analisis data mining</li>
                    <li>Lihat hasil analisis Anda</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
