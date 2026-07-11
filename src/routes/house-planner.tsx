import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Hammer, CheckCircle2, Trash2, Pencil 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

export const HousePlanner: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [furnitureTypes, setFurnitureTypes] = useState<any[]>([]);
  
  // Selected Room ID
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Add Item Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    room_id: '',
    name: '',
    furniture_type_id: SEED.furniture_types.sofa,
    estimated_cost: 0,
    actual_cost: null as number | null,
    vendor: '',
    status_id: SEED.statuses.pending,
    priority_id: SEED.priorities.medium,
    warranty: '',
    install_date: ''
  });

  const [currencySymbol, setCurrencySymbol] = useState('$');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: roomsData },
        { data: itemsData },
        { data: statData },
        { data: priData },
        { data: typeData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('house_furnishing_rooms').select('*'),
        supabase.from('house_furnishing_items').select('*'),
        supabase.from('statuses').select('*'),
        supabase.from('priorities').select('*'),
        supabase.from('furniture_types').select('*'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (roomsData) {
        setRooms(roomsData);
        if (roomsData.length > 0 && !activeRoomId) {
          setActiveRoomId(roomsData[0].id);
        }
      }
      if (itemsData) setItems(itemsData);
      if (statData) setStatuses(statData);
      if (priData) setPriorities(priData);
      if (typeData) setFurnitureTypes(typeData);

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
    } catch (err) {
      console.error('Error fetching house planner dataset:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setFormData({
      room_id: activeRoomId || '',
      name: '',
      furniture_type_id: SEED.furniture_types.sofa,
      estimated_cost: 0,
      actual_cost: null,
      vendor: '',
      status_id: SEED.statuses.pending,
      priority_id: SEED.priorities.medium,
      warranty: '',
      install_date: ''
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: any) => {
    setEditingItem(item);
    setFormData({
      room_id: item.room_id,
      name: item.name,
      furniture_type_id: item.furniture_type_id,
      estimated_cost: item.estimated_cost,
      actual_cost: item.actual_cost,
      vendor: item.vendor || '',
      status_id: item.status_id,
      priority_id: item.priority_id,
      warranty: item.warranty || '',
      install_date: item.install_date || ''
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await supabase.from('house_furnishing_items').update(formData).eq('id', editingItem.id);
      } else {
        await supabase.from('house_furnishing_items').insert([formData]);
      }
      setIsItemModalOpen(false);
      fetchData();
      toast.success('Furnishing checklist item saved!');
    } catch (err) {
      toast.error('Error saving furnishing checklist item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this furnishing checklist item?')) return;
    try {
      await supabase.from('house_furnishing_items').delete().eq('id', id);
      fetchData();
      toast.success('Checklist item deleted');
    } catch (err) {
      toast.error('Error deleting checklist item');
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const roomItems = items.filter(i => i.room_id === activeRoomId);

  // Furnishing cost calculations
  const totalRoomActual = roomItems.reduce((acc, curr) => acc + (curr.actual_cost || 0), 0);

  // General project totals
  const totalProjectBudget = rooms.reduce((acc, curr) => acc + curr.budget, 0);
  const totalProjectEstimate = items.reduce((acc, curr) => acc + curr.estimated_cost, 0);
  const totalProjectActual = items.reduce((acc, curr) => acc + (curr.actual_cost || 0), 0);
  const overallCompletedCount = items.filter(i => i.status_id === SEED.statuses.completed).length;
  const overallCompletionPct = items.length > 0 
    ? Math.round((overallCompletedCount / items.length) * 100) 
    : 0;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Hammer className="h-6 w-6 text-primary" />
            House Furnishing Planner
          </h1>
          <p className="text-sm text-muted-foreground">Manage room furnishing checksheets, warranties, and estimate overruns.</p>
        </div>
        <Button onClick={handleOpenAddItem} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Checklist Item
        </Button>
      </div>

      {/* OVERALL PROJECT STATS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
        
        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Project Budget</span>
              <span className="text-xl font-bold text-foreground">${totalProjectBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Furnishing Estimate</span>
              <span className="text-xl font-bold text-foreground">${totalProjectEstimate.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Capital Outflow Spent</span>
              <span className="text-xl font-bold text-foreground">${totalProjectActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overall Project Progress</span>
              <span className="text-xl font-bold text-foreground">{overallCompletionPct}% done</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {loading ? (
        <div className="h-64 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left panel: Room listings */}
          <div className="lg:col-span-1 space-y-4 select-none">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              Room Feature Areas
            </div>
            {rooms.map((room) => {
              const rItems = items.filter(i => i.room_id === room.id);
              const completedCount = rItems.filter(i => i.status_id === SEED.statuses.completed).length;
              const completedPct = rItems.length > 0 ? Math.round((completedCount / rItems.length) * 100) : 0;

              return (
                <Card 
                  key={room.id}
                  className={`
                    hoverEffect cursor-pointer
                    ${activeRoomId === room.id ? 'border-primary bg-primary/5 shadow-xs' : ''}
                  `}
                  onClick={() => setActiveRoomId(room.id)}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">{room.name}</CardTitle>
                    <CardDescription className="text-xs">Budget limit: ${room.budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs">
                    <div className="w-full bg-muted rounded-full h-1 mt-1 overflow-hidden">
                      <div className="bg-primary h-1 rounded-full" style={{ width: `${completedPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                      <span>{completedPct}% furnished</span>
                      <span>{rItems.length} elements</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Right panel: Active Room checklist grid */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-base">{activeRoom?.name}</CardTitle>
                    <CardDescription>Budget allocated: ${activeRoom?.budget?.toLocaleString('en-US', { maximumFractionDigits: 0 })} | spent: ${totalRoomActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}</CardDescription>
                  </div>
                  <Badge variant={totalRoomActual > (activeRoom?.budget || 0) ? 'danger' : 'success'}>
                    {totalRoomActual > (activeRoom?.budget || 0) ? 'Budget Overrun' : 'Within Budget'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-y-auto max-h-[400px]">
                {roomItems.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground flex flex-col justify-center items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500/80 animate-pulse" />
                    <span>No Checklist items created under this room.</span>
                    <Button size="sm" variant="outline" onClick={handleOpenAddItem}>
                      Add First Checklist Element
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-muted-foreground font-bold sticky top-0 select-none">
                          <th className="p-3 pl-5">Furnishing Item</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Vendor</th>
                          <th className="p-3 text-right">Estimate Cost</th>
                          <th className="p-3 text-right">Actual Spent</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Priority</th>
                          <th className="p-3 pr-5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomItems.map((item) => {
                          const furniture = furnitureTypes.find(f => f.id === item.furniture_type_id)?.name || 'Custom';
                          const pri = priorities.find(p => p.id === item.priority_id)?.name || 'Medium';
                          const isOver = item.actual_cost && item.actual_cost > item.estimated_cost;

                          return (
                            <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10">
                              <td className="p-3 pl-5 font-semibold text-foreground">
                                <div className="flex flex-col">
                                  <span>{item.name}</span>
                                  {item.warranty && (
                                    <span className="text-[9px] text-muted-foreground font-mono">Warranty: {item.warranty}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3"><Badge variant="primary" className="text-[9px]">{furniture}</Badge></td>
                              <td className="p-3 text-muted-foreground font-medium">{item.vendor || '—'}</td>
                              <td className="p-3 text-right font-mono">{currencySymbol}{item.estimated_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                              <td className={`p-3 text-right font-mono font-bold ${isOver ? 'text-rose-500' : ''}`}>
                                {item.actual_cost ? `${currencySymbol}${item.actual_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Pending'}
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={item.status_id === SEED.statuses.completed ? 'success' : 'warning'} className="text-[9px]">
                                  {item.status_id === SEED.statuses.completed ? 'Completed' : 'Pending'}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={pri === 'High' ? 'danger' : pri === 'Medium' ? 'warning' : 'neutral'} className="text-[9px]">
                                  {pri}
                                </Badge>
                              </td>
                              <td className="p-3 pr-5 text-center space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors inline-flex"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors inline-flex"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* CREATE / EDIT FURNISHING ITEM DIALOG */}
      <Dialog
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit checklist element' : 'Add room element'}
      >
        <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Element Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="e.g. L-Shaped Fabric Sofa, Ergonomic Chair"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Estimated cost ({currencySymbol})</label>
              <input
                type="number"
                required
                value={formData.estimated_cost || ''}
                onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Actual Spent ({currencySymbol})</label>
              <input
                type="number"
                value={formData.actual_cost || ''}
                onChange={(e) => setFormData({ ...formData, actual_cost: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="Leave blank if pending"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Supplier Vendor</label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="e.g. West Elm, IKEA"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Furniture Class Type</label>
              <select
                value={formData.furniture_type_id}
                onChange={(e) => setFormData({ ...formData, furniture_type_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {furnitureTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                value={formData.status_id}
                onChange={(e) => setFormData({ ...formData, status_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Priority</label>
              <select
                value={formData.priority_id}
                onChange={(e) => setFormData({ ...formData, priority_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Warranty Period</label>
              <input
                type="text"
                value={formData.warranty}
                onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="e.g. 5 Years, 1 Year"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Installation Date</label>
              <input
                type="date"
                value={formData.install_date}
                onChange={(e) => setFormData({ ...formData, install_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Log Checklist Element
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
