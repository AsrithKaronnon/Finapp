import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Target, Calendar, Trash2, Sparkles 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';

export const Goals: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: 0,
    current_amount: 0,
    monthly_contribution: 0,
    priority_id: SEED.priorities.medium,
    category_id: SEED.goal_types.savings,
    due_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Deposit Modal State
  const [depositGoal, setDepositGoal] = useState<any | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      let [
        { data: goalsData },
        { data: accData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('goals').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

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

      if (goalsData) setGoals(goalsData);
      if (accData) setAccounts(accData);
    } catch (err) {
      console.error('Error fetching savings goals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      target_amount: 0,
      current_amount: 0,
      monthly_contribution: 100,
      priority_id: SEED.priorities.medium,
      category_id: SEED.goal_types.savings,
      due_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0], // 1 year out
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('goals').insert([formData]);
      setIsModalOpen(false);
      fetchGoals();
    } catch (err) {
      alert('Error saving goal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      await supabase.from('goals').delete().eq('id', id);
      fetchGoals();
    } catch (err) {
      alert('Error deleting goal');
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0 || !depositGoal) return;
    
    const newCurrent = depositGoal.current_amount + depositAmount;

    try {
      // 1. Update Goal Amount
      await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', depositGoal.id);
      
      // 2. Log standard transaction record matching it
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: depositAmount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.shopping,
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `Goal Transfer: ${depositGoal.name}`,
        notes: `Savings contribution to goal "${depositGoal.name}"`,
        tags: ['Essential'],
        is_recurring: false
      };
      await supabase.from('transactions').insert([newTx]);

      setDepositGoal(null);
      setDepositAmount(0);
      fetchGoals();
    } catch (err) {
      alert('Error processing contribution');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 select-none">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Savings Goals</h1>
          <p className="text-xs text-muted-foreground">Keep money aside for important goals like a bike, car, wedding or vacation.</p>
        </div>
        <Button onClick={handleOpenAdd} size="sm" className="flex items-center gap-1.5 cursor-pointer text-xs">
          <Plus className="h-4 w-4" />
          Create a Goal
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-48 animate-pulse bg-card rounded-xl border border-border/50" />
          <div className="h-48 animate-pulse bg-card rounded-xl border border-border/50" />
        </div>
      ) : goals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3 select-none">
          <Target className="h-10 w-10 text-muted-foreground/60 animate-bounce" />
          <div className="text-xs font-semibold text-foreground">No Goals Set Yet</div>
          <Button size="sm" onClick={handleOpenAdd}>
            Create My First Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const current = parseFloat(goal.current_amount) || 0;
            const target = parseFloat(goal.target_amount) || 1;
            const pct = Math.min(100, Math.round((current / target) * 100));

            return (
              <Card key={goal.id} className="flex flex-col h-full hoverEffect">
                <CardHeader className="pb-3 flex-row justify-between items-start">
                  <div className="flex flex-col">
                    <CardTitle className="text-sm">{goal.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 line-clamp-1">{goal.notes || 'Saving regularly'}</CardDescription>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="flex-1 py-2 space-y-4">
                  {/* Progress info */}
                  <div className="flex justify-between items-baseline text-xs font-bold text-foreground">
                    <span>{currencySymbol}{current.toLocaleString()} saved</span>
                    <span className="text-[10px] text-muted-foreground font-normal">of {currencySymbol}{target.toLocaleString()}</span>
                  </div>

                  {/* Horizontal progress bar */}
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-muted-foreground select-none">
                    <span>{pct}% Completed</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due: {goal.due_date}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-3 bg-muted/10 border-t border-border/40 select-none">
                  <Button 
                    onClick={() => {
                      setDepositGoal(goal);
                      setDepositAmount(0);
                    }}
                    className="w-full py-1 text-xs cursor-pointer"
                    variant="outline"
                  >
                    Add Money
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE GOAL DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create a Savings Goal"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">What are you saving for?</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="e.g. New Bike, Wedding Fund, Gadgets"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Target Amount ({currencySymbol})</label>
              <input
                type="number"
                required
                value={formData.target_amount || ''}
                onChange={(e) => setFormData({ ...formData, target_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Amount Already Saved ({currencySymbol})</label>
              <input
                type="number"
                value={formData.current_amount || ''}
                onChange={(e) => setFormData({ ...formData, current_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Monthly Contribution ({currencySymbol})</label>
              <input
                type="number"
                value={formData.monthly_contribution || ''}
                onChange={(e) => setFormData({ ...formData, monthly_contribution: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Target Date</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">Short Note (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 h-16 resize-none"
              placeholder="e.g. Save money for flights and hotels"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4 select-none">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Goal
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ALLOCATE DIALOG */}
      <Dialog
        isOpen={!!depositGoal}
        onClose={() => setDepositGoal(null)}
        title={depositGoal ? `Add Savings: ${depositGoal.name}` : ''}
      >
        <form onSubmit={handleDeposit} className="flex flex-col gap-4">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start select-none">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Add Money Helper</span>
              <p className="text-muted-foreground mt-0.5">
                Funding this goal subtracts funds from your checking balance and records a spend transaction.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-muted-foreground">Amount to Add ({currencySymbol})</label>
            <input
              type="number"
              required
              autoFocus
              step="0.01"
              value={depositAmount || ''}
              onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4 select-none">
            <Button type="button" variant="outline" onClick={() => setDepositGoal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={depositAmount <= 0}>
              Complete Deposit
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
