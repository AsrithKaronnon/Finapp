import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, TrendingUp, TrendingDown, Landmark, PieChart as PieIcon, Percent, Trash2 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

export const Investments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<any[]>([]);
  const [investmentTypes, setInvestmentTypes] = useState<any[]>([]);
  
  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    investment_type_id: SEED.investment_types.stocks,
    total_invested: 0,
    current_value: 0,
    allocation_pct: 0,
    monthly_contribution: 0
  });

  const [currencySymbol, setCurrencySymbol] = useState('$');

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const [
        { data: invData },
        { data: typesData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('investments').select('*'),
        supabase.from('investment_types').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (invData) setInvestments(invData);
      if (typesData) setInvestmentTypes(typesData);

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
    } catch (err) {
      console.error('Error fetching investments portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      investment_type_id: SEED.investment_types.stocks,
      total_invested: 0,
      current_value: 0,
      allocation_pct: 0,
      monthly_contribution: 0
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('investments').insert([formData]);
      if (error) throw error;
      setIsModalOpen(false);
      fetchInvestments();
    } catch (err) {
      alert('Error logging investment asset');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this investment asset from your portfolio?')) return;
    try {
      await supabase.from('investments').delete().eq('id', id);
      fetchInvestments();
    } catch (err) {
      alert('Error deleting asset');
    }
  };

  // Portfolio Calculations
  const totalInvested = investments.reduce((acc, curr) => acc + curr.total_invested, 0);
  const currentValuation = investments.reduce((acc, curr) => acc + curr.current_value, 0);
  const totalReturns = currentValuation - totalInvested;
  const returnsPct = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
  
  // Recharts Pie Chart configuration
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7'];
  const pieData = investments.map(inv => {
    const typeLabel = investmentTypes.find(t => t.id === inv.investment_type_id)?.name || 'Other';
    return {
      name: `${inv.name.split(' (')[0]} (${typeLabel})`,
      value: inv.current_value
    };
  });

  const performanceHistoryData = [
    { name: 'Feb', Invested: totalInvested * 0.85, Valuation: (totalInvested * 0.85) * 0.95 },
    { name: 'Mar', Invested: totalInvested * 0.90, Valuation: (totalInvested * 0.90) * 1.02 },
    { name: 'Apr', Invested: totalInvested * 0.92, Valuation: (totalInvested * 0.92) * 1.05 },
    { name: 'May', Invested: totalInvested * 0.95, Valuation: (totalInvested * 0.95) * 1.04 },
    { name: 'Jun', Invested: totalInvested * 0.98, Valuation: (totalInvested * 0.98) * 1.07 },
    { name: 'Jul', Invested: totalInvested, Valuation: currentValuation }
  ];

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Investments Command
          </h1>
          <p className="text-sm text-muted-foreground">Manage and trace your long-term equities, mutual funds, crypto, and retirements.</p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Log Investment
        </Button>
      </div>

      {/* PORTFOLIO HIGHLIGHT KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        
        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Invested Principal</span>
              <span className="text-xl font-bold text-foreground">{currencySymbol}{totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Market Value</span>
              <span className="text-xl font-bold text-foreground">{currencySymbol}{currentValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Absolute Returns (P&L)</span>
              <span className={`text-xl font-bold flex items-center gap-1 ${totalReturns >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totalReturns >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {currencySymbol}{Math.abs(totalReturns).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CAGR Growth Gain</span>
              <span className={`text-xl font-bold flex items-center gap-1 ${totalReturns >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                <Percent className="h-4 w-4" />
                {returnsPct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {loading ? (
        <div className="h-64 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : investments.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
          <TrendingUp className="h-12 w-12 text-muted-foreground/60" />
          <div className="text-sm font-semibold text-foreground">Portfolio Empty</div>
          <Button size="sm" onClick={handleOpenAdd}>
            Log First Asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Performance chart */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Asset Growth Trajectory</CardTitle>
                <CardDescription>Tracing invested capital vs market valuation returns over time</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceHistoryData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValuation" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="Valuation" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValuation)" />
                      <Area type="monotone" dataKey="Invested" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Grid List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ledger Positions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold select-none">
                        <th className="p-3 pl-5">Asset</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Total Invested</th>
                        <th className="p-3 text-right">Current Valuation</th>
                        <th className="p-3 text-right">P&L Gain</th>
                        <th className="p-3 text-center">Weight</th>
                        <th className="p-3 pr-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((inv) => {
                        const type = investmentTypes.find(t => t.id === inv.investment_type_id)?.name || 'Equities';
                        const gain = inv.current_value - inv.total_invested;
                        const gainPct = inv.total_invested > 0 ? (gain / inv.total_invested) * 100 : 0;
                        const weight = currentValuation > 0 ? Math.round((inv.current_value / currentValuation) * 100) : 0;

                        return (
                          <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/10">
                            <td className="p-3 pl-5 font-semibold text-foreground">{inv.name}</td>
                            <td className="p-3"><Badge variant="primary" className="text-[9px]">{type}</Badge></td>
                            <td className="p-3 text-right font-mono font-medium">{currencySymbol}{inv.total_invested.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono font-bold">{currencySymbol}{inv.current_value.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">
                              <span className={`font-semibold ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {gain >= 0 ? '+' : ''}{currencySymbol}{gain.toLocaleString()} ({gainPct.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-muted-foreground">{weight}%</td>
                            <td className="p-3 pr-5 text-center">
                              <button
                                onClick={() => handleDelete(inv.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors inline-flex"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Allocation Donut right panel */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <PieIcon className="h-4 w-4 text-primary" />
                  Asset Allocation Weights
                </CardTitle>
                <CardDescription>Capital concentration weighting across classes</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center items-center py-4">
                <div className="h-[200px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend list */}
                <div className="w-full space-y-2 mt-4 text-[10px] select-none border-t border-border/40 pt-4">
                  {investments.map((inv, idx) => {
                    const weight = currentValuation > 0 ? Math.round((inv.current_value / currentValuation) * 100) : 0;
                    return (
                      <div key={inv.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[150px]">{inv.name}</span>
                        </div>
                        <span className="font-bold text-foreground">{weight}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* CREATE NEW INVESTMENT DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Investment Asset"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Asset Name / ISIN / Symbol</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="e.g. Apple Inc. (AAPL), Vanguard VOO"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Total Capital Invested ({currencySymbol})</label>
              <input
                type="number"
                required
                value={formData.total_invested || ''}
                onChange={(e) => setFormData({ ...formData, total_invested: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Current Market Valuation ({currencySymbol})</label>
              <input
                type="number"
                required
                value={formData.current_value || ''}
                onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Monthly Contribution ({currencySymbol})</label>
              <input
                type="number"
                value={formData.monthly_contribution || ''}
                onChange={(e) => setFormData({ ...formData, monthly_contribution: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="e.g. 500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Asset Class</label>
              <select
                value={formData.investment_type_id}
                onChange={(e) => setFormData({ ...formData, investment_type_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {investmentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Log Asset Position
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
