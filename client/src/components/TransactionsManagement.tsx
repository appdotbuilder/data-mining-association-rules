
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { Transaction, CreateTransactionInput, Item, ExcelImportInput } from '../../../server/src/schema';

interface TransactionsManagementProps {
  userRole: string;
}

export function TransactionsManagement({ userRole }: TransactionsManagementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<CreateTransactionInput>({
    transaction_date: new Date(),
    items: []
  });

  const [newItem, setNewItem] = useState({ item_id: 0, quantity: 1 });

  const loadData = useCallback(async () => {
    try {
      const [transactionsData, itemsData] = await Promise.all([
        trpc.getTransactions.query(),
        trpc.getItems.query()
      ]);
      setTransactions(transactionsData);
      setItems(itemsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) return;
    
    setIsLoading(true);
    try {
      const newTransaction = await trpc.createTransaction.mutate(formData);
      setTransactions((prev: Transaction[]) => [...prev, newTransaction]);
      
      // Reset form
      setFormData({
        transaction_date: new Date(),
        items: []
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    if (newItem.item_id === 0) return;
    
    const existingIndex = formData.items.findIndex(item => item.item_id === newItem.item_id);
    
    if (existingIndex >= 0) {
      // Update quantity if item already exists
      const updatedItems = [...formData.items];
      updatedItems[existingIndex].quantity += newItem.quantity;
      setFormData((prev: CreateTransactionInput) => ({
        ...prev,
        items: updatedItems
      }));
    } else {
      // Add new item
      setFormData((prev: CreateTransactionInput) => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
    
    setNewItem({ item_id: 0, quantity: 1 });
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev: CreateTransactionInput) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleFileImport = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    
    try {
      // Convert file to base64
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:mime;base64, prefix
        };
        reader.readAsDataURL(selectedFile);
      });

      const importData: ExcelImportInput = {
        file_data: fileData,
        has_header: true
      };

      await trpc.importTransactionsFromExcel.mutate(importData);
      await loadData(); // Reload transactions
      
      setSelectedFile(null);
      setIsImportDialogOpen(false);
    } catch (error) {
      console.error('Failed to import Excel file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (transactionId: number) => {
    try {
      const success = await trpc.deleteTransaction.mutate(transactionId);
      if (success) {
        setTransactions((prev: Transaction[]) => 
          prev.filter((transaction: Transaction) => transaction.id !== transactionId)
        );
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const getItemName = (itemId: number) => {
    const item = items.find((item: Item) => item.id === itemId);
    return item?.name || `Item ${itemId}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>💳 Manajemen Transaksi</CardTitle>
              <CardDescription>
                Kelola data transaksi untuk analisis data mining
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    📊 Import Excel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Transaksi dari Excel</DialogTitle>
                    <DialogDescription>
                      Upload file Excel dengan format: tanggal, item1, item2, dst.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="excel-file">File Excel</Label>
                      <Input
                        id="excel-file"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                        }}
                      />
                    </div>
                    
                    {selectedFile && (
                      <Alert>
                        <AlertDescription>
                          File terpilih: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button 
                      onClick={handleFileImport} 
                      disabled={!selectedFile || isLoading}
                    >
                      {isLoading ? 'Mengimport...' : 'Import'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    ➕ Tambah Transaksi
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Tambah Transaksi Baru</DialogTitle>
                    <DialogDescription>
                      Buat transaksi baru dengan memilih barang dan jumlahnya
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Tanggal Transaksi</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.transaction_date.toISOString().split('T')[0]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateTransactionInput) => ({
                            ...prev,
                            transaction_date: new Date(e.target.value)
                          }))
                        }
                        required
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>Barang dalam Transaksi</Label>
                      
                      <div className="flex gap-2">
                        <Select 
                          value={newItem.item_id.toString()} 
                          onValueChange={(value: string) => 
                            setNewItem(prev => ({ ...prev, item_id: parseInt(value) }))
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Pilih barang" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item: Item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
                          }
                          placeholder="Qty"
                          className="w-20"
                        />
                        
                        <Button type="button" onClick={handleAddItem} disabled={newItem.item_id === 0}>
                          ➕
                        </Button>
                      </div>

                      {formData.items.length > 0 && (
                        <div className="border rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium">Barang yang dipilih:</p>
                          {formData.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">
                                {getItemName(item.item_id)} × {item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                              >
                                ❌
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button type="submit" disabled={isLoading || formData.items.length === 0}>
                        {isLoading ? 'Menyimpan...' : 'Simpan Transaksi'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">💳</span>
              <p className="text-gray-500 mb-4">Belum ada data transaksi</p>
              <p className="text-sm text-gray-400">Tambahkan transaksi atau import dari Excel untuk memulai</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: Transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">#{transaction.id}</TableCell>
                    <TableCell>{transaction.transaction_date.toLocaleDateString()}</TableCell>
                    <TableCell>{transaction.created_at.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm">
                          👁️ Detail
                        </Button>
                        {userRole === 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                🗑️ Hapus
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus transaksi #{transaction.id}? 
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(transaction.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
