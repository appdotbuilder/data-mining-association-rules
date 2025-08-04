
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { 
  MiningParameters, 
  MiningResult, 
  MiningComparison, 
  FrequentItemset, 
  AssociationRule 
} from '../../../server/src/schema';

export function MiningDashboard() {
  const [miningResults, setMiningResults] = useState<MiningResult[]>([]);
  const [currentResult, setCurrentResult] = useState<MiningResult | null>(null);
  const [comparison, setComparison] = useState<MiningComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('run');
  
  const [parameters, setParameters] = useState<MiningParameters>({
    min_support: 0.1,
    min_confidence: 0.5,
    algorithm: 'apriori'
  });

  const loadMiningResults = useCallback(async () => {
    try {
      const results = await trpc.getMiningResults.query();
      setMiningResults(results);
    } catch (error) {
      console.error('Failed to load mining results:', error);
    }
  }, []);

  useEffect(() => {
    loadMiningResults();
  }, [loadMiningResults]);

  const handleRunSingleAlgorithm = async () => {
    setIsLoading(true);
    try {
      let result: MiningResult;
      
      if (parameters.algorithm === 'apriori') {
        result = await trpc.runAprioriMining.mutate(parameters);
      } else {
        result = await trpc.runFPGrowthMining.mutate(parameters);
      }
      
      setCurrentResult(result);
      setMiningResults((prev: MiningResult[]) => [...prev, result]);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to run mining algorithm:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareAlgorithms = async () => {
    setIsLoading(true);
    try {
      const comparisonResult = await trpc.compareMiningResults.mutate(parameters);
      setComparison(comparisonResult);
      
      // Add both results to the results list
      if (comparisonResult.apriori_result) {
        setMiningResults((prev: MiningResult[]) => [...prev, comparisonResult.apriori_result!]);
      }
      if (comparisonResult.fp_growth_result) {
        setMiningResults((prev: MiningResult[]) => [...prev, comparisonResult.fp_growth_result!]);
      }
      
      setActiveTab('comparison');
    } catch (error) {
      console.error('Failed to compare algorithms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="run">⚡ Jalankan Mining</TabsTrigger>
          <TabsTrigger value="results">📊 Hasil Tunggal</TabsTrigger>
          <TabsTrigger value="comparison">🔄 Perbandingan</TabsTrigger>
          <TabsTrigger value="history">📈 Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Konfigurasi Mining</CardTitle>
              <CardDescription>
                Atur parameter untuk analisis data mining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_support">Minimum Support ({parameters.min_support})</Label>
                    <Input
                      id="min_support"
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={parameters.min_support}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setParameters((prev: MiningParameters) => ({ 
                          ...prev, 
                          min_support: parseFloat(e.target.value) || 0.1 
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Nilai antara 0.01 - 1.0 (contoh: 0.1 = 10%)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min_confidence">Minimum Confidence ({parameters.min_confidence})</Label>
                    <Input
                      id="min_confidence"
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={parameters.min_confidence}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setParameters((prev: MiningParameters) => ({ 
                          ...prev, 
                          min_confidence: parseFloat(e.target.value) || 0.5 
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Nilai antara 0.01 - 1.0 (contoh: 0.5 = 50%)
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Algoritma</Label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="algorithm"
                          value="apriori"
                          checked={parameters.algorithm === 'apriori'}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setParameters((prev: MiningParameters) => ({ 
                              ...prev, 
                              algorithm: e.target.value as 'apriori' | 'fp_growth'
                            }))
                          }
                        />
                        <span>🔍 Apriori</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="algorithm"
                          value="fp_growth"
                          checked={parameters.algorithm === 'fp_growth'}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setParameters((prev: MiningParameters) => ({ 
                              ...prev, 
                              algorithm: e.target.value as 'apriori' | 'fp_growth'
                            }))
                          }
                        />
                        <span>🌳 FP-Growth</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <Button 
                  onClick={handleRunSingleAlgorithm} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? '⏳ Memproses...' : `🚀 Jalankan ${parameters.algorithm === 'apriori' ? 'Apriori' : 'FP-Growth'}`}
                </Button>
                
                <Button 
                  onClick={handleCompareAlgorithms} 
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {isLoading ? '⏳ Membandingkan...' : '🔄 Bandingkan Kedua Algoritma'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {currentResult ? (
            <MiningResultDisplay result={currentResult} />
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <span className="text-6xl mb-4 block">📊</span>
                <p className="text-gray-500 mb-4">Belum ada hasil mining</p>
                <p className="text-sm text-gray-400">Jalankan algoritma untuk melihat hasil</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          {comparison ? (
            <ComparisonDisplay comparison={comparison} />
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <span className="text-6xl mb-4 block">🔄</span>
                <p className="text-gray-500 mb-4">Belum ada perbandingan</p>
                <p className="text-sm text-gray-400">Jalankan perbandingan untuk melihat hasil</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📈 Riwayat Mining</CardTitle>
              <CardDescription>
                Daftar semua hasil mining yang pernah dijalankan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {miningResults.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-6xl mb-4 block">📈</span>
                  <p className="text-gray-500 mb-4">Belum ada riwayat mining</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Algoritma</TableHead>
                      <TableHead>Support</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Itemsets</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead>Waktu Eksekusi</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {miningResults.map((result: MiningResult) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <Badge variant={result.algorithm === 'apriori' ? 'default' : 'secondary'}>
                            {result.algorithm === 'apriori' ? '🔍 Apriori' : '🌳 FP-Growth'}
                          </Badge>
                        </TableCell>
                        <TableCell>{result.parameters.min_support}</TableCell>
                        <TableCell>{result.parameters.min_confidence}</TableCell>
                        <TableCell>{result.frequent_itemsets.length}</TableCell>
                        <TableCell>{result.association_rules.length}</TableCell>
                        <TableCell>{formatExecutionTime(result.execution_time_ms)}</TableCell>
                        <TableCell>{result.created_at.toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentResult(result);
                              setActiveTab('results');
                            }}
                          >
                            👁️ Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component for displaying single mining result
function MiningResultDisplay({ result }: { result: MiningResult }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.algorithm === 'apriori' ? '🔍' : '🌳'} 
            Hasil {result.algorithm === 'apriori' ? 'Apriori' : 'FP-Growth'}
          </CardTitle>
          <CardDescription>
            Support: {result.parameters.min_support} | Confidence: {result.parameters.min_confidence}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.frequent_itemsets.length}</div>
              <div className="text-sm text-blue-500">Frequent Itemsets</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.association_rules.length}</div>
              <div className="text-sm text-green-500">Association Rules</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{result.execution_time_ms}ms</div>
              <div className="text-sm text-purple-500">Execution Time</div>
            </div>
          </div>

          <Tabs defaultValue="itemsets">
            <TabsList>
              <TabsTrigger value="itemsets">Frequent Itemsets</TabsTrigger>
              <TabsTrigger value="rules">Association Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="itemsets">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Itemset</TableHead>
                    <TableHead>Support</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.frequent_itemsets.map((itemset: FrequentItemset, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {itemset.itemset.map((item: string, i: number) => (
                            <Badge key={i} variant="outline">{item}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{itemset.support.toFixed(3)}</TableCell>
                      <TableCell>{itemset.count}</TableCell>
                    </TableRow>
                  ))}
                  {result.frequent_itemsets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">
                        Tidak ada frequent itemsets ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="rules">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Antecedent</TableHead>
                    <TableHead>Consequent</TableHead>
                    <TableHead>Support</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Lift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.association_rules.map((rule: AssociationRule, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {rule.antecedent.map((item: string, i: number) => (
                            <Badge key={i} variant="outline">{item}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {rule.consequent.map((item: string, i: number) => (
                            <Badge key={i} variant="secondary">{item}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{rule.support.toFixed(3)}</TableCell>
                      <TableCell>{rule.confidence.toFixed(3)}</TableCell>
                      <TableCell>{rule.lift.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                  {result.association_rules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Tidak ada association rules ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for displaying algorithm comparison
function ComparisonDisplay({ comparison }: { comparison: MiningComparison }) {
  const { apriori_result, fp_growth_result, comparison_metrics } = comparison;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔄 Perbandingan Algoritma</CardTitle>
          <CardDescription>
            Hasil perbandingan antara Apriori dan FP-Growth
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparison_metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">📊 Metrik Perbandingan</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>Selisih Waktu Eksekusi:</span>
                    <Badge variant={comparison_metrics.execution_time_difference > 0 ? 'destructive' : 'default'}>
                      {Math.abs(comparison_metrics.execution_time_difference)}ms
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>Selisih Jumlah Itemsets:</span>
                    <Badge variant="secondary">
                      {comparison_metrics.itemsets_count_difference}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>Selisih Jumlah Rules:</span>
                    <Badge variant="secondary">
                      {comparison_metrics.rules_count_difference}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">🏆 Kesimpulan</h3>
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>
                        <strong>Algoritma Tercepat:</strong>{' '}
                        {comparison_metrics.faster_algorithm === 'apriori' ? '🔍 Apriori' : '🌳 FP-Growth'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Berdasarkan waktu eksekusi dengan parameter yang sama.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {apriori_result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🔍 Hasil Apri ori</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Frequent Itemsets:</span>
                      <span className="font-medium">{apriori_result.frequent_itemsets.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Association Rules:</span>
                      <span className="font-medium">{apriori_result.association_rules.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Waktu Eksekusi:</span>
                      <span className="font-medium">{apriori_result.execution_time_ms}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {fp_growth_result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🌳 Hasil FP-Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Frequent Itemsets:</span>
                      <span className="font-medium">{fp_growth_result.frequent_itemsets.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Association Rules:</span>
                      <span className="font-medium">{fp_growth_result.association_rules.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Waktu Eksekusi:</span>
                      <span className="font-medium">{fp_growth_result.execution_time_ms}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
