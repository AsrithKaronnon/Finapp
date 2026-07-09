import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock 
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

export const CalendarView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [, setLoans] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Active calendar date selection
  const [currentDate, setCurrentDate] = useState(new Date('2026-07-08')); // Match user metadata date anchor
  
  // Custom reminder modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedCellDate, setSelectedCellDate] = useState<string | null>(null);
  const [reminderText, setReminderText] = useState('');

  const fetchCalendarAssets = async () => {
    setLoading(true);
    try {
      const [
        { data: billsData },
        { data: loansData },
        { data: goalsData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('bills').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (billsData) setBills(billsData);
      if (loansData) setLoans(loansData);
      if (goalsData) setGoals(goalsData);
      
      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
      
      // Load saved reminders from localStorage
      const savedReminders = JSON.parse(localStorage.getItem('financeos_calendar_reminders') || '[]');
      setReminders(savedReminders);
    } catch (err) {
      console.error('Error fetching calendar elements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarAssets();
  }, []);

  const handlePrevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(next);
  };

  // Generate calendar days
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
    
    // Pad previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        dateStr: new Date(year, month - 1, prevMonthLastDay - i).toISOString().split('T')[0]
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(year, month, d + 1); // offset correction
      days.push({
        day: d,
        isCurrentMonth: true,
        dateStr: dateObj.toISOString().split('T')[0]
      });
    }

    return days;
  };

  // Reschedule/Add Reminders
  const handleCellClick = (dateStr: string) => {
    setSelectedCellDate(dateStr);
    setReminderText('');
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderText.trim() || !selectedCellDate) return;

    const newReminder = {
      id: crypto.randomUUID(),
      date: selectedCellDate,
      text: reminderText,
      type: 'custom'
    };

    const updated = [...reminders, newReminder];
    setReminders(updated);
    localStorage.setItem('financeos_calendar_reminders', JSON.stringify(updated));
    setIsReminderModalOpen(false);
  };


  const days = getDaysInMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Event matcher
  const getEventsForDate = (dateStr: string) => {
    const events: Array<{ type: 'salary' | 'bill' | 'emi' | 'goal' | 'custom'; label: string; details: string; id: string }> = [];

    // 1. Check for salary paycheck (hardcoded on 2nd of month matching transaction seed)
    if (dateStr.endsWith('-02')) {
      events.push({ id: 'salary-1', type: 'salary', label: 'Salary Payday', details: `Stripe tech bi-weekly paycheck: ${currencySymbol}5200` });
    }

    // 2. Matching bills
    bills.forEach(bill => {
      if (bill.due_date === dateStr) {
        events.push({ id: bill.id, type: 'bill', label: bill.name, details: `Bill amount: ${currencySymbol}${bill.amount}` });
      }
    });

    // 3. Matching EMIs (seeded on 15th and 1st of month)
    if (dateStr.endsWith('-15')) {
      events.push({ id: 'emi-tesla', type: 'emi', label: 'Tesla Model Y EMI', details: `Monthly loan auto-debit: ${currencySymbol}845.50` });
    }
    if (dateStr.endsWith('-01')) {
      events.push({ id: 'emi-condo', type: 'emi', label: 'Condo Mortgage EMI', details: `Monthly home mortgage auto-debit: ${currencySymbol}2143.00` });
    }

    // 4. Matching goal contributions (seeded due dates)
    goals.forEach(goal => {
      if (goal.due_date === dateStr) {
        events.push({ id: goal.id, type: 'goal', label: `Goal Due: ${goal.name}`, details: `Target: ${currencySymbol}${goal.target_amount}` });
      }
    });

    // 5. Custom reminders
    reminders.forEach(rem => {
      if (rem.date === dateStr) {
        events.push({ id: rem.id, type: 'custom', label: rem.text, details: 'User custom reminder note' });
      }
    });

    return events;
  };

  const getEventClass = (type: string) => {
    switch (type) {
      case 'salary': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'bill': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'emi': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'goal': return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Calendar Header toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Financial Calendar
          </h1>
          <p className="text-sm text-muted-foreground">Trace salaries, outstanding utility dates, mortgage EMIs and custom reminders.</p>
        </div>
        
        {/* Month selectors */}
        <div className="flex items-center gap-3 bg-card border border-border/80 p-1.5 rounded-xl select-none">
          <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-muted cursor-pointer">
            <ChevronLeft className="h-4.5 w-4.5 text-foreground" />
          </button>
          <span className="text-xs font-bold text-foreground min-w-[90px] text-center">
            {monthName} {currentDate.getFullYear()}
          </span>
          <button onClick={handleNextMonth} className="p-1 rounded hover:bg-muted cursor-pointer">
            <ChevronRight className="h-4.5 w-4.5 text-foreground" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-96 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Grid calendar */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardContent className="p-0">
                
                {/* Weekday headers */}
                <div className="grid grid-cols-7 text-center font-bold text-[10px] text-muted-foreground border-b border-border bg-muted/20 py-2.5 select-none">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Day Cell grids */}
                <div className="grid grid-cols-7 min-h-[480px]">
                  {days.map((cell, idx) => {
                    const cellEvents = getEventsForDate(cell.dateStr);

                    return (
                      <div
                        key={idx}
                        onClick={() => handleCellClick(cell.dateStr)}
                        className={`
                          border-r border-b border-border/40 p-1.5 flex flex-col gap-1 min-h-[90px] cursor-pointer hover:bg-muted/15 transition-colors
                          ${cell.isCurrentMonth ? 'bg-card text-foreground' : 'bg-muted/10 text-muted-foreground opacity-60'}
                        `}
                      >
                        <span className="text-[10px] font-bold self-end font-mono select-none">
                          {cell.day}
                        </span>
                        
                        {/* Event tags listing */}
                        <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[70px]">
                          {cellEvents.map((ev, eIdx) => (
                            <div
                              key={eIdx}
                              title={ev.details}
                              className={`
                                text-[9px] font-bold px-1.5 py-0.5 rounded border truncate max-w-full
                                ${getEventClass(ev.type)}
                              `}
                            >
                              {ev.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Right panel: Active Month alerts */}
          <div className="lg:col-span-1 space-y-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none px-1">
              Upcoming Schedule Alerts
            </div>
            
            {/* Display upcoming monthly events */}
            <Card className="max-h-[500px] overflow-y-auto">
              <CardContent className="p-4 space-y-4 text-xs select-none">
                {bills.concat(reminders).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No scheduled items active this month.
                  </div>
                ) : (
                  bills.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center font-bold text-foreground">
                        <span>{item.name}</span>
                        <span className="font-mono">${item.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> Due: {item.due_date}</span>
                        <Badge variant={item.status_id === SEED.statuses.paid ? 'success' : 'neutral'} className="text-[8px]">
                          {item.status_id === SEED.statuses.paid ? 'Paid' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* CREATE REMINDER DIALOG */}
      <Dialog
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title={selectedCellDate ? `Schedule note: ${selectedCellDate}` : 'Log Reminder'}
      >
        <form onSubmit={handleSaveReminder} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Reminder Note text</label>
            <input
              type="text"
              required
              autoFocus
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="e.g. Remember to transfer wedding savings contribution"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsReminderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reminderText.trim()}>
              Save Reminder
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
