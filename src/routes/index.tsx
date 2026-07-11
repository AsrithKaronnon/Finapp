import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { SEED } from '../lib/supabaseMock';
import { useNavigate } from '@tanstack/react-router';
import { 
  Sparkles, Wallet, Calendar, Plus, TrendingUp, Settings, CreditCard
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressCircle } from '../components/ui/ProgressCircle';
import { Dialog } from '../components/ui/Dialog';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend
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
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [spendingFilter, setSpendingFilter] = useState<'month'|'lastMonth'|'year'>('month');
  const [activeWidgets, setActiveWidgets] = useState<string[]>(['daily', 'wealth', 'goals']);
  const [tempWidgets, setTempWidgets] = useState<string[]>(['daily', 'wealth', 'goals']);
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

  // Budget progress (only for categories with defined budgets)
  const totalBudgeted = budgets.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id));
  const budgetedExpense = monthlyTransactions
    .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000002' && budgetedCategoryIds.has(tx.category_id))
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    
  const budgetPct = totalBudgeted > 0 ? Math.min(100, Math.round((budgetedExpense / totalBudgeted) * 100)) : 0;

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

  // --- NEW CHARTS DATA ---
  
  // 1. Monthly Cash Flow (last 12 months)
  const getMonthlyCashFlowData = () => {
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = d.toLocaleString('default', { month: 'short' });
      
      const monthTxs = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
      });
      
      const income = monthTxs
        .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000001')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
        
      const expense = monthTxs
        .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000002')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
        
      data.push({ name: mName, Income: Math.round(income), Expenses: Math.round(expense) });
    }
    return data;
  };
  const cashFlowData = getMonthlyCashFlowData();

  // 2. Spending by Category
  const [allCats, setAllCats] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('expense_categories').select('*').then(({ data }) => {
      if (data) setAllCats(data);
    });
  }, []);

  const getSpendingData = () => {
    const now = new Date();
    const filteredTxs = transactions.filter(tx => {
      if (tx.transaction_type_id !== 't0000000-0000-0000-0000-000000000002') return false;
      const txDate = new Date(tx.date);
      if (spendingFilter === 'month') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (spendingFilter === 'lastMonth') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
      } else {
        return txDate.getFullYear() === now.getFullYear();
      }
    });

    const categoryMap = new Map<string, number>();
    filteredTxs.forEach(tx => {
      const amt = parseFloat(tx.amount) || 0;
      const catObj = allCats.find((c: any) => c.id === tx.category_id);
      const catName = catObj ? catObj.name : 'Unknown';
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + amt);
    });

    return Array.from(categoryMap.entries())
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8); // top 8
  };
  const spendingData = getSpendingData();

  // 2.5 Budget Usage Data
  const getBudgetUsageData = () => {
    return budgets.map(budget => {
      const catObj = allCats.find((c: any) => c.id === budget.category_id);
      const name = catObj ? catObj.name : 'Custom';
      const limit = parseFloat(budget.amount) || 0;
      
      const used = monthlyTransactions
        .filter(tx => tx.transaction_type_id === 't0000000-0000-0000-0000-000000000002' && tx.category_id === budget.category_id)
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
        
      return {
        name,
        Limit: limit,
        Used: Math.round(used)
      };
    });
  };
  const budgetUsageData = getBudgetUsageData();

  // 3. Net Worth Trend (6 months)
  const getNetWorthData = () => {
    const currentLiabilities = loans.reduce((sum, l) => sum + (parseFloat(l.outstanding_amount) || 0), 0);
    return trendData.map(d => ({
      name: d.name,
      NetWorth: d.Money - currentLiabilities
    }));
  };
  const netWorthData = getNetWorthData();

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

    let apiKey = window.localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      try {
        const { data } = await supabase.from('secrets').select('key_value').eq('key_name', 'gemini_api_key').single();
        if (data?.key_value) apiKey = data.key_value;
      } catch (err) {
        console.warn('Could not fetch gemini key from secrets table', err);
      }
    }
    
    let amount = 0;
    let merchant = 'General Entry';
    let isIncome = false;
    let categoryId = SEED.expense_categories.shopping;

    if (apiKey) {
      setQuickAddLoading(true);
      try {
        const prompt = `Parse this transaction into JSON. 
CRITICAL RULE: The \`merchant\` field MUST be ONLY the core item or merchant name (1-3 words max). Strip ALL conversational filler like "hey", "I bought", "a", "some", "for". 
Example 1: "hey i just baught a samosa for 20 rs" -> merchant: "Samosa"
Example 2: "paid netflix 15 dollars" -> merchant: "Netflix"
Return ONLY the JSON object.
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
      toast.success('Quick entry saved');
    } catch (err) {
      toast.error('Error entering spend');
    }
  };

  const handlePayBill = async () => {
    if (!payingBill || accounts.length === 0) return;
    try {
      // 1. Update bill status to paid
      // If not recurring, mark inactive
      const updates: any = { status_id: SEED.statuses.paid };
      if (payingBill.recurrence_type_id === SEED.recurrences.one_time) {
        updates.is_active = false;
      }
      await supabase.from('bills').update(updates).eq('id', payingBill.id);

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
      toast.success('Payment recorded');
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
  
  // @ts-ignore
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
      
      {/* HEADER: Title & Customizer */}
      <div className="flex justify-between items-end select-none mb-4 sm:mb-6">
        <div>
          <h1 className="page-title text-foreground">Home Dashboard</h1>
          <p className="secondary-text">Welcome to your personal financial control center.</p>
        </div>
        <Button 
          onClick={() => setIsCustomizeOpen(true)} 
          variant="outline" 
          size="sm" 
          className="flex items-center justify-center cursor-pointer h-10 w-10 p-0 sm:w-auto sm:px-3 sm:py-1.5 sm:gap-1.5 rounded-full sm:rounded-lg"
        >
          <Settings className="icon-inline" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </div>

      {/* TOP STANDING STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 select-none mb-6">
        
        {/* Total Available cash */}
        <Card className="col-span-2 sm:col-span-1 h-[90px] sm:h-[100px] border-border/80 bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-between">
            <span className="text-[12px] font-medium text-muted-foreground/80 uppercase tracking-wider">Balance</span>
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
              <Wallet className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[32px] sm:text-[38px] font-bold text-foreground leading-none tracking-tight">
                {currencySymbol}{totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Spent this month */}
        <Card className="h-[90px] sm:h-[100px] border-border/80 bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-between">
            <span className="text-[12px] font-medium text-muted-foreground/80 uppercase tracking-wider">Spent</span>
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center justify-center">
              <ProgressCircle value={budgetPct} size={32} strokeWidth={3}>
                <span className="text-[8px] font-bold text-foreground">{budgetPct}%</span>
              </ProgressCircle>
            </div>
            <div className="flex flex-col">
              <span className="text-[32px] sm:text-[38px] font-bold text-foreground leading-none tracking-tight">
                {currencySymbol}{monthlyExpense.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Savings progress indicator */}
        <Card className="h-[90px] sm:h-[100px] border-border/80 bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-between">
            <span className="text-[12px] font-medium text-muted-foreground/80 uppercase tracking-wider">Saved</span>
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-500">
              <TrendingUp className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[32px] sm:text-[38px] font-bold text-foreground leading-none tracking-tight">{savingsRate}%</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* QUICK LOG CARD */}


      {/* DASHBOARD SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Trends and coach */}
        <div className="lg:col-span-2 space-y-6">

          {/* Daily Velocity panel */}
          {activeWidgets.includes('daily') && (
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-primary" />
                    Daily Spend Velocity
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Today vs daily average</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Spent Today</span>
                    <span className="text-sm font-bold text-rose-500 font-mono">{currencySymbol}{spentToday.toFixed(0)}</span>
                  </div>
                  <div className="h-6 w-px bg-border/60"></div>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Daily Avg</span>
                    <span className="text-sm font-bold text-muted-foreground font-mono">{currencySymbol}{dailyAverage.toFixed(0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spending Insights panel */}
          {activeWidgets.includes('spending') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-4.5 w-4.5 text-primary" />
                      Spending by Category
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Top spending categories</p>
                  </div>
                  <select 
                    className="text-xs bg-muted/30 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                    value={spendingFilter}
                    onChange={(e: any) => setSpendingFilter(e.target.value)}
                  >
                    <option value="month">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>

                {spendingData.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No expense records found for this period.
                  </div>
                ) : (
                  <div className="h-64 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingData} layout="vertical" margin={{ top: 0, right: 30, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={100} />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: any) => [`${currencySymbol}${value}`, 'Amount']}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} activeBar={false} style={{ outline: 'none' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Income vs Expense Cashflow panel */}
          {activeWidgets.includes('cashflow') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Wallet className="h-4.5 w-4.5 text-emerald-500" />
                      Monthly Cash Flow
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Income vs Expenses over the last 12 months</p>
                  </div>
                </div>
                
                {cashFlowData.every(d => d.Income === 0 && d.Expenses === 0) ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No cash flow data available.
                  </div>
                ) : (
                  <div className="h-64 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `${currencySymbol}${val}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ padding: '2px 0' }}
                          formatter={(value: any) => [`${currencySymbol}${value}`, undefined]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={false} style={{ outline: 'none' }} />
                        <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={false} style={{ outline: 'none' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Budget Usage panel */}
          {activeWidgets.includes('budget_usage') && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="select-none flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-4.5 w-4.5 text-primary" />
                      Budget Usage
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Compare spending to your set limits</p>
                  </div>
                </div>

                {budgetUsageData.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground select-none">
                    No active budget limits set.
                  </div>
                ) : (
                  <div className="h-64 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetUsageData} layout="vertical" margin={{ top: 0, right: 30, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis type="number" hide />
                        <YAxis yAxisId="0" type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={100} />
                        <YAxis yAxisId="1" type="category" dataKey="name" hide />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: any) => [`${currencySymbol}${value}`, undefined]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar yAxisId="0" dataKey="Limit" fill="hsl(var(--muted-foreground)/0.2)" radius={4} activeBar={false} style={{ outline: 'none' }} barSize={12} />
                        <Bar yAxisId="1" dataKey="Used" fill="hsl(var(--primary))" radius={4} activeBar={false} style={{ outline: 'none' }} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
                    Net Worth Trend
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Assets minus liabilities over time</p>
                </div>

                <div className="h-48 mt-2 w-full px-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={netWorthData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `${currencySymbol}${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ padding: '2px 0' }}
                        formatter={(value: any) => [`${currencySymbol}${value}`, 'Net Worth']}
                      />
                      <Area type="monotone" dataKey="NetWorth" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNetWorth)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
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

                <div className="flex flex-col gap-0.5">
                  {bills.filter(b => b.status_id !== SEED.statuses.paid && b.is_active !== false).slice(0, 3).map((bill) => {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const due = new Date(bill.due_date);
                    due.setHours(0,0,0,0);
                    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let relText = `In ${diffDays} days`;
                    let dotColor = 'bg-emerald-500';
                    if (diffDays < 0) { relText = 'Overdue'; dotColor = 'bg-rose-500'; }
                    else if (diffDays === 0) { relText = 'Today'; dotColor = 'bg-amber-500'; }
                    else if (diffDays === 1) { relText = 'Tomorrow'; dotColor = 'bg-amber-500'; }
                    else if (diffDays <= 7) { dotColor = 'bg-amber-500'; }

                    return (
                      <div key={bill.id} className="group flex justify-between items-center p-2 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-bold text-foreground truncate leading-tight">{bill.name}</span>
                            <span className="text-[10px] text-muted-foreground/70 font-light mt-0.5 truncate leading-none">
                              {relText}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[13px] font-mono font-bold text-right w-[60px]">{currencySymbol}{(parseFloat(bill.amount) || 0).toFixed(0)}</span>
                          <Button
                            onClick={() => setPayingBill(bill)}
                            size="sm"
                            className="h-[24px] w-[24px] p-0 sm:w-auto sm:px-2.5 cursor-pointer flex items-center justify-center rounded-md"
                          >
                            <span className="hidden sm:inline text-[10px] font-semibold">Pay</span>
                            <CreditCard className="h-3 w-3 sm:hidden" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

      {/* QUICK LOG CARD (Moved to bottom as secondary utility) */}
      <div className="mt-8">
        <Card className="border border-primary/20 bg-primary/5 shadow-xs">
          <CardContent className="p-6">
            <form onSubmit={handleQuickAdd} className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 text-primary shrink-0 select-none">
                <Sparkles className="icon-card" />
                <span className="label-text text-primary">Quick Log</span>
              </div>
              <input 
                id="quick-expense-input"
                type="text" 
                placeholder='Type what you bought or earned (e.g. Starbucks 5 or Salary 2500)'
                value={quickAddVal}
                onChange={(e) => setQuickAddVal(e.target.value)}
                className="flex-1 w-full bg-background px-3 py-2 rounded-xl text-sm outline-none"
              />
              <Button type="submit" size="md" loading={quickAddLoading} className="w-full md:w-auto">
                Save Entry
              </Button>
            </form>
          </CardContent>
        </Card>
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
            <span className="font-mono text-base">{currencySymbol}{payingBill ? (parseFloat(payingBill.amount) || 0).toFixed(0) : '0'}</span>
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
              { id: 'spending', title: 'Spending Insights', desc: 'Category-wise spending distribution with progress bars.' },
              { id: 'budget_usage', title: 'Budget Usage', desc: 'Compare your monthly spending against active category limits.' },
              { id: 'daily', title: 'Daily Spend Velocity', desc: 'Analyze spent today compared to daily monthly average.' },
              { id: 'cashflow', title: 'Monthly Cash Flow', desc: 'Detailed summary of monthly income vs expenses.' },
              { id: 'wealth', title: 'Net Worth Statement', desc: 'Assets vs outstanding loan liabilities comparison.' },
              { id: 'goals', title: 'Savings Progress', desc: 'Standalone progress indicator tracking active savings goals.' },
              { id: 'bills', title: 'Upcoming Bills Due', desc: 'List of next 3 due bills and repayment statuses.' },

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
