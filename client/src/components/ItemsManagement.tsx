
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { Item, CreateItemInput } from '../../../server/src/schema';

export function ItemsManagement() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  
  const [formData, setFormData] = useState<CreateItemInput>({
    name: '',
    description: null,
    category: null
  });

  const loadItems = useCallback(async () => {
    try {
      const result = await trpc.getItems.query();
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (editingItem) {
        // Update existing item
        const updated = await trpc.updateItem.mutate({
          id: editingItem.id,
          ...formData
        });
        if (updated) {
          setItems((prev: Item[]) => 
            prev.map((item: Item) => 
              item.id === editingItem.id ? updated : item
            )
          );
        }
      } else {
        // Create new item
        const newItem = await trpc.createItem.mutate(formData);
        setItems((prev: Item[]) => [...prev, newItem]);
      }
      
      // Reset form and close dialog
      setFormData({ name: '', description: null, category: null });
      setEditingItem(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (itemId: number) => {
    try {
      const success = await trpc.deleteItem.mutate(itemId);
      if (success) {
        setItems((prev: Item[]) => prev.filter((item: Item) => item.id !== itemId));
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: '', description: null, category: null });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>📦 Manajemen Barang</CardTitle>
              <CardDescription>
                Kelola data barang untuk analisis transaksi
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsDialogOpen(true)}>
                  ➕ Tambah Barang
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingItem ? 'Ubah informasi barang' : 'Masukkan informasi barang baru'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Barang *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateItemInput) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Contoh: Laptop Gaming"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Deskripsi</Label>
                    <Input
                      id="description"
                      value={formData.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateItemInput) => ({
                          ...prev,
                          description: e.target.value || null
                        }))
                      }
                      placeholder="Deskripsi barang (opsional)"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <Input
                      id="category"
                      value={formData.category || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateItemInput) => ({
                          ...prev,
                          category: e.target.value || null
                        }))
                      }
                      placeholder="Contoh: Elektronik"
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : (editingItem ? 'Update' : 'Simpan')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">📦</span>
              <p className="text-gray-500 mb-4">Belum ada data barang</p>
              <p className="text-sm text-gray-400">Tambahkan barang pertama untuk memulai</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: Item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="secondary">{item.category}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.description || <span className="text-gray-400">-</span>}
                    </TableCell>
                    <TableCell>{item.created_at.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          ✏️ Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              🗑️ Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Barang</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus barang "{item.name}"? 
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
