import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { SEED } from '../lib/supabaseMock';
import { useNavigate } from '@tanstack/react-router';
import { 
  ArrowUpRight, Sparkles, Wallet, Calendar, Plus, TrendingUp, Settings
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
  const [loans, setLoans] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Pay Modal State
  const [payingBill, setPayingBill] = useState<any | null>(null);

  // Quick Add State
  const [quickAddVal, setQuickAddVal] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // Customization Dashboard Layout States
  const [activeWidgets, setActiveWidgets] = useState<string[]>(['standard', 'wealth', 'goals', 'bills', 'daily', 'merchants']);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [tempWidgets, setTempWidgets] = useState<string[]>(['standard', 'wealth', 'goals', 'bills', 'daily', 'merchants']);
  const [saveLayoutLoading, setSaveLayoutLoading] = useState(false);

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
        { data: settingsData },
        { data: loansData }
      ] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('budgets').select('*'),
        supabase.from('bills').select('*').order('due_date', { ascending: true }),
        supabase.from('goals').select('*'),
        supabase.from('user_settings').select('base_currency_id, dashboard_layout, currencies(symbol)').maybeSingle(),
        supabase.from('loans').select('*')
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

      if (settingsData && settingsData.dashboard_layout) {
        const layout = Array.isArray(settingsData.dashboard_layout)
          ? settingsData.dashboard_layout
          : [];
        if (layout.length > 0) {
          setActiveWidgets(layout);
        }
      }

      if (accountsData) setAccounts(accountsData);
      if (txData) setTransactions(txData);
      if (budgetData) setBudgets(budgetData);
      if (billsData) setBills(billsData);
      if (goalsData) setGoals(goalsData);
      if (loansData) setLoans(loansData);
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

  // Quick Add NLP Parser (Coffee 5, Uber 20)
  const autoCategorize = (text: string) => {
    const term = text.toLowerCase();
    if (term.includes('tea') || term.includes('coffee') || term.includes('starbucks') || term.includes('food') || term.includes('restaurant')) {
      return SEED.expense_categories.food;
    }
    if (term.includes('fuel') || term.includes('petrol') || term.includes('gas') || term.includes('uber') || term.includes('cab')) {
      return SEED.expense_categories.transport;
    }
    if (term.includes('rent') || term.includes('apartment') || term.includes('housing')) {
      return SEED.expense_categories.housing;
    }
    if (term.includes('wifi') || term.includes('internet') || term.includes('electricity')) {
      return SEED.expense_categories.utilities;
    }
    if (term.includes('netflix') || term.includes('spotify') || term.includes('gym')) {
      return SEED.expense_categories.entertainment;
    }
    return SEED.expense_categories.shopping;
  };

  const parseLocal = (val: string) => {
    const parts = val.trim().split(/\s+/);
    let amount = 0;
    let amountIndex = -1;

    for (let i = parts.length - 1; i >= 0; i--) {
      const num = parseFloat(parts[i]);
      if (!isNaN(num)) {
        amount = num;
        amountIndex = i;
        break;
      }
    }

    if (amountIndex === -1 || amount <= 0) {
      toast.error('Format incorrect. Type: [Merchant] [Amount] (e.g. Starbucks 5)');
      return null;
    }

    const merchantParts = parts.slice(0, amountIndex);
    const merchant = merchantParts.join(' ') || 'General Entry';
    const isIncome = merchant.toLowerCase().includes('salary') || merchant.toLowerCase().includes('paycheck') || merchant.toLowerCase().includes('freelance');
    const categoryId = isIncome ? SEED.income_categories.salary : autoCategorize(merchant);

    return { amount, merchant, isIncome, categoryId };
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddVal.trim() || accounts.length === 0) return;

    const apiKey = window.localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    
    let amount = 0;
    let merchant = 'General Entry';
    let isIncome = false;
    let categoryId = SEED.expense_categories.shopping;

    if (apiKey) {
      setQuickAddLoading(true);
      try {
        const prompt = `Parse this transaction into JSON. Return ONLY the JSON object.
Categories: Food, Transport, Housing, Utilities, Entertainment, Shopping.
Input: "${quickAddVal}"`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    merchant: { type: "STRING" },
                    amount: { type: "NUMBER" },
                    is_income: { type: "BOOLEAN" },
                    category: { type: "STRING", enum: ["Food", "Transport", "Housing", "Utilities", "Entertainment", "Shopping"] }
                  },
                  required: ["merchant", "amount", "is_income", "category"]
                }
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error('API request failed');
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) {
          throw new Error('No text returned from Gemini');
        }

        const parsed = JSON.parse(resultText);
        amount = parsed.amount || 0;
        merchant = parsed.merchant || 'General Entry';
        isIncome = !!parsed.is_income;

        // Map category
        if (isIncome) {
          const mLower = merchant.toLowerCase();
          if (mLower.includes('salary') || mLower.includes('paycheck')) {
            categoryId = SEED.income_categories.salary;
          } else if (mLower.includes('invest') || mLower.includes('stock') || mLower.includes('div')) {
            categoryId = SEED.income_categories.investments;
          } else {
            categoryId = SEED.income_categories.freelance;
          }
        } else {
          const cat = parsed.category;
          if (cat === 'Food') categoryId = SEED.expense_categories.food;
          else if (cat === 'Transport') categoryId = SEED.expense_categories.transport;
          else if (cat === 'Housing') categoryId = SEED.expense_categories.housing;
          else if (cat === 'Utilities') categoryId = SEED.expense_categories.utilities;
          else if (cat === 'Entertainment') categoryId = SEED.expense_categories.entertainment;
          else categoryId = SEED.expense_categories.shopping;
        }
      } catch (err) {
        console.error('Gemini NLP parsing failed, falling back to local:', err);
        const localParsed = parseLocal(quickAddVal);
        if (!localParsed) return;
        amount = localParsed.amount;
        merchant = localParsed.merchant;
        isIncome = localParsed.isIncome;
        categoryId = localParsed.categoryId;
      } finally {
        setQuickAddLoading(false);
      }
    } else {
      const localParsed = parseLocal(quickAddVal);
      if (!localParsed) return;
      amount = localParsed.amount;
      merchant = localParsed.merchant;
      isIncome = localParsed.isIncome;
      categoryId = localParsed.categoryId;
    }

    const newTx = {
      date: new Date().toISOString().split('T')[0],
      amount,
      transaction_type_id: isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
      category_id: categoryId,
      account_id: accounts[0].id,
      payment_method_id: SEED.payment_methods.debit_card,
      merchant,
      notes: `Quick entry: "${quickAddVal}"`,
      tags: ['Essential'],
      is_recurring: false
    };

    try {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) throw error;
      setQuickAddVal('');
      fetchData();
      toast.success('Quick entry saved successfully!');
    } catch (err) {
      toast.error('Error entering spend');
    }
  };

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
      toast.success('Payment recorded successfully');
    } catch (err) {
      toast.error('Error updating payment');
    }
  };

  // Sync temp widgets when dialog opens
  useEffect(() => {
    if (isCustomizeOpen) {
      setTempWidgets(activeWidgets);
    }
  }, [isCustomizeOpen, activeWidgets]);

  const handleSaveLayout = async () => {
    if (tempWidgets.length === 0) {
      toast.error('Please choose at least one panel to display.');
      return;
    }
    setSaveLayoutLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { dashboard_layout: tempWidgets }, 
          { onConflict: 'created_by' }
        );
      if (error) throw error;
      
      setActiveWidgets(tempWidgets);
      setIsCustomizeOpen(false);
      toast.success('Dashboard layout updated!');
    } catch (err: any) {
      toast.error('Error saving dashboard preferences');
    } finally {
      setSaveLayoutLoading(false);
    }
  };

  // Category Spending breakdown calculations
  const expenseTxs = transactions.filter(t => t.transaction_type_id === SEED.transaction_types.expense);
  const categorySums: Record<string, number> = {};
  expenseTxs.forEach(t => {
    const cId = t.category_id;
    (categorySums as any)[cId] = ((categorySums as any)[cId] || 0) + (parseFloat(t.amount) || 0);
  });
  
  const categoryBreakdown = Object.entries(categorySums).map(([catId, amount]) => {
    let name = 'General Spend';
    if (catId === SEED.expense_categories.food) name = 'Food';
    else if (catId === SEED.expense_categories.transport) name = 'Transport';
    else if (catId === SEED.expense_categories.housing) name = 'Housing';
    else if (catId === SEED.expense_categories.utilities) name = 'Utilities';
    else if (catId === SEED.expense_categories.entertainment) name = 'Entertainment';
    else if (catId === SEED.expense_categories.shopping) name = 'Shopping';
    return { name, amount: parseFloat(amount as any) || 0 };
  }).sort((a, b) => b.amount - a.amount);

  // 1. Daily velocity calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const spentToday = transactions
    .filter(t => t.date === todayStr && t.transaction_type_id === SEED.transaction_types.expense)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const currentDay = new Date().getDate();
  const dailyAverage = monthlyExpense / (currentDay || 1);
  const velocityDiff = dailyAverage > 0 ? ((spentToday - dailyAverage) / dailyAverage) * 100 : 0;

  // 2. Top Merchants leaderboard calculations
  const merchantSums: Record<string, { amount: number; count: number }> = {};
  monthlyTransactions
    .filter(t => t.transaction_type_id === SEED.transaction_types.expense)
    .forEach(t => {
      const name = t.merchant || 'General Payee';
      if (!merchantSums[name]) {
        merchantSums[name] = { amount: 0, count: 0 };
      }
      merchantSums[name].amount += parseFloat(t.amount) || 0;
      merchantSums[name].count += 1;
    });
  
  const topMerchants = Object.entries(merchantSums).map(([name, val]) => ({
    name,
    amount: val.amount,
    count: val.count
  })).sort((a, b) => b.amount - a.amount).slice(0, 5);



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

      {/* QUICK LOG CARD */}
      <Card className="border border-primary/20 bg-primary/5 shadow-xs">
        <CardContent className="p-4">
          <form onSubmit={handleQuickAdd} className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex items-center gap-1.5 text-primary shrink-0 select-none">
              <Sparkles className="h-4.5 w-4.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Quick Log</span>
            </div>
            <input 
              id="quick-expense-input"
              type="text" 
              placeholder='Type what you bought or earned (e.g. Starbucks 5 or Salary 2500)'
              value={quickAddVal}
              onChange={(e) => setQuickAddVal(e.target.value)}
              className="flex-1 w-full bg-background border border-border/80 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button type="submit" size="sm" loading={quickAddLoading} className="w-full md:w-auto cursor-pointer">
              Save Entry
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Title & Customizer Trigger */}
      <div className="flex justify-between items-center select-none mt-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Home Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome to your personal financial control center.</p>
        </div>
        <Button 
          onClick={() => setIsCustomizeOpen(true)} 
          variant="outline" 
          size="sm" 
          className="text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Customize Screen
        </Button>
      </div>

      {/* DASHBOARD SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Trends and coach */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Visual balance trend */}
          {activeWidgets.includes('standard') && (
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
          )}

          {/* Spending Insights panel */}
          {activeWidgets.includes('spending') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-primary" />
                    Spending Insights
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Distribution of your expenses by category</p>
                </div>

                {categoryBreakdown.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No expense records to analyze.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {categoryBreakdown.slice(0, 5).map((item, idx) => {
                      const totalExp = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0) || 1;
                      const pct = Math.round((item.amount / totalExp) * 100);
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold select-none">
                            <span className="text-foreground">{item.name}</span>
                            <span className="text-muted-foreground">
                              {currencySymbol}{item.amount.toFixed(2)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Daily Velocity panel */}
          {activeWidgets.includes('daily') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-primary" />
                    Daily Spend Velocity
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Today's spending pace compared to your daily average</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center select-none">
                    <div className="p-3 bg-muted/30 rounded-xl border border-border/30">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Spent Today</span>
                      <div className="text-lg font-bold text-foreground mt-1">
                        {currencySymbol}{spentToday.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-xl border border-border/30">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Daily Average</span>
                      <div className="text-lg font-bold text-muted-foreground mt-1">
                        {currencySymbol}{dailyAverage.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl flex items-center justify-between ${
                    velocityDiff > 0 ? 'bg-rose-500/5 border border-rose-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'
                  }`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase select-none">Pace Status</span>
                      <span className={`text-xs font-bold ${velocityDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {velocityDiff > 0 
                          ? `${velocityDiff.toFixed(0)}% above normal daily average` 
                          : `${Math.abs(velocityDiff).toFixed(0)}% below normal daily average`
                        }
                      </span>
                    </div>
                    <span className="text-base select-none">{velocityDiff > 0 ? '⚠️' : '✓'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Income vs Expense Cashflow panel */}
          {activeWidgets.includes('cashflow') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-4.5 w-4.5 text-emerald-500" />
                    Monthly Cash Flow Statement
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Detailed summary of your income vs expenses</p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs border-b border-border/30 pb-2">
                    <span className="text-muted-foreground font-semibold">Total Monthly Earnings</span>
                    <span className="font-bold text-emerald-500 font-mono">+{currencySymbol}{monthlyIncome.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-border/30 pb-2">
                    <span className="text-muted-foreground font-semibold">Total Monthly Expenditures</span>
                    <span className="font-bold text-rose-500 font-mono">-{currencySymbol}{monthlyExpense.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-foreground font-bold">Net Saved Cash Flow</span>
                    <span className={`font-mono font-bold ${(monthlyIncome - monthlyExpense) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(monthlyIncome - monthlyExpense) >= 0 ? '+' : ''}{currencySymbol}{(monthlyIncome - monthlyExpense).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Side: Next payments & quick launch actions */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Savings Goals progress card */}
          {activeWidgets.includes('wealth') && (
            <Card className="order-1">
              <CardContent className="p-5 space-y-4">
                <div className="select-none">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
                    Savings & Net Worth
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Assets minus liabilities & goal progress</p>
                </div>

                {(() => {
                  const checkingSavings = totalBalance;
                  const liabilities = loans.reduce((sum, l) => sum + (parseFloat(l.outstanding_amount) || 0), 0);
                  const netWorth = checkingSavings - liabilities;
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-center py-1 select-none">
                        <div className="p-2.5 bg-muted/30 rounded-xl border border-border/30">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">Liquid Assets</span>
                          <div className="text-xs font-bold text-emerald-500 mt-1">
                            {currencySymbol}{checkingSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="p-2.5 bg-muted/30 rounded-xl border border-border/30">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">Liabilities</span>
                          <div className="text-xs font-bold text-destructive mt-1">
                            {currencySymbol}{liabilities.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase select-none">Total Net Worth</span>
                          <span className="text-base font-bold text-foreground mt-0.5">
                            {currencySymbol}{netWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${netWorth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {netWorth >= 0 ? '✓' : '⚠️'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Savings Goals progress card */}
          {activeWidgets.includes('goals') && (
            <Card className="order-1">
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
                        <ProgressCircle value={pct} size={85} strokeWidth={7}>
                          <div className="text-center flex flex-col">
                            <span className="text-lg font-bold text-foreground">{pct}%</span>
                            <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">Saved</span>
                          </div>
                        </ProgressCircle>
                      </div>
                      <div className="w-full text-center space-y-1 select-none">
                        <div className="text-xs font-bold text-foreground">
                          {currencySymbol}{totalCurrent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          <span className="text-[10px] text-muted-foreground font-normal"> saved of </span>
                          {currencySymbol}{totalTarget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-[9px] text-muted-foreground">
                          Across {goals.length} active savings {goals.length === 1 ? 'goal' : 'goals'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Payments list */}
          {activeWidgets.includes('bills') && (
            <Card className="order-2">
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
          )}

          {/* Top Merchants leaderboard panel */}
          {activeWidgets.includes('merchants') && (
            <Card className="order-2">
              <CardContent className="p-5 space-y-4">
                <div className="select-none">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary" />
                    Top Merchants
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Places you spend money most frequently</p>
                </div>

                {topMerchants.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No expenditures this month to analyze.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {topMerchants.map((merchant, idx) => {
                      const totalExpenses = topMerchants.reduce((sum, m) => sum + m.amount, 0) || 1;
                      const pct = Math.round((merchant.amount / totalExpenses) * 100);
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-border/30 pb-2 last:border-0 last:pb-0">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{merchant.name}</span>
                            <span className="text-[9px] text-muted-foreground mt-0.5">
                              {merchant.count} transaction{merchant.count === 1 ? '' : 's'} ({pct}%)
                            </span>
                          </div>
                          <span className="font-mono font-bold text-rose-500">
                            {currencySymbol}{merchant.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick launch guide */}
          <Card className="order-3">
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

      {/* CUSTOMIZE SCREEN DIALOG */}
      <Dialog
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        title="Customize Dashboard Layout"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground select-none">
            Toggle which visualization panels you want to see on your home screen. We will remember these selections for your account.
          </p>

          <div className="space-y-3">
            {[
              { id: 'standard', title: 'Balance Trend Chart', desc: 'Six-month balance progression and financial trajectory.' },
              { id: 'spending', title: 'Spending Insights', desc: 'Category-wise spending distribution with progress bars.' },
              { id: 'daily', title: 'Daily Spend Velocity', desc: 'Analyze spent today compared to daily monthly average.' },
              { id: 'cashflow', title: 'Monthly Cash Flow', desc: 'Detailed summary of monthly income vs expenses.' },
              { id: 'wealth', title: 'Net Worth Statement', desc: 'Assets vs outstanding loan liabilities comparison.' },
              { id: 'goals', title: 'Savings Progress', desc: 'Standalone progress indicator tracking active savings goals.' },
              { id: 'bills', title: 'Upcoming Bills Due', desc: 'List of next 3 due bills and repayment statuses.' },
              { id: 'merchants', title: 'Top Merchants Leaderboard', desc: 'Leaderboard of places you spent money most frequently.' }
            ].map((widget) => {
              const isChecked = tempWidgets.includes(widget.id);
              return (
                <label 
                  key={widget.id} 
                  className="flex items-start gap-3 p-3 rounded-xl border border-border/80 hover:bg-muted/10 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setTempWidgets(tempWidgets.filter(id => id !== widget.id));
                      } else {
                        setTempWidgets([...tempWidgets, widget.id]);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground select-none">{widget.title}</div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 select-none">{widget.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-2 select-none">
            <Button type="button" variant="outline" onClick={() => setIsCustomizeOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              loading={saveLayoutLoading}
              onClick={handleSaveLayout}
            >
              Save Preferences
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};
