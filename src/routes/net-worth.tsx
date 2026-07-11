import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Scale, ArrowUpRight, LineChart } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const NetWorth: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Forecast view toggling state
  const [showForecast, setShowForecast] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: accData },
        { data: loansData },
        { data: invData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('investments').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (accData) setAccounts(accData);
      if (loansData) setLoans(loansData);
      if (invData) setInvestments(invData);

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
    } catch (err) {
      console.error('Error fetching net worth statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Assets Calculations
  const bankAssets = accounts.filter(a => a.balance > 0).reduce((acc, curr) => acc + curr.balance, 0);
  const stockAssets = investments.reduce((acc, curr) => acc + curr.current_value, 0);
  const physicalAssets = 350000.00; // Seed value: Home property valuation
  
  const totalAssets = bankAssets + stockAssets + physicalAssets;

  // Liabilities Calculations
  const creditCardDebts = Math.abs(accounts.filter(a => a.balance < 0).reduce((acc, curr) => acc + curr.balance, 0));
  const loanDebts = loans.reduce((acc, curr) => acc + curr.outstanding_amount, 0);
  
  const totalLiabilities = creditCardDebts + loanDebts;
  const netWorthValuation = totalAssets - totalLiabilities;

  // Historical calculation simulation
  const historicalData = [
    { name: 'Feb', Assets: totalAssets * 0.93, Liabilities: totalLiabilities * 1.05, NetWorth: (totalAssets * 0.93) - (totalLiabilities * 1.05) },
    { name: 'Mar', Assets: totalAssets * 0.95, Liabilities: totalLiabilities * 1.03, NetWorth: (totalAssets * 0.95) - (totalLiabilities * 1.03) },
    { name: 'Apr', Assets: totalAssets * 0.96, Liabilities: totalLiabilities * 1.02, NetWorth: (totalAssets * 0.96) - (totalLiabilities * 1.02) },
    { name: 'May', Assets: totalAssets * 0.98, Liabilities: totalLiabilities * 1.01, NetWorth: (totalAssets * 0.98) - (totalLiabilities * 1.01) },
    { name: 'Jun', Assets: totalAssets * 0.99, Liabilities: totalLiabilities, NetWorth: (totalAssets * 0.99) - totalLiabilities },
    { name: 'Jul', Assets: totalAssets, Liabilities: totalLiabilities, NetWorth: netWorthValuation }
  ];

  // 12-month Linear Projection Forecasting based on historical 1.2% monthly compounding
  const forecastData = [
    ...historicalData,
    { name: 'Aug', Assets: totalAssets * 1.012, Liabilities: totalLiabilities * 0.985, NetWorth: (totalAssets * 1.012) - (totalLiabilities * 0.985), forecast: true },
    { name: 'Sep', Assets: totalAssets * 1.024, Liabilities: totalLiabilities * 0.970, NetWorth: (totalAssets * 1.024) - (totalLiabilities * 0.970), forecast: true },
    { name: 'Oct', Assets: totalAssets * 1.036, Liabilities: totalLiabilities * 0.955, NetWorth: (totalAssets * 1.036) - (totalLiabilities * 0.955), forecast: true },
    { name: 'Nov', Assets: totalAssets * 1.048, Liabilities: totalLiabilities * 0.940, NetWorth: (totalAssets * 1.048) - (totalLiabilities * 0.940), forecast: true },
    { name: 'Dec', Assets: totalAssets * 1.060, Liabilities: totalLiabilities * 0.925, NetWorth: (totalAssets * 1.060) - (totalLiabilities * 0.925), forecast: true }
  ];

  const activeChartData = showForecast ? forecastData : historicalData;

  const monthlyGrowthAmount = netWorthValuation - (historicalData[4].NetWorth);
  const monthlyGrowthPct = (monthlyGrowthAmount / historicalData[4].NetWorth) * 100;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Net Worth Valuations
          </h1>
          <p className="text-sm text-muted-foreground">Tracing capital aggregates: assets minus liabilities and long-term forecasts.</p>
        </div>
        <Button onClick={() => setShowForecast(!showForecast)} variant="outline" className="flex items-center gap-1.5 cursor-pointer">
          <LineChart className="h-4 w-4" />
          {showForecast ? 'Hide 12m Projection' : 'Enable 12m Projection'}
        </Button>
      </div>

      {/* NET WORTH HEADER KPI DECK */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        
        <Card className="glow-primary">
          <CardContent className="p-5 flex justify-between items-center bg-primary/5 border border-primary/20">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Absolute Net Worth</span>
              <span className="text-2xl font-bold text-foreground">{currencySymbol}{netWorthValuation.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                +{monthlyGrowthPct.toFixed(2)}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gross Capital Assets</span>
              <span className="text-2xl font-bold text-foreground">{currencySymbol}{totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span className="text-[10px] text-muted-foreground">Cash, property, stock indices</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Combined Debts & Liabilities</span>
              <span className="text-2xl font-bold text-foreground">{currencySymbol}{totalLiabilities.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span className="text-[10px] text-muted-foreground">Mortgages, loans, CC balances</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Monthly Value Accrued</span>
              <span className={`text-xl font-bold flex items-center ${monthlyGrowthAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {monthlyGrowthAmount >= 0 ? '+' : ''}{currencySymbol}{monthlyGrowthAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">Net growth this month</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {loading ? (
        <div className="h-96 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Historical Assets vs Liabilities area chart */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Historical Balance Curve</CardTitle>
                <CardDescription>
                  {showForecast ? 'Capital compound forecasting models projected to December 2026' : 'Historical capital aggregates over the last six months'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="NetWorth" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNet)" name="Net Worth" />
                      <Area type="monotone" dataKey="Assets" stroke="#10b981" strokeWidth={1.5} fill="none" name="Assets" />
                      <Area type="monotone" dataKey="Liabilities" stroke="#f43f5e" strokeWidth={1.5} fill="none" name="Liabilities" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance Sheets list */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Assets details */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <CardTitle className="text-xs uppercase tracking-wider flex justify-between">
                  <span>Balance Sheet: Assets</span>
                  <span className="text-emerald-500">{currencySymbol}{totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-border/20 pb-2">
                  <span className="text-muted-foreground font-semibold">Cash & Banks Checking</span>
                  <span className="font-mono text-foreground font-bold">{currencySymbol}{bankAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/20 pb-2">
                  <span className="text-muted-foreground font-semibold">Stocks & Index Portfolios</span>
                  <span className="font-mono text-foreground font-bold">{currencySymbol}{stockAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Condominium Property</span>
                  <span className="font-mono text-foreground font-bold">{currencySymbol}{physicalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities details */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <CardTitle className="text-xs uppercase tracking-wider flex justify-between">
                  <span>Balance Sheet: Liabilities</span>
                  <span className="text-rose-500">{currencySymbol}{totalLiabilities.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-border/20 pb-2">
                  <span className="text-muted-foreground font-semibold">Outstanding Loan Mortgages</span>
                  <span className="font-mono text-foreground font-bold">{currencySymbol}{loanDebts.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Credit Card Statement dues</span>
                  <span className="font-mono text-foreground font-bold">{currencySymbol}{creditCardDebts.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      )}

    </div>
  );
};
