import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Search, Trash2, Sparkles, Info, FileText 
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Tabs } from '../components/ui/Tabs';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'spends' | 'income'>('all');
  const filterCategory = 'all';
  
  // Quick Add State
  const [quickAddVal, setQuickAddVal] = useState('');
  
  // Main Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    transaction_type_id: SEED.transaction_types.expense,
    category_id: '',
    account_id: '',
    merchant: '',
    notes: '',
    tags: ['Essential'],
    is_recurring: false,
    recurrence_interval: 'monthly'
  });

  // Receipt Modal State
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      let [
        { data: txData },
        { data: accData },
        { data: expCatData },
        { data: incCatData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('expense_categories').select('*'),
        supabase.from('income_categories').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      // If new user has no accounts, auto-create one
      if (accData && accData.length === 0) {
        const { data: newAcc } = await supabase.from('accounts').insert([{
          name: 'Primary Checking',
          balance: 0.00,
          account_type: 'Checking',
          currency_id: SEED.currencies.usd
        }]).select();
        if (newAcc) accData = newAcc;
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }

      if (txData) setTransactions(txData);
      if (accData) setAccounts(accData);
      if (expCatData) setExpenseCategories(expCatData);
      if (incCatData) setIncomeCategories(incCatData);
    } catch (err) {
      console.error('Error fetching transactions ledger:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddVal.trim() || accounts.length === 0) return;

    const parts = quickAddVal.trim().split(/\s+/);
    let amount = 0;
    let amountIndex = -1;

    for (let i = parts.length - 1; i >= 0; i--) {
      const val = parseFloat(parts[i]);
      if (!isNaN(val)) {
        amount = val;
        amountIndex = i;
        break;
      }
    }

    if (amountIndex === -1 || amount <= 0) {
      alert('Format incorrect. Type: [Merchant] [Amount] (e.g. Starbucks 5)');
      return;
    }

    const merchantParts = parts.slice(0, amountIndex);
    const merchant = merchantParts.join(' ') || 'General Entry';
    
    // Check if it's salary/income
    const isIncome = merchant.toLowerCase().includes('salary') || merchant.toLowerCase().includes('paycheck') || merchant.toLowerCase().includes('freelance');
    const typeId = isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense;
    const categoryId = isIncome ? SEED.income_categories.salary : autoCategorize(merchant);

    const newTx = {
      date: new Date().toISOString().split('T')[0],
      amount,
      transaction_type_id: typeId,
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
    } catch (err) {
      alert('Error entering spend');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('transactions').insert([{
        ...formData,
        payment_method_id: SEED.payment_methods.debit_card
      }]);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Error logging entry');
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: expenseCategories[0]?.id || SEED.expense_categories.food,
      account_id: accounts[0]?.id || '',
      merchant: '',
      notes: '',
      tags: ['Essential'],
      is_recurring: false,
      recurrence_interval: 'monthly'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this transaction record?')) return;
    try {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    } catch (err) {
      alert('Error deleting transaction');
    }
  };

  const handleExportCSV = () => {
    const headers = 'Date,Description,Amount,Type\n';
    const rows = transactions.map(tx => {
      const type = tx.transaction_type_id === SEED.transaction_types.income ? 'Income' : 'Spend';
      return `"${tx.date}","${tx.merchant.replace(/"/g, '""')}",${tx.amount},"${type}"`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_finance_helper_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Filter evaluation
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'income' && tx.transaction_type_id === SEED.transaction_types.income) ||
      (activeTab === 'spends' && tx.transaction_type_id === SEED.transaction_types.expense);
    
    const matchesCategory = filterCategory === 'all' || tx.category_id === filterCategory;

    return matchesSearch && matchesTab && matchesCategory;
  });

  const activeCategories = formData.transaction_type_id === SEED.transaction_types.income
    ? incomeCategories
    : expenseCategories;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Ledger Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 select-none">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Spends & Incomes</h1>
          <p className="text-xs text-muted-foreground">Trace cash logs, view receipts, and record daily transactions.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1 sm:flex-initial flex items-center gap-1.5 cursor-pointer text-xs">
            Download Log
          </Button>
          <Button onClick={handleOpenAdd} size="sm" className="flex-1 sm:flex-initial flex items-center gap-1.5 cursor-pointer text-xs">
            <Plus className="h-4 w-4" />
            Add Record
          </Button>
        </div>
      </div>

      {/* QUICK ENTRY BOX */}
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
            <Button type="submit" size="sm" className="w-full md:w-auto cursor-pointer">
              Save Entry
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* FILTER BUTTON TABS */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between select-none">
        <div className="w-full sm:w-72">
          <Tabs
            options={[
              { id: 'all', label: 'All Items' },
              { id: 'spends', label: 'Spends' },
              { id: 'income', label: 'Income' }
            ]}
            activeId={activeTab}
            onChange={(id: any) => setActiveTab(id)}
          />
        </div>

        {/* Small Search bar */}
        <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-1.5 bg-background w-full sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs text-foreground bg-transparent border-none outline-none flex-1 focus:ring-0"
          />
        </div>
      </div>

      {/* TRANSACTION FEED LISTINGS */}
      <Card>
        <CardContent className="p-2 space-y-1">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col justify-center items-center gap-2 select-none">
              <Info className="h-8 w-8 text-muted-foreground/60 animate-pulse" />
              <div className="font-semibold text-foreground">Empty Logs</div>
              <p>Try logging an item or adjusting filters.</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isIncome = tx.transaction_type_id === SEED.transaction_types.income;
              const catName = isIncome
                ? incomeCategories.find(c => c.id === tx.category_id)?.name || 'General Income'
                : expenseCategories.find(c => c.id === tx.category_id)?.name || 'General Spend';

              return (
                <div 
                  key={tx.id} 
                  className="flex justify-between items-center border-b border-border/35 p-3 last:border-0 hover:bg-muted/15 rounded-xl transition-colors"
                >
                  {/* Left block description */}
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs select-none ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                      {isIncome ? 'I' : 'S'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">{tx.merchant}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {tx.date} • {catName}
                        {tx.is_recurring && (
                          <span className="ml-1.5 text-primary bg-primary/10 px-1 py-0.2 rounded text-[8px] font-extrabold uppercase">
                            {tx.recurrence_interval}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right block amount & actions */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono font-bold ${isIncome ? 'text-emerald-500' : 'text-foreground'}`}>
                      {isIncome ? '+' : '-'}{currencySymbol}{(parseFloat(tx.amount) || 0).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewReceiptUrl(tx.receipt_url || 'receipt_sample')}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* MANUAL ENTRY DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Spend or Income"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Type</label>
              <select
                value={formData.transaction_type_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const firstCat = val === SEED.transaction_types.income
                    ? incomeCategories[0]?.id || ''
                    : expenseCategories[0]?.id || '';
                  setFormData({ ...formData, transaction_type_id: val, category_id: firstCat });
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 animate-none"
              >
                <option value={SEED.transaction_types.expense}>Spend (Expense)</option>
                <option value={SEED.transaction_types.income}>Income</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Description / Source</label>
              <input
                type="text"
                required
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="e.g. Starbucks, Salary Paycheck"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">Account</label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* RECURRING OPTIONS */}
          <div className="space-y-3 border-t border-border/30 pt-3 select-none">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary/45"
              />
              <label htmlFor="is_recurring" className="text-xs font-bold text-muted-foreground cursor-pointer">
                This is a recurring entry (e.g. monthly paycheck, rent)
              </label>
            </div>

            {formData.is_recurring && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted-foreground">Repeat Frequency</label>
                <select
                  value={formData.recurrence_interval}
                  onChange={(e) => setFormData({ ...formData, recurrence_interval: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">Short Note (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 h-16 resize-none"
              placeholder="Record details..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4 select-none">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Entry
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DUMMY RECEIPT DIALOG */}
      <Dialog
        isOpen={!!previewReceiptUrl}
        onClose={() => setPreviewReceiptUrl(null)}
        title="Receipt Image"
      >
        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-xl bg-card gap-4 select-none">
          <FileText className="h-12 w-12 text-primary animate-pulse" />
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-bold text-foreground">Digital Receipt Copy</span>
            <span className="text-[10px] text-muted-foreground mt-1">Invoice ID: INV-2026-07089</span>
          </div>

          <div className="w-full border-t border-b border-border/30 py-3 mt-4 space-y-2 text-[10px] font-mono">
            <div className="flex justify-between">
              <span>Item: Daily Groceries</span>
              <span>{currencySymbol}12.50</span>
            </div>
            <div className="flex justify-between border-t border-border/20 pt-2 font-bold text-foreground">
              <span>TOTAL</span>
              <span>{currencySymbol}12.50</span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground text-center italic mt-2">
            OCR scan receipt extraction is prepared for connection in live production environments.
          </p>
        </div>
      </Dialog>

    </div>
  );
};
