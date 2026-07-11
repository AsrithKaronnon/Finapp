// @ts-nocheck
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Sun, Moon, Monitor, 
  RefreshCw, ShieldCheck, Globe, User, ShieldAlert, KeyRound, LogOut, ChevronDown, Sliders,
  Plus, ChevronUp, Trash2, X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { SEED } from '../lib/supabaseMock';

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [currency, setCurrency] = useState('USD');
  const [currencies, setCurrencies] = useState<any[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Password Update State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  // Collapsible Accordion State
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Budgets Configuration State
  const [categories, setCategories] = useState<any[]>([]);
  const [userBudgets, setUserBudgets] = useState<any[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsMsg, setBudgetsMsg] = useState('');

  // Budget Add Mode
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetCustomName, setNewBudgetCustomName] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<number>(0);

  useEffect(() => {
    // Load initial settings theme
    const savedTheme = window.localStorage.getItem('theme') || 'system';
    setTheme(savedTheme as any);

    // Fetch master currencies
    supabase.from('currencies').select('*').then(({ data }) => {
      if (data) setCurrencies(data);
    });

    // Fetch user settings base currency
    supabase.from('user_settings').select('*').maybeSingle().then(({ data }) => {
      if (data && data.base_currency_id) {
        setCurrency(data.base_currency_id);
      }
    });



    // Fetch logged-in user profile metadata
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || '');
        if (user.user_metadata) {
          setFirstName(user.user_metadata.first_name || '');
          setLastName(user.user_metadata.last_name || '');
          setPhone(user.user_metadata.phone || '');
        }
      }
    });

    // Fetch expense categories & user budgets
    supabase.from('expense_categories').select('*').then(({ data: catData }) => {
      if (catData) {
        setCategories(catData);
        supabase.from('budgets').select('*').order('sort_order', { ascending: true }).then(({ data: budgetData }) => {
          if (budgetData) {
            const mapped = budgetData.map((b: any, index: number) => ({
              id: b.id,
              category_id: b.category_id,
              amount: parseFloat(b.amount) || 0,
              sort_order: b.sort_order ?? index,
              name: catData.find((c: any) => c.id === b.category_id)?.name || 'Unknown',
              is_system: catData.find((c: any) => c.id === b.category_id)?.is_system !== false
            })).sort((a: any, b: any) => a.sort_order - b.sort_order);
            setUserBudgets(mapped);
          }
        });
      }
    });
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordMsg('Error: All password fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg('Error: New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg('Error: New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg('');
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const email = user?.email;
      const phone = user?.phone;
      
      const credentials = email 
        ? { email, password: oldPassword }
        : { phone, password: oldPassword };
        
      const { error: signInErr } = await supabase.auth.signInWithPassword(credentials as any);
      if (signInErr) {
        throw new Error('Incorrect previous password.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateErr) throw updateErr;

      setPasswordMsg('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err: any) {
      setPasswordMsg(`Error: ${err.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      });
      if (error) throw error;
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg(`Error: ${err.message}`);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    window.localStorage.setItem('theme', newTheme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  };

  const handleCurrencyChange = async (newCurr: string) => {
    setCurrency(newCurr);
    try {
      await supabase.from('user_settings').upsert({ base_currency_id: newCurr }, { onConflict: 'created_by' });
    } catch (err) {
      console.error('Error updating base currency:', err);
    }
  };

  const moveBudget = (index: number, direction: 'up' | 'down') => {
    const newBudgets = [...userBudgets];
    if (direction === 'up' && index > 0) {
      [newBudgets[index - 1], newBudgets[index]] = [newBudgets[index], newBudgets[index - 1]];
    } else if (direction === 'down' && index < newBudgets.length - 1) {
      [newBudgets[index + 1], newBudgets[index]] = [newBudgets[index], newBudgets[index + 1]];
    }
    newBudgets.forEach((b, i) => { b.sort_order = i; });
    setUserBudgets(newBudgets);
  };

  const removeBudget = (index: number) => {
    const newBudgets = userBudgets.filter((_, i) => i !== index);
    newBudgets.forEach((b, i) => { b.sort_order = i; });
    setUserBudgets(newBudgets);
  };

  const updateBudgetAmount = (index: number, amt: number) => {
    const newBudgets = [...userBudgets];
    newBudgets[index].amount = amt;
    setUserBudgets(newBudgets);
  };

  const handleAddBudgetSubmit = async () => {
    if (newBudgetAmount < 0) {
      setBudgetsMsg('Error: Amount cannot be negative');
      setTimeout(() => setBudgetsMsg(''), 3000);
      return;
    }
    
    let catId = newBudgetCategory;
    let catName = '';
    
    if (catId === 'custom') {
      if (!newBudgetCustomName.trim()) {
        setBudgetsMsg('Error: Custom name required');
        setTimeout(() => setBudgetsMsg(''), 3000);
        return;
      }
      if (categories.some(c => c.name.toLowerCase() === newBudgetCustomName.trim().toLowerCase())) {
        setBudgetsMsg('Error: Category already exists');
        setTimeout(() => setBudgetsMsg(''), 3000);
        return;
      }
      const newCatId = 'cat_' + Date.now().toString();
      await supabase.from('expense_categories').insert([{
        id: newCatId,
        name: newBudgetCustomName.trim(),
        icon: 'Tag',
        color: 'gray',
        is_system: false
      }]);
      catId = newCatId;
      catName = newBudgetCustomName.trim();
      setCategories([...categories, { id: newCatId, name: catName, is_system: false }]);
    } else {
      if (!catId) return;
      catName = categories.find(c => c.id === catId)?.name || 'Unknown';
    }

    if (userBudgets.some(b => b.category_id === catId)) {
      setBudgetsMsg('Error: Budget for this category already exists');
      setTimeout(() => setBudgetsMsg(''), 3000);
      return;
    }

    const newBudget = {
      category_id: catId,
      amount: newBudgetAmount,
      budget_type_id: SEED.recurrences.monthly,
      sort_order: userBudgets.length
    };
    
    let budgetId;
    try {
      const { data: insertedBudget } = await supabase.from('budgets').insert([newBudget]).select().single();
      budgetId = insertedBudget ? insertedBudget.id : undefined;
    } catch (err) {
      console.error('Failed to auto-save new budget:', err);
    }

    setUserBudgets([
      ...userBudgets,
      { id: budgetId, category_id: catId, amount: newBudgetAmount, sort_order: userBudgets.length, name: catName, is_system: catId !== 'custom' && categories.find(c => c.id === catId)?.is_system !== false }
    ]);
    
    setIsAddingBudget(false);
    setNewBudgetCategory('');
    setNewBudgetCustomName('');
    setNewBudgetAmount(0);

    setBudgetsMsg('Category added and saved successfully!');
    setTimeout(() => setBudgetsMsg(''), 3000);
  };

  const handleSaveBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetsLoading(true);
    setBudgetsMsg('');
    try {
      const promises = userBudgets.map(async (b) => {
        if (b.id) {
          await supabase.from('budgets').update({ amount: b.amount, sort_order: b.sort_order }).eq('id', b.id);
        } else {
          await supabase.from('budgets').insert([{
            category_id: b.category_id,
            amount: b.amount,
            budget_type_id: SEED.recurrences.monthly,
            sort_order: b.sort_order
          }]);
        }
      });
      await Promise.all(promises);

      const { data: currentBudgets } = await supabase.from('budgets').select('id');
      if (currentBudgets) {
        const keptIds = userBudgets.map(b => b.id).filter(Boolean);
        const toDelete = currentBudgets.filter((cb: any) => !keptIds.includes(cb.id));
        for (const del of toDelete) {
          await supabase.from('budgets').delete().eq('id', del.id);
        }
      }

      setBudgetsMsg('Budget limits updated successfully!');
      setTimeout(() => setBudgetsMsg(''), 3000);
      
      supabase.from('budgets').select('*').order('sort_order', { ascending: true }).then(({ data: budgetData }) => {
        if (budgetData) {
          const mapped = budgetData.map((b: any, index: number) => ({
            id: b.id,
            category_id: b.category_id,
            amount: parseFloat(b.amount) || 0,
            sort_order: b.sort_order ?? index,
            name: categories.find((c: any) => c.id === b.category_id)?.name || 'Unknown',
            is_system: categories.find((c: any) => c.id === b.category_id)?.is_system !== false
          }));
          setUserBudgets(mapped);
        }
      });

    } catch (err: any) {
      setBudgetsMsg(`Error: ${err.message || 'Failed to save'}`);
    } finally {
      setBudgetsLoading(false);
    }
  };

  const triggerResetOpen = () => {
    setConfirmPassword('');
    setResetError('');
    setIsResetModalOpen(true);
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: confirmPassword
      });

      if (error) {
        throw new Error('Incorrect password. Please try again.');
      }

      localStorage.clear();
      window.location.reload();
    } catch (err: any) {
      setResetError(err.message || 'Incorrect password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="select-none">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Adjust layout preferences, default currencies, and sandbox resets.</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Profile Settings Card */}
        <Card className="overflow-hidden">
          <CardHeader 
            onClick={() => setActiveSection(activeSection === 'profile' ? null : 'profile')} 
            className="pb-3 select-none cursor-pointer hover:bg-muted/10 transition-colors flex flex-row items-center justify-between"
          >
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <User className="h-4.5 w-4.5 text-primary" />
                Profile Settings
              </CardTitle>
              <CardDescription className="text-xs">Update your personal contact details and names</CardDescription>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              activeSection === 'profile' ? 'transform rotate-180' : ''
            }`} />
          </CardHeader>
          {activeSection === 'profile' && (
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {profileMsg && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold ${
                    profileMsg.startsWith('Error') 
                      ? 'bg-destructive/10 border-destructive/25 text-destructive' 
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                  }`}>
                    {profileMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                  />
                </div>

                <Button type="submit" loading={profileLoading} className="py-2 px-4 text-xs font-bold cursor-pointer">
                  Save Profile Details
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Budget Limits Card */}
        <Card className="overflow-hidden">
          <CardHeader 
            onClick={() => setActiveSection(activeSection === 'budgets' ? null : 'budgets')} 
            className="pb-3 select-none cursor-pointer hover:bg-muted/10 transition-colors flex flex-row items-center justify-between"
          >
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sliders className="h-4.5 w-4.5 text-primary" />
                Budget Limits Configuration
              </CardTitle>
              <CardDescription className="text-xs">Configure your monthly category spending ceilings</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-[28px] text-[10px] px-2 py-0 gap-1 rounded-md cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsAddingBudget(true); setActiveSection('budgets'); }}>
                <Plus className="h-3 w-3" /> Add Category
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                activeSection === 'budgets' ? 'transform rotate-180' : ''
              }`} />
            </div>
          </CardHeader>
          {activeSection === 'budgets' && (
            <CardContent>
              <form onSubmit={handleSaveBudgets} className="space-y-4">
                {budgetsMsg && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold ${budgetsMsg.includes('Error') ? 'bg-destructive/10 border-destructive/25 text-destructive' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'}`}>
                    {budgetsMsg}
                  </div>
                )}
                
                {isAddingBudget && (
                  <div className="p-3 mb-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground">Add Budget Category</span>
                      <button type="button" onClick={() => setIsAddingBudget(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={newBudgetCategory} 
                        onChange={(e) => setNewBudgetCategory(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] font-medium"
                      >
                        <option value="">-- Select Category --</option>
                        <optgroup label="System Categories">
                          {categories.filter((c: any) => c.is_system !== false && !userBudgets.some(b => b.category_id === c.id)).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Custom Categories">
                          {categories.filter((c: any) => c.is_system === false && !userBudgets.some(b => b.category_id === c.id)).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                        <option value="custom">+ Create New Custom Category</option>
                      </select>
                      {newBudgetCategory === 'custom' && (
                        <input
                          type="text"
                          placeholder="Category Name"
                          value={newBudgetCustomName}
                          onChange={(e) => setNewBudgetCustomName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] font-medium"
                        />
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Monthly Limit:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newBudgetAmount || ''}
                          onChange={(e) => setNewBudgetAmount(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 rounded border border-border bg-background text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/45 text-right"
                        />
                      </div>
                      <Button type="button" size="sm" onClick={handleAddBudgetSubmit} className="h-8 mt-1 text-[11px]">
                        Add to Budget
                      </Button>
                    </div>
                  </div>
                )}

                {userBudgets.length === 0 && !isAddingBudget && (
                  <div className="py-8 text-center border border-dashed border-border/60 rounded-xl">
                    <p className="text-xs text-muted-foreground">No categories tracked.</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Click Add Category to begin budgeting.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {userBudgets.map((b, index) => {
                    const activeCurrencySymbol = currencies.find((c: any) => c.id === currency)?.symbol || '₹';
                    return (
                      <div key={b.category_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/10 transition-colors group">
                        <div className="flex items-center gap-3 select-none">
                          <div className="flex flex-col items-center">
                            <button type="button" onClick={() => moveBudget(index, 'up')} className="text-muted-foreground/40 hover:text-foreground cursor-pointer disabled:opacity-20" disabled={index === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => moveBudget(index, 'down')} className="text-muted-foreground/40 hover:text-foreground cursor-pointer disabled:opacity-20" disabled={index === userBudgets.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                              {b.name}
                              {b.is_system === false && <span className="px-1 py-[1px] bg-primary/10 text-primary rounded text-[8px] uppercase tracking-wide">Custom</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Monthly Limit</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground select-none font-semibold">{activeCurrencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={b.amount}
                              onChange={(e) => updateBudgetAmount(index, parseFloat(e.target.value) || 0)}
                              className="w-[100px] px-2 py-1.5 rounded-lg border border-border bg-muted/20 text-[13px] font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/45 text-right"
                            />
                          </div>
                          <button type="button" onClick={() => removeBudget(index)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer" aria-label="Remove Budget">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-border/50 flex justify-end">
                  <Button type="submit" loading={budgetsLoading} className="py-2 px-6 text-xs font-bold cursor-pointer">
                    Save Budget Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Change Password Card */}
        <Card className="overflow-hidden">
          <CardHeader 
            onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')} 
            className="pb-3 select-none cursor-pointer hover:bg-muted/10 transition-colors flex flex-row items-center justify-between"
          >
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <KeyRound className="h-4.5 w-4.5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription className="text-xs">Update your security password for credentials authentication</CardDescription>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              activeSection === 'password' ? 'transform rotate-180' : ''
            }`} />
          </CardHeader>
          {activeSection === 'password' && (
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                {passwordMsg && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold ${
                    passwordMsg.startsWith('Error') 
                      ? 'bg-destructive/10 border-destructive/25 text-destructive' 
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                  }`}>
                    {passwordMsg}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Previous Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                    placeholder="Enter previous password"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>

                <Button type="submit" loading={passwordLoading} className="py-2 px-4 text-xs font-bold cursor-pointer">
                  Change Password
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
        
        {/* Color Theme Preference */}
        <Card className="overflow-hidden">
          <CardHeader 
            onClick={() => setActiveSection(activeSection === 'theme' ? null : 'theme')} 
            className="pb-3 select-none cursor-pointer hover:bg-muted/10 transition-colors flex flex-row items-center justify-between"
          >
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sun className="h-4.5 w-4.5 text-primary" />
                Theme Preference
              </CardTitle>
              <CardDescription className="text-xs">Select how you want the application to look</CardDescription>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              activeSection === 'theme' ? 'transform rotate-180' : ''
            }`} />
          </CardHeader>
          {activeSection === 'theme' && (
            <CardContent className="flex flex-col sm:flex-row gap-3">
              {[
                { id: 'light', label: 'Light Mode', icon: Sun },
                { id: 'dark', label: 'Dark Mode', icon: Moon },
                { id: 'system', label: 'System Default', icon: Monitor }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = theme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleThemeChange(item.id as any)}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border flex items-center justify-between font-bold text-xs select-none transition-all cursor-pointer
                      ${isSelected 
                        ? 'border-primary bg-primary/5 text-primary shadow-xs' 
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4.5 w-4.5" />
                      {item.label}
                    </span>
                    {isSelected && <ShieldCheck className="h-4.5 w-4.5 text-primary" />}
                  </button>
                );
              })}
            </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
};
