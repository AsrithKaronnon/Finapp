import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Sun, Moon, Monitor, 
  RefreshCw, ShieldCheck, Globe, User, ShieldAlert, KeyRound, LogOut
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';

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
        <Card>
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <User className="h-4.5 w-4.5 text-primary" />
              Profile Settings
            </CardTitle>
            <CardDescription className="text-xs">Update your personal contact details and names</CardDescription>
          </CardHeader>
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
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <KeyRound className="h-4.5 w-4.5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription className="text-xs">Update your security password for credentials authentication</CardDescription>
          </CardHeader>
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
        </Card>
        
        {/* Color Theme Preference */}
        <Card>
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sun className="h-4.5 w-4.5 text-primary" />
              Theme Preference
            </CardTitle>
            <CardDescription className="text-xs">Select how you want the application to look</CardDescription>
          </CardHeader>
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
        </Card>

        {/* Currency Card */}
        <Card>
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Globe className="h-4.5 w-4.5 text-primary" />
              Currency Settings
            </CardTitle>
            <CardDescription className="text-xs">Adjust the default monetary symbols used in dashboards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground select-none">Base Currency</label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Database resets */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <RefreshCw className="h-4.5 w-4.5 text-destructive" />
              Reset Helper
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">Wipes local modifications and reinstates standard demo logs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={triggerResetOpen}
              variant="danger"
              size="sm"
              className="text-xs py-2 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Reset My Data
            </Button>
          </CardContent>
        </Card>

        {/* Log Out card for mobile screens */}
        <Card className="md:hidden border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3 select-none">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <LogOut className="h-4.5 w-4.5 text-destructive" />
              Sign Out
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground/80">Log out of your current session on this device</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSignOut}
              variant="danger"
              size="sm"
              className="text-xs py-2 cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>

        {/* CONFIRM RESET DIALOG */}
        <Dialog
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title="Confirm Reset Request"
        >
          <form onSubmit={handleResetConfirm} className="flex flex-col gap-4">
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start select-none">
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-500">Irreversible Action Warning</span>
                <p className="text-muted-foreground mt-0.5">
                  This action will wipe all custom entries (transactions, goals, bills, and furnishing details) and restore the default demo workspace.
                </p>
              </div>
            </div>

            {resetError && (
              <div className="p-3 rounded-lg border text-xs font-semibold bg-destructive/10 border-destructive/25 text-destructive animate-none">
                {resetError}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground select-none">Confirm Password</label>
              <input
                type="password"
                required
                autoFocus
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="Enter your password to verify"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-2 select-none">
              <Button type="button" variant="outline" onClick={() => setIsResetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={resetLoading}>
                Verify & Reset Data
              </Button>
            </div>
          </form>
        </Dialog>

      </div>

    </div>
  );
};
