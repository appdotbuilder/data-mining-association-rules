
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { LoginInput } from '../../../server/src/schema';

interface LoginFormProps {
  onLogin: (credentials: LoginInput) => Promise<void>;
  isLoading: boolean;
}

export function LoginForm({ onLogin, isLoading }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginInput>({
    username: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(formData);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Masuk ke Akun</CardTitle>
        <CardDescription>
          Masukkan username dan password untuk mengakses aplikasi
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Masukkan username"
              value={formData.username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev: LoginInput) => ({ ...prev, username: e.target.value }))
              }
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Masukkan password"
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700 font-medium mb-2">Demo Accounts:</p>
          <div className="text-xs text-blue-600 space-y-1">
            <div>👑 Admin: admin / admin123</div>
            <div>👤 User: user / user123</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
