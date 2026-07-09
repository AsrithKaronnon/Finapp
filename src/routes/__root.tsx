import React, { useState, useEffect } from 'react';
import { Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { 
  Home, Wallet, Target, Receipt, Settings, 
  Search, Bell, ChevronLeft, ChevronRight, LogOut, Sun, Moon, 
  Monitor, AlertCircle, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';

export const RootLayout: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (window.localStorage.getItem('theme') as any) || 'system';
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  
  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('user@financeos.com');
  const [authPassword, setAuthPassword] = useState('password123');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);

  const routerState = useRouterState();
  const navigate = useNavigate();

  // Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };
    applyTheme(theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  // Load Notifications
  useEffect(() => {
    if (session) {
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setNotifications(data);
      });
    }
  }, [session, isNotificationOpen]);

  // Command Palette listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              first_name: authFirstName,
              last_name: authLastName,
              phone: authPhone
            }
          }
        });
        if (error) throw error;
        alert('Welcome! Your sandbox account is set up. Click Login.');
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setSession(data);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // 5 simple user-focused links
  const navigationItems = [
    { label: 'Home', path: '/', icon: Home, keywords: 'summary status greeting dashboard' },
    { label: 'My Money', path: '/money', icon: Wallet, keywords: 'spent income checking cash stars coffee' },
    { label: 'My Goals', path: '/goals', icon: Target, keywords: 'save bike bridal laptop target travel' },
    { label: 'Bills & Loans', path: '/bills', icon: Receipt, keywords: 'unpaid electric netflix car loan emi' },
    { label: 'Settings', path: '/settings', icon: Settings, keywords: 'theme currencies reset local storage' },
  ];

  const filteredCommands = navigationItems.filter(item => 
    item.label.toLowerCase().includes(commandQuery.toLowerCase()) ||
    item.keywords.toLowerCase().includes(commandQuery.toLowerCase())
  );

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getUserDisplayName = () => {
    const meta = session?.user?.user_metadata;
    if (meta && (meta.first_name || meta.last_name)) {
      return `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
    }
    return session?.user?.email?.split('@')[0] || 'User';
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Auth gate
  if (!session) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-background p-4 overflow-hidden select-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl relative z-10 glass">
          <div className="flex flex-col items-center justify-center gap-1.5 mb-6 text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground font-extrabold text-lg shadow-md">
              $
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">My Finance Helper</h1>
            <p className="text-xs text-muted-foreground">
              A simple, friendly way to track your balance, spends, and savings.
            </p>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 flex gap-2 items-center text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {isSignUp && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      required
                      value={authFirstName}
                      onChange={(e) => setAuthFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="John"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      required
                      value={authLastName}
                      onChange={(e) => setAuthLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="e.g. +1 555-555-5555"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 animate-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <Button type="submit" loading={authLoading} className="w-full mt-2 py-2 cursor-pointer">
              {isSignUp ? 'Create Account' : 'Log In'}
            </Button>
          </form>

          <div className="flex justify-between items-center mt-5 text-[11px] text-muted-foreground">
            <span>
              {isSignUp ? 'Already registered?' : 'New here?'}
            </span>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              {isSignUp ? 'Log In Instead' : 'Create Free Account'}
            </button>
          </div>

          <div className="mt-6 p-3 rounded-lg border border-border/40 bg-muted/40 text-[10px] text-muted-foreground">
            <span className="font-bold text-foreground">Demo Login Details:</span>
            <div className="mt-0.5 flex justify-between">
              <span>Email: user@financeos.com</span>
              <span>Pass: password123</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in App shell
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      
      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`
          hidden md:flex flex-col h-full bg-card border-r border-border/50 transition-all duration-300 relative z-20 select-none
          ${isSidebarCollapsed ? 'w-[70px]' : 'w-[240px]'}
        `}
      >
        {/* Header Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-border/40 overflow-hidden h-[65px] shrink-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground font-bold shrink-0">
            $
          </div>
          {!isSidebarCollapsed && (
            <span className="font-bold text-base tracking-tight text-foreground">Finance Helper</span>
          )}
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = routerState.location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-xs' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer theme/logout */}
        <div className="p-3 border-t border-border/40 space-y-2">
          {!isSidebarCollapsed ? (
            <div className="flex bg-muted/65 p-1 rounded-lg border border-border/30">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`
                    flex-1 py-1 text-[10px] font-bold rounded capitalize flex justify-center items-center gap-1 cursor-pointer
                    ${theme === t ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}
                  `}
                >
                  {t === 'light' && <Sun className="h-3 w-3" />}
                  {t === 'dark' && <Moon className="h-3 w-3" />}
                  {t === 'system' && <Monitor className="h-3 w-3" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          ) : (
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              className="flex justify-center items-center w-full py-2 hover:bg-muted rounded-lg text-muted-foreground cursor-pointer"
            >
              {theme === 'light' && <Sun className="h-4 w-4" />}
              {theme === 'dark' && <Moon className="h-4 w-4" />}
              {theme === 'system' && <Monitor className="h-4 w-4" />}
            </button>
          )}

          <button
            onClick={handleSignOut}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/10 w-full transition-colors cursor-pointer
              ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!isSidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute bottom-[80px] right-[-12px] h-6 w-6 rounded-full border border-border bg-card shadow-xs flex items-center justify-center hover:bg-muted text-muted-foreground z-30 cursor-pointer"
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t border-border bg-card flex items-center justify-around px-2 z-40 select-none">
        {navigationItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = routerState.location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer
                ${isActive ? 'text-primary' : 'text-muted-foreground'}
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold">{item.label.split(' ')[1] || item.label}</span>
            </Link>
          );
        })}
        {/* Settings shortcut on bottom nav */}
        <Link
          to="/settings"
          className={`
            flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer
            ${routerState.location.pathname === '/settings' ? 'text-primary' : 'text-muted-foreground'}
          `}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px] font-bold">Settings</span>
        </Link>
      </div>

      {/* MOBILE QUICK ENTRY FAB */}
      <button
        onClick={() => {
          navigate({ to: '/money' });
          setTimeout(() => {
            const input = document.getElementById('quick-expense-input');
            if (input) input.focus();
          }, 200);
        }}
        className="md:hidden fixed bottom-[80px] right-4 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-40 cursor-pointer active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* MAIN CONTENT SECTION */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-[64px] md:pb-0">
        
        {/* HEADER BAR */}
        <header className="h-[65px] border-b border-border/40 bg-card px-6 flex items-center justify-between shrink-0 z-10 select-none">
          
          {/* Greeting message */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              {getGreeting()}, {getUserDisplayName()}!
            </span>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            {/* Search Gateway */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notification bell */}
            <button
              onClick={() => setIsNotificationOpen(true)}
              className="relative p-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute top-[2px] right-[2px] h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN OUTLET */}
        <main className="flex-1 overflow-y-auto bg-background/50 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* NOTIFICATIONS DIALOG */}
      <Dialog 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)} 
        title="Due Dates & Alerts"
      >
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground select-none">
              No pending bills or alerts due.
            </div>
          ) : (
            notifications.map((item) => (
              <div 
                key={item.id}
                className={`
                  p-3.5 rounded-xl border border-border/50 flex gap-3
                  ${item.is_read ? 'bg-background/40 opacity-70' : 'bg-primary/5 border-primary/20'}
                `}
              >
                <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-foreground">{item.title}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Dialog>

      {/* SEARCH COMMAND DIALOG */}
      <Dialog 
        isOpen={isCommandPaletteOpen} 
        onClose={() => {
          setIsCommandPaletteOpen(false);
          setCommandQuery('');
        }}
        title="Find Pages & Actions"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              autoFocus
              type="text" 
              placeholder="Search..." 
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              className="text-xs text-foreground bg-transparent border-none outline-none flex-1 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            {filteredCommands.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    setIsCommandPaletteOpen(false);
                    setCommandQuery('');
                    navigate({ to: item.path });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-left hover:bg-muted text-foreground cursor-pointer"
                >
                  <Icon className="h-4.5 w-4.5 text-muted-foreground" />
                  <span>Go to {item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>

    </div>
  );
};
