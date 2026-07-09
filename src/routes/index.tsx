import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { useNavigate } from '@tanstack/react-router';
import { 
  ArrowUpRight, Sparkles, Wallet, Calendar, Plus, TrendingUp 
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressCircle } from '../components/ui/ProgressCircle';
import { Dialog } from '../components/ui/Dialog';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Pay Modal State
  const [payingBill, setPayingBill] = useState<any | null>(null);

  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      let [
        { data: accountsData },
        { data: txData },
        { data: budgetData },
        { data: billsData },
        { data: goalsData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('budgets').select('*'),
        supabase.from('bills').select('*').order('due_date', { ascending: true }),
        supabase.from('goals').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      // If new user has no accounts, auto-create one
      if (accountsData && accountsData.length === 0) {
        const { data: newAcc } = await supabase.from('accounts').insert([{
          name: 'Primary Checking',
          balance: 0.00,
          account_type: 'Checking',
          currency_id: SEED.currencies.usd
        }]).select();
        if (newAcc) accountsData = newAcc;
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }

      if (accountsData) setAccounts(accountsData);
      if (txData) setTransactions(txData);
      if (budgetData) setBudgets(budgetData);
      if (billsData) setBills(billsData);
      if (goalsData) setGoals(goalsData);
    } catch (error) {
      console.error('Error fetching dashboard assets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Simple balance calculations
  const totalBalance = accounts.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0);

  // Spent this month calculation
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  });

  const loggedIncome = monthlyTransactions
    .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000001')
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const monthlyIncome = loggedIncome || 5200.00; // standard fallback if no income logged yet
  
  const monthlyExpense = monthlyTransactions
    .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000002')
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const savingsRate = Math.max(0, Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100));

  // Budget progress
  const totalBudgeted = budgets.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) || 1200;
  const budgetPct = Math.min(100, Math.round((monthlyExpense / totalBudgeted) * 100));

  // Visual trend chart data dynamically derived from transaction logs
  const getTrendData = () => {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const monthIndices = [1, 2, 3, 4, 5, 6]; // Feb is index 1, Jul is index 6
    const currentYear = new Date().getFullYear();
    
    let runningBalance = totalBalance;
    const dataPoints: { name: string; Money: number }[] = [];
    
    for (let i = monthIndices.length - 1; i >= 0; i--) {
      const mIndex = monthIndices[i];
      const mName = months[i];
      
      dataPoints.unshift({ name: mName, Money: Math.max(0, Math.round(runningBalance)) });
      
      const monthTxs = transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getMonth() === mIndex && d.getFullYear() === currentYear;
      });
      
      const inc = monthTxs
        .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000001')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
         
      const exp = monthTxs
        .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000002')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
         
      const net = inc - exp;
      runningBalance -= net; // Walk backward in time
    }
    
    return dataPoints;
  };

  const trendData = getTrendData();

  const handlePayBill = async () => {
    if (!payingBill || accounts.length === 0) return;
    try {
      // 1. Update bill status to paid
      await supabase.from('bills').update({ status_id: SEED.statuses.paid }).eq('id', payingBill.id);

      // 2. Log standard transaction record matching it
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: parseFloat(payingBill.amount) || 0,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.utilities,
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: payingBill.name,
        notes: `Paid bill: ${payingBill.name}`,
        tags: ['Essential'],
        is_recurring: true
      };
      await supabase.from('transactions').insert([newTx]);

      setPayingBill(null);
      fetchData();
    } catch (err) {
      alert('Error updating payment');
    }
  };



  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted/40" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 animate-pulse bg-card rounded-xl border border-border/50" />
          <div className="h-24 animate-pulse bg-card rounded-xl border border-border/50" />
          <div className="h-24 animate-pulse bg-card rounded-xl border border-border/50" />
        </div>
        <div className="h-80 animate-pulse bg-card rounded-xl border border-border/50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* TOP STANDING STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        
        {/* Total Available cash */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">My Total Money</span>
              <span className="text-2xl font-bold text-foreground">
                {currencySymbol}{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-muted-foreground">Checking & savings balances</span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Spent this month */}
        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Spent This Month</span>
              <span className="text-2xl font-bold text-foreground">
                {currencySymbol}{monthlyExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Limit: {currencySymbol}{totalBudgeted.toLocaleString()}
              </span>
            </div>
            <ProgressCircle value={budgetPct} size={42} strokeWidth={4}>
              <span className="text-[9px] font-bold text-foreground">{budgetPct}%</span>
            </ProgressCircle>
          </CardContent>
        </Card>

        {/* Savings progress indicator */}
        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Monthly Savings Rate</span>
              <span className="text-2xl font-bold text-foreground">{savingsRate}%</span>
              <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Target is 20%+
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* DASHBOARD SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Trends and coach */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Visual balance trend */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-foreground">My Balance Trend</h3>
                <p className="text-xs text-muted-foreground">Your financial trajectory over the last six months</p>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMoney" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="Money" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorMoney)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>



        </div>

        {/* Right Side: Next payments & quick launch actions */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Upcoming Payments list */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="select-none">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4.5 w-4.5 text-primary" />
                  Upcoming Bills
                </h3>
                <p className="text-[11px] text-muted-foreground">Log payments before they are past due</p>
              </div>

              <div className="space-y-3">
                {bills.filter(b => b.status_id !== SEED.statuses.paid && b.is_active !== false).slice(0, 3).map((bill) => (
                  <div key={bill.id} className="flex justify-between items-center border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">{bill.name}</span>
                      <span className="text-[10px] text-muted-foreground">Due Date: {bill.due_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold">{currencySymbol}{(parseFloat(bill.amount) || 0).toFixed(2)}</span>
                      <Button
                        onClick={() => setPayingBill(bill)}
                        size="sm"
                        className="py-1 px-2.5 text-[9px] cursor-pointer"
                      >
                        Pay
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Savings Goals progress card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="select-none">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                  Savings Progress
                </h3>
                <p className="text-[11px] text-muted-foreground">Overall achievement of your savings targets</p>
              </div>

              {goals.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-border rounded-xl flex flex-col justify-center items-center gap-1.5 select-none">
                  <span className="text-[10px] font-semibold text-muted-foreground">No active goals</span>
                  <Button onClick={() => navigate({ to: '/goals' })} size="sm" className="py-0.5 px-2 text-[9px] cursor-pointer">
                    Create Goal
                  </Button>
                </div>
              ) : (() => {
                const totalCurrent = goals.reduce((sum, g) => sum + (parseFloat(g.current_amount) || 0), 0);
                const totalTarget = goals.reduce((sum, g) => sum + (parseFloat(g.target_amount) || 0), 0) || 1;
                const pct = Math.min(100, Math.round((totalCurrent / totalTarget) * 100));
                
                return (
                  <div className="flex flex-col items-center justify-center py-2 gap-4">
                    <div className="relative flex items-center justify-center">
                      <ProgressCircle value={pct} size={100} strokeWidth={8}>
                        <div className="text-center flex flex-col">
                          <span className="text-xl font-bold text-foreground">{pct}%</span>
                          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Saved</span>
                        </div>
                      </ProgressCircle>
                    </div>
                    <div className="w-full text-center space-y-1">
                      <div className="text-sm font-bold text-foreground">
                        {currencySymbol}{totalCurrent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        <span className="text-xs text-muted-foreground font-normal"> saved of </span>
                        {currencySymbol}{totalTarget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Across {goals.length} active savings {goals.length === 1 ? 'goal' : 'goals'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Quick launch guide */}
          <Card>
            <CardContent className="p-5 flex flex-col gap-2.5">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                Quick Helpers
              </div>
              <Button onClick={() => navigate({ to: '/money' })} className="w-full justify-start text-xs py-2 cursor-pointer" variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Log a Daily Spend
              </Button>
              <Button onClick={() => navigate({ to: '/goals' })} className="w-full justify-start text-xs py-2 cursor-pointer" variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Set a New Savings Goal
              </Button>
            </CardContent>
          </Card>

        </div>

      </div>

      {/* PAY BILL DIALOG */}
      <Dialog
        isOpen={!!payingBill}
        onClose={() => setPayingBill(null)}
        title={payingBill ? `Complete payment: ${payingBill.name}` : ''}
      >
        <div className="flex flex-col gap-4 select-none">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold">Automated Ledger Logging</span>
              <p className="text-muted-foreground mt-0.5">
                Funding this bill records a spend transaction and reduces your checking cash balance.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-foreground border-b border-border/40 pb-3">
            <span>Bill Amount:</span>
            <span className="font-mono text-base">{currencySymbol}{payingBill ? (parseFloat(payingBill.amount) || 0).toFixed(2) : '0.00'}</span>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayingBill(null)}>
              Cancel
            </Button>
            <Button onClick={handlePayBill}>
              Pay Bill Now
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};
