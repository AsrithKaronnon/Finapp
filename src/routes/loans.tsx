import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Calendar, ShieldAlert, BookOpen, Percent, TrendingDown, ClipboardList, Sparkles 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

export const Loans: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  
  // Amortization Schedule State
  const [activeAmortizationId, setActiveAmortizationId] = useState<string | null>(null);
  
  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    loan_type_id: SEED.loan_types.personal,
    total_amount: 0,
    interest_rate: 0,
    duration_months: 12,
    start_date: new Date().toISOString().split('T')[0],
    monthly_emi: 0,
    outstanding_amount: 0,
    remaining_emis: 12
  });

  // EMI Payment State
  const [payingLoan, setPayingLoan] = useState<any | null>(null);

  const [currencySymbol, setCurrencySymbol] = useState('$');

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const [
        { data: loansData },
        { data: typesData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('loan_types').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (loansData) {
        setLoans(loansData);
        if (loansData.length > 0 && !activeAmortizationId) {
          setActiveAmortizationId(loansData[0].id);
        }
      }
      if (typesData) setLoanTypes(typesData);

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
    } catch (err) {
      console.error('Error fetching loan details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  // Standard Amortization Schedule Calculation
  const generateAmortization = (loan: any) => {
    if (!loan || loan.total_amount <= 0 || loan.interest_rate <= 0 || loan.duration_months <= 0) {
      return [];
    }

    const principal = loan.total_amount;
    const rate = loan.interest_rate / 12 / 100;
    const months = loan.duration_months;
    
    // Monthly EMI formula
    const emi = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    
    const schedule = [];
    let balance = principal;
    const paidMonthsCount = months - loan.remaining_emis;

    for (let m = 1; m <= months; m++) {
      const interest = balance * rate;
      const principalPaid = emi - interest;
      balance = Math.max(0, balance - principalPaid);
      
      schedule.push({
        month: m,
        emi,
        interest,
        principalPaid,
        balance,
        status: m <= paidMonthsCount ? 'paid' : 'upcoming'
      });
    }

    return schedule;
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      loan_type_id: SEED.loan_types.personal,
      total_amount: 0,
      interest_rate: 0,
      duration_months: 24,
      start_date: new Date().toISOString().split('T')[0],
      monthly_emi: 0,
      outstanding_amount: 0,
      remaining_emis: 24
    });
    setIsModalOpen(true);
  };

  // Auto calculate EMI preview on form changes
  const calculateFormEMI = () => {
    const principal = formData.total_amount;
    const rate = formData.interest_rate / 12 / 100;
    const months = formData.duration_months;

    if (principal > 0 && rate > 0 && months > 0) {
      const emi = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
      setFormData(prev => ({
        ...prev,
        monthly_emi: parseFloat(emi.toFixed(2)),
        outstanding_amount: principal,
        remaining_emis: months
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('loans').insert([formData]);
      if (error) throw error;
      setIsModalOpen(false);
      fetchLoans();
      toast.success('Loan record saved successfully!');
    } catch (err) {
      toast.error('Error entering loan details');
    }
  };

  const handlePayEMI = async () => {
    if (!payingLoan) return;

    const newOutstanding = Math.max(0, payingLoan.outstanding_amount - payingLoan.monthly_emi);
    const newRemaining = Math.max(0, payingLoan.remaining_emis - 1);

    try {
      // 1. Update outstanding
      await supabase.from('loans').update({
        outstanding_amount: newOutstanding,
        remaining_emis: newRemaining
      }).eq('id', payingLoan.id);

      // 2. Log standard ledger transaction
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: payingLoan.monthly_emi,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.housing, // generic housing / finance
        account_id: SEED.accounts.chase,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `EMI: ${payingLoan.name}`,
        notes: `Monthly EMI repayment. Remaining terms: ${newRemaining}`,
        tags: ['Essential'],
        is_recurring: true
      };
      await supabase.from('transactions').insert([newTx]);

      setPayingLoan(null);
      fetchLoans();
      toast.success('EMI payment posted successfully!');
    } catch (err) {
      toast.error('Error posting EMI payment');
    }
  };

  const activeLoanForSchedule = loans.find(l => l.id === activeAmortizationId);
  const scheduleData = generateAmortization(activeLoanForSchedule);

  const totalOutstanding = loans.reduce((acc, curr) => acc + curr.outstanding_amount, 0);
  const totalMonthlyEMI = loans.reduce((acc, curr) => acc + curr.monthly_emi, 0);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-primary" />
            Debt & EMIs Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Manage amortization tables, trace monthly EMIs, and track remaining debt balances.</p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Loan Account
        </Button>
      </div>

      {/* TOP DEBT KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
        
        <Card className="glow-primary">
          <CardContent className="p-5 flex justify-between items-center bg-primary/5 border border-primary/20">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Outstanding Debt</span>
              <span className="text-xl font-bold text-foreground">{currencySymbol}{totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Monthly EMI Dues</span>
              <span className="text-xl font-bold text-foreground">{currencySymbol}{totalMonthlyEMI.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Percent className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next Debt Due Date</span>
              <span className="text-xl font-bold text-foreground">Jul 15, 2026</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : loans.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
          <BookOpen className="h-12 w-12 text-muted-foreground/60 animate-bounce" />
          <div className="text-sm font-semibold text-foreground">All Clear! No Debt Logged</div>
          <Button size="sm" onClick={handleOpenAdd}>
            Log First Loan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Active Loans grid */}
          <div className="lg:col-span-1 space-y-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none px-1">
              Active Debt Contracts
            </div>
            {loans.map((loan) => {
              const type = loanTypes.find(t => t.id === loan.loan_type_id)?.name || 'Custom Debt';
              const paidAmount = loan.total_amount - loan.outstanding_amount;
              const paidPct = Math.round((paidAmount / loan.total_amount) * 100);

              return (
                <Card 
                  key={loan.id} 
                  className={`
                    hoverEffect cursor-pointer
                    ${activeAmortizationId === loan.id ? 'border-primary shadow-xs bg-primary/5' : ''}
                  `}
                  onClick={() => setActiveAmortizationId(loan.id)}
                >
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-center">
                      <Badge variant="primary" className="text-[10px]">{type}</Badge>
                      <span className="text-[10px] text-muted-foreground font-semibold">Int: {loan.interest_rate}%</span>
                    </div>
                    <CardTitle className="text-sm mt-1.5">{loan.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs">
                    <div className="flex flex-col items-end text-xs font-bold text-foreground font-mono">
                      <span>{currencySymbol}{loan.outstanding_amount.toLocaleString()} left</span>
                      <span>EMI: {currencySymbol}{loan.monthly_emi}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${paidPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                      <span>{paidPct}% paid off</span>
                      <span>{loan.remaining_emis} months left</span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 bg-muted/10 border-t border-border/40 flex justify-end">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPayingLoan(loan);
                      }}
                      size="sm" 
                      className="py-1 px-3 text-[10px] cursor-pointer"
                    >
                      Record Payment
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Right panel: Active Amortization Schedule list */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4.5 w-4.5 text-primary" />
                  Amortization Repayment Ledger
                </CardTitle>
                <CardDescription>
                  Month-by-month principal vs interest breakdown for "{activeLoanForSchedule?.name}"
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-y-auto max-h-[400px]">
                {scheduleData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Select an active debt contract from the left to view its amortization path.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold sticky top-0 select-none">
                          <th className="p-3 pl-5">Month</th>
                          <th className="p-3">EMI payment</th>
                          <th className="p-3">Principal component</th>
                          <th className="p-3">Interest component</th>
                          <th className="p-3">Outstanding balance</th>
                          <th className="p-3 pr-5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleData.map((row) => (
                          <tr key={row.month} className="border-b border-border/30 hover:bg-muted/10">
                            <td className="p-3 pl-5 text-muted-foreground font-bold">Month {row.month}</td>
                            <td className="p-3 font-mono font-semibold">{currencySymbol}{row.emi.toFixed(2)}</td>
                            <td className="p-3 text-emerald-500 font-mono">{currencySymbol}{row.principalPaid.toFixed(2)}</td>
                            <td className="p-3 text-rose-500 font-mono">{currencySymbol}{row.interest.toFixed(2)}</td>
                            <td className="p-3 font-mono font-semibold">{currencySymbol}{row.balance.toFixed(2)}</td>
                            <td className="p-3 pr-5 text-center">
                              <Badge variant={row.status === 'paid' ? 'success' : 'neutral'} className="text-[9px]">
                                {row.status === 'paid' ? 'Paid' : 'Upcoming'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* CREATE NEW LOAN DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Debt Contract"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Loan Title Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Tesla Model Y, Home Mortgage"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Total Principal Amount ({currencySymbol})</label>
              <input
                type="number"
                required
                value={formData.total_amount || ''}
                onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                onBlur={calculateFormEMI}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Annual Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.interest_rate || ''}
                onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) || 0 })}
                onBlur={calculateFormEMI}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Duration Period (Months)</label>
              <input
                type="number"
                required
                value={formData.duration_months || ''}
                onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) || 0 })}
                onBlur={calculateFormEMI}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Loan Contract Category</label>
              <select
                value={formData.loan_type_id}
                onChange={(e) => setFormData({ ...formData, loan_type_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {loanTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Contract Start Date</label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {formData.monthly_emi > 0 && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex flex-col gap-1 text-xs select-none">
              <span className="font-bold text-foreground">Calculated Repayment Preview</span>
              <div className="flex justify-between text-muted-foreground mt-1">
                <span>Estimated Monthly EMI:</span>
                <span className="font-bold font-mono text-foreground">{currencySymbol}{formData.monthly_emi}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Log Loan Account
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CONFIRM EMI PAYMENT DIALOG */}
      <Dialog
        isOpen={!!payingLoan}
        onClose={() => setPayingLoan(null)}
        title={payingLoan ? `Pay Monthly EMI: ${payingLoan.name}` : ''}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start select-none">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold">Posting Repayment Ledger</span>
              <p className="text-muted-foreground mt-0.5">
                Continuing will log an expense of {currencySymbol}{payingLoan?.monthly_emi} in your transactions, decrementing outstanding principal.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-foreground border-b border-border/40 pb-3">
            <span>Monthly EMI Amount:</span>
            <span className="font-mono text-lg">{currencySymbol}{payingLoan?.monthly_emi}</span>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayingLoan(null)}>
              Cancel
            </Button>
            <Button onClick={handlePayEMI}>
              Post Payment
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};
