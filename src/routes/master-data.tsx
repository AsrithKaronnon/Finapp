import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { Plus, Trash2, Edit3, ShieldAlert, Sliders } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

type MasterTableKey = 
  | 'expense_categories' 
  | 'income_categories' 
  | 'payment_methods' 
  | 'currencies' 
  | 'goal_types' 
  | 'loan_types' 
  | 'bill_types' 
  | 'room_types' 
  | 'furniture_types'
  | 'priorities'
  | 'recurrence_types'
  | 'tags'
  | 'languages'
  | 'statuses';

export const MasterData: React.FC = () => {
  const [activeTable, setActiveTable] = useState<MasterTableKey>('expense_categories');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',      // For currencies/languages
    symbol: '',    // For currencies
    icon: '',      // For categories
    color: '',     // For categories
    remarks: '',
    sort_order: 0,
    is_active: true
  });

  const tables: Array<{ key: MasterTableKey; label: string; desc: string }> = [
    { key: 'expense_categories', label: 'Expense Categories', desc: 'Primary buckets for user outflows' },
    { key: 'income_categories', label: 'Income Categories', desc: 'Buckets for salary, side gigs, etc.' },
    { key: 'payment_methods', label: 'Payment Methods', desc: 'Credit cards, cash, bank accounts' },
    { key: 'currencies', label: 'Currencies', desc: 'Available system currencies (USD, INR, EUR)' },
    { key: 'goal_types', label: 'Goal Types', desc: 'Categories for saving goals' },
    { key: 'loan_types', label: 'Loan Types', desc: 'Categories for debt amortization' },
    { key: 'bill_types', label: 'Bill Types', desc: 'Electricity, internet, subscriptions' },
    { key: 'room_types', label: 'House Room Types', desc: 'Living, bedroom, kitchen planning' },
    { key: 'furniture_types', label: 'Furniture Types', desc: 'Sofa, bed, chairs checklists' },
    { key: 'priorities', label: 'Priorities', desc: 'Urgency metrics: High, Medium, Low' },
    { key: 'recurrence_types', label: 'Recurrence Patterns', desc: 'Weekly, Monthly, Yearly' },
    { key: 'tags', label: 'Tags', desc: 'Labels for transaction groupings' },
    { key: 'languages', label: 'Languages', desc: 'Interface languages translation data' },
    { key: 'statuses', label: 'Statuses', desc: 'Payment and transaction lifecycle' }
  ];

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(activeTable)
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Error fetching master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTable]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      code: '',
      symbol: '',
      icon: 'Tag',
      color: 'blue',
      remarks: '',
      sort_order: items.length,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      symbol: item.symbol || '',
      icon: item.icon || 'Tag',
      color: item.color || 'blue',
      remarks: item.remarks || '',
      sort_order: item.sort_order || 0,
      is_active: item.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        // Update
        const { error } = await supabase
          .from(activeTable)
          .update(formData)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from(activeTable)
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchItems();
      toast.success('Record saved successfully!');
    } catch (err) {
      toast.error('Error saving record');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from(activeTable)
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchItems();
      toast.success('Status updated successfully');
    } catch (err) {
      toast.error('Error updating active state');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this master configuration record?')) return;
    try {
      const { error } = await supabase
        .from(activeTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchItems();
      toast.success('Record deleted successfully');
    } catch (err) {
      toast.error('Error deleting record');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-6 w-6 text-primary" />
            Master Data Administration
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure system lists, subcategories, currencies, and categories without editing frontend code.
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Tables Selection Panel */}
        <div className="lg:col-span-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible border border-border/50 bg-card rounded-xl p-3 gap-1 h-fit select-none">
          {tables.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTable(t.key)}
              className={`
                px-3 py-2 rounded-lg text-left text-xs font-semibold whitespace-nowrap lg:whitespace-normal cursor-pointer transition-colors
                ${activeTable === t.key 
                  ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <div className="font-bold">{t.label}</div>
              <div className="hidden lg:block text-[10px] opacity-75 font-normal mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Right Side: Configuration List Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {tables.find(t => t.key === activeTable)?.label}
              </CardTitle>
              <CardDescription>
                Currently managing {items.length} dynamic config items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2 py-8">
                  <div className="h-8 w-full animate-pulse rounded bg-muted/40" />
                  <div className="h-8 w-full animate-pulse rounded bg-muted/40" />
                  <div className="h-8 w-full animate-pulse rounded bg-muted/40" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 border border-dashed border-border rounded-xl text-center flex flex-col justify-center items-center gap-3">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground/60 animate-pulse" />
                  <div className="text-sm font-semibold text-foreground">Empty Configuration list</div>
                  <Button size="sm" variant="outline" onClick={handleOpenAdd}>
                    Add First Record
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 text-muted-foreground text-xs font-bold">
                        <th className="pb-3 pr-4">Order</th>
                        <th className="pb-3 pr-4">Name</th>
                        {activeTable === 'currencies' && <th className="pb-3 pr-4">Code / Symbol</th>}
                        {['expense_categories', 'income_categories'].includes(activeTable) && (
                          <th className="pb-3 pr-4">Icon / Color</th>
                        )}
                        <th className="pb-3 pr-4">Remarks</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-border/40 hover:bg-muted/10">
                          <td className="py-3 pr-4 text-xs text-muted-foreground font-mono">
                            {item.sort_order}
                          </td>
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {item.name}
                          </td>
                          {activeTable === 'currencies' && (
                            <td className="py-3 pr-4 text-xs font-semibold font-mono text-muted-foreground">
                              {item.code} ({item.symbol})
                            </td>
                          )}
                          {['expense_categories', 'income_categories'].includes(activeTable) && (
                            <td className="py-3 pr-4">
                              <Badge variant="primary" className={`bg-${item.color}-500/10 text-${item.color}-500 border-${item.color}-500/20 capitalize`}>
                                {item.icon} ({item.color})
                              </Badge>
                            </td>
                          )}
                          <td className="py-3 pr-4 text-xs text-muted-foreground truncate max-w-[200px]">
                            {item.remarks || '—'}
                          </td>
                          <td className="py-3 pr-4">
                            <button
                              onClick={() => handleToggleActive(item.id, item.is_active)}
                              className="cursor-pointer focus:outline-none"
                            >
                              <Badge variant={item.is_active ? 'success' : 'neutral'}>
                                {item.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </button>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors inline-flex"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors inline-flex"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      {/* CRUD DIALOG MODAL */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Master Record' : 'Create Master Record'}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Configuration Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Health & Gym, Credit Card, USD"
            />
          </div>

          {activeTable === 'currencies' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">ISO Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GBP"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Symbol</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. £"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {['expense_categories', 'income_categories'].includes(activeTable) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Lucide Icon Key</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heart, ShoppingBag"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Color Scheme</label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="emerald">Emerald Green</option>
                  <option value="blue">Blue</option>
                  <option value="sky">Sky Blue</option>
                  <option value="amber">Amber Yellow</option>
                  <option value="violet">Violet Purple</option>
                  <option value="rose">Rose Red</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mt-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary/40 h-4 w-4"
                />
                Active Status
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Remarks / Description</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 h-20 resize-none"
              placeholder="Operational remarks..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Configuration
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
