import React, { useState, useRef } from 'react';
import { 
  Boxes, PlusCircle, AlertCircle, CheckCircle, PackageOpen, LayoutGrid, 
  Trash2, ChevronLeft, ChevronRight, X, Lock, Info 
} from 'lucide-react';
import { Equipment, Assignment } from '../types';

interface InventoryProps {
  equipment: Equipment[];
  assignments: Assignment[];
  onRefresh: () => void;
}

export default function Inventory({ equipment, assignments, onRefresh }: InventoryProps) {
  // Add stock state
  const [eqName, setEqName] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [uniquePrefix, setUniquePrefix] = useState('CANTOR-');
  const [customPrefixSet, setCustomPrefixSet] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUnitIds, setExpandedUnitIds] = useState<Record<number, boolean>>({});

  // Carousel ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Selected item modal state
  const [selectedEquipmentForModal, setSelectedEquipmentForModal] = useState<Equipment | null>(null);

  // Load current user from localStorage for role enforcement
  const [currentUser] = useState<{ email: string; name: string; role: 'Admin' | 'Supervisor' | 'User' } | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  const toggleUnitExpand = (id: number) => {
    setExpandedUnitIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleNameChange = (val: string) => {
    setEqName(val);
    if (!customPrefixSet) {
      const slug = val
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 4);
      setUniquePrefix(`CANTOR-${slug || 'EQ'}`);
    }
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  // Add stock submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor') {
      setErrorMsg('Unauthorized: Only Administrators and Supervisors can add equipment stock.');
      return;
    }

    if (!eqName.trim()) {
      setErrorMsg('Please specify an Equipment Name.');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Total Quantity must be at least 1.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_name: eqName.trim(),
          total_quantity: quantity,
          unique_prefix: uniquePrefix.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update equipment inventory');
      }

      setSuccessMsg(`✓ Successfully registered equipment: "${data.equipment_name}" (${data.total_quantity} total units now in database).`);
      setEqName('');
      setQuantity(5);
      setUniquePrefix('CANTOR-');
      setCustomPrefixSet(false);
      onRefresh(); // Trigger parent fetch to update state
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving server-side inventory records.');
    } finally {
      setLoading(false);
    }
  };

  // Delete equipment profile (Admin & Supervisor only)
  const handleDeleteEquipment = async (id: number) => {
    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor') {
      alert('Unauthorized: Only Administrators and Supervisors can delete equipment profiles.');
      return;
    }

    if (!window.confirm('Are you sure you want to permanently delete this equipment profile? This will recall or purge all outstanding checkouts associated with it.')) {
      return;
    }

    setLoading(true);
    setSelectedEquipmentForModal(null);
    try {
      const response = await fetch(`/api/equipment/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete equipment record');
      }

      setSuccessMsg(`✓ Successfully deleted equipment profile.`);
      onRefresh(); // Trigger parent fetch to update state
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while deleting equipment profile.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a specific unit ID from an equipment model (Admin & Supervisor only)
  const handleDeleteUnit = async (equipmentId: number, unitId: string) => {
    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor') {
      alert('Unauthorized: Only Administrators and Supervisors can delete specific unit serials.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete unit ID "${unitId}"? This will reduce the stock size by 1.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/unit/${encodeURIComponent(unitId)}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete specific unit ID');
      }

      setSuccessMsg(`✓ Successfully deleted specific unit "${unitId}".`);
      
      // Keep selected modal in sync
      if (selectedEquipmentForModal && selectedEquipmentForModal.id === equipmentId) {
        setSelectedEquipmentForModal(prev => {
          if (!prev) return null;
          return {
            ...prev,
            total_quantity: Math.max(0, prev.total_quantity - 1),
            unit_ids: (prev.unit_ids || []).filter(uid => uid !== unitId),
            available_quantity: Math.max(0, prev.available_quantity - 1)
          };
        });
      }

      onRefresh(); // Trigger parent fetch to update state
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while deleting specified unit.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = equipment.filter(eq =>
    eq.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" id="inventory-section">
      <div className="border-b pb-4 border-slate-850">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
          <Boxes className="h-6 w-6 text-indigo-400 animate-pulse" />
          Equipment Stock & Inventory Dashboard
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Add new equipment models, re-stock units, and monitor active availability indicators in real-time.
        </p>
      </div>

      {/* SWIPEABLE/SCROLLABLE QUICK METRICS CAROUSEL */}
      <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-850">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 matches-title">
              <LayoutGrid className="h-4 w-4 text-indigo-400" />
              Active Stock Level Quick Metrics
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Click on any card to view detailed unit locations or delete models</p>
          </div>
          
          {equipment.length > 0 && (
            <div className="flex items-center gap-1.5" id="carousel-controls">
              <button
                type="button"
                onClick={scrollLeft}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-705 text-slate-400 hover:text-white cursor-pointer select-none transition-all hover:bg-slate-900"
                title="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={scrollRight}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-705 text-slate-400 hover:text-white cursor-pointer select-none transition-all hover:bg-slate-900"
                title="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Swipe container */}
        <div 
          ref={carouselRef}
          className="flex overflow-x-auto gap-4 pb-3 scroll-smooth snap-x snap-mandatory scrollbar-none md:scrollbar-thin scrollbar-thumb-indigo-500/10 scrollbar-track-transparent select-none touch-pan-x"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {equipment.map((item) => {
            const availRatio = item.available_quantity / item.total_quantity;
            let statusBorderColor = 'border-l-4 border-l-emerald-500 bg-slate-950';
            if (item.available_quantity === 0) {
              statusBorderColor = 'border-l-4 border-l-red-500 bg-slate-955 bg-slate-950';
            } else if (availRatio < 0.35) {
              statusBorderColor = 'border-l-4 border-l-amber-500 bg-slate-950';
            }

            return (
              <div 
                key={item.id} 
                onClick={() => setSelectedEquipmentForModal(item)}
                className={`border border-slate-800/80 rounded-xl p-5 shadow-lg ${statusBorderColor} flex flex-col justify-between w-64 shrink-0 snap-start cursor-pointer hover:border-slate-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-indigo-550/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300" />
                
                <div className="relative z-10 w-full">
                  <div className="flex items-start justify-between gap-1 w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block truncate max-w-[170px] group-hover:text-white transition-colors">
                      {item.equipment_name}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 font-bold">#{item.id}</span>
                  </div>
                  <div className="text-2xl font-black mt-1.5 text-slate-100 font-mono">
                    {item.available_quantity} <span className="text-xs text-slate-500 font-normal">/ {item.total_quantity}</span>
                  </div>
                </div>
                
                <div className="text-[10px] uppercase font-bold mt-4 relative z-10 flex items-center justify-between">
                  {item.available_quantity === 0 ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                      Out of Stock
                    </span>
                  ) : availRatio < 0.35 ? (
                    <span className="text-amber-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Low stock
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Fully Available
                    </span>
                  )}
                  
                  <span className="text-[9px] text-indigo-400 font-semibold uppercase group-hover:underline opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0">
                    Open ▸
                  </span>
                </div>
              </div>
            );
          })}
          
          {equipment.length === 0 && (
            <div className="w-full border border-dashed border-slate-805 rounded-xl p-8 text-center text-xs text-slate-500 font-mono">
              No equipment stock found to represent in metrics.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          {currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2 font-mono">
                <PlusCircle className="h-5 w-5 text-slate-650" />
                Add Equipment
              </h3>
              <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 text-center space-y-3">
                <Lock className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Access Restricted</p>
                <p className="text-[10px] text-slate-500 font-medium font-mono">
                  Only Admins and Supervisors can register new assets or append inventory stock numbers.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                Add Equipment Stock
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Equipment Name / Model
              </label>
              <input
                type="text"
                value={eqName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Sony FX3 Cinema Camera"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1.5 block">Adding an existing name automatically increments its stock counts.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Unique ID Prefix
              </label>
              <input
                type="text"
                value={uniquePrefix}
                onChange={(e) => {
                  setUniquePrefix(e.target.value.toUpperCase());
                  setCustomPrefixSet(true);
                }}
                placeholder="e.g., CANTOR-CAM"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1.5 block">
                Each unit will automatically receive a unique sequence code: e.g. <strong>{uniquePrefix.trim() || 'CANTOR-EQ'}-01</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Total Quantity to Add
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Live Serial Preview Box */}
            {eqName.trim() && (
              <div className="bg-slate-955/20 bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-xs space-y-2 font-mono">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Live Generated ID Preview ({quantity} unit{quantity > 1 ? 's' : ''})
                </span>
                <div className="flex flex-wrap gap-1.5 leading-relaxed">
                  {(() => {
                    const existingItem = equipment.find(e => e.equipment_name.toLowerCase() === eqName.toLowerCase().trim());
                    const activePrefix = existingItem?.unique_prefix || uniquePrefix.trim().toUpperCase() || 'CANTOR-EQ';
                    const startNum = (existingItem?.unit_ids || []).length + 1;
                    
                    const previewSerials = [];
                    for (let i = 0; i < Math.min(quantity, 8); i++) {
                      const num = startNum + i;
                      const suffix = num < 10 ? `0${num}` : `${num}`;
                      previewSerials.push(`${activePrefix}-${suffix}`);
                    }
                    
                    return (
                      <>
                        {previewSerials.map((s, idx) => (
                          <span key={idx} className="bg-indigo-950/40 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-300">
                            {s}
                          </span>
                        ))}
                        {quantity > 8 && <span className="text-slate-500 text-[10px] self-center pl-1 font-bold">+{quantity - 8} more...</span>}
                        {existingItem && (
                          <div className="text-[9px] text-emerald-400 mt-2 block w-full font-sans uppercase font-bold tracking-wider">
                            ✓ Appending stock on existing ID range (starts from #{startNum})
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex gap-2 items-start bg-red-955/40 text-red-400 px-3 py-2.5 rounded-lg border border-red-900/30 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex gap-2 items-start bg-emerald-905/40 text-emerald-400 px-3 py-2.5 rounded-lg border border-emerald-900/30 text-xs">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/50"
            >
              {loading ? 'Processing...' : 'Add Stock units'}
            </button>
          </form>
          </>
          )}
        </div>

        {/* Dashboard table panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <PackageOpen className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search equipment stock..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            {(currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor') && (
              <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded font-mono">
                <Lock className="h-3 w-3" /> Controls Active
              </span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/70 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 text-center w-16 border-b border-slate-800">ID</th>
                    <th scope="col" className="px-6 py-3.5 border-b border-slate-800">Equipment Name</th>
                    <th scope="col" className="px-6 py-3.5 text-center border-b border-slate-800">Total Stock</th>
                    <th scope="col" className="px-6 py-3.5 text-center border-b border-slate-800">In Stock / Available</th>
                    <th scope="col" className="px-6 py-3.5 border-b border-slate-800">Status Indicator</th>
                    {(currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor') && (
                      <th scope="col" className="px-6 py-3.5 text-right border-b border-slate-800">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 bg-slate-900">
                  {filteredEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={(currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor') ? 6 : 5} className="text-center py-12 text-slate-500 text-xs font-mono">
                        No equipment catalog found. Add stock models to see them here!
                      </td>
                    </tr>
                  ) : (
                    filteredEquipment.map((eq) => {
                      const avail = eq.available_quantity;
                      const total = eq.total_quantity;
                      const ratio = avail / total;

                      let statusBadge = (
                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          FULLY AVAILABLE
                        </span>
                      );

                      if (avail === 0) {
                        statusBadge = (
                          <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                            OUT OF STOCK
                          </span>
                        );
                      } else if (ratio < 0.35) {
                        statusBadge = (
                          <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            LOW STOCK
                          </span>
                        );
                      }

                      return (
                        <tr key={eq.id} className="hover:bg-slate-800/25 transition-colors">
                          <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">{eq.id}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-100 hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => setSelectedEquipmentForModal(eq)}>
                              {eq.equipment_name}
                            </div>
                             {eq.unit_ids && eq.unit_ids.length > 0 && (
                              <div className="mt-1.5 text-left">
                                <button
                                  type="button"
                                  onClick={() => toggleUnitExpand(eq.id)}
                                  className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-350 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  {expandedUnitIds[eq.id] ? (
                                    <>Hide {eq.unit_ids.length} Unit Serials ▾</> 
                                  ) : (
                                    <>Show {eq.unit_ids.length} Unit Serials ▸</>
                                  )}
                                </button>
                                
                                {expandedUnitIds[eq.id] && (
                                  <div className="flex flex-wrap gap-1 mt-2 max-w-xs md:max-w-md animate-fade-in bg-slate-950/55 p-2 rounded-lg border border-slate-850">
                                    {eq.unit_ids.map((uid) => (
                                      <span
                                        key={uid}
                                        className="px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-tight rounded bg-slate-900 text-slate-300 border border-slate-800"
                                        title={`Unique Serial Code: ${uid}`}
                                      >
                                        {uid}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-slate-300 font-semibold">{total}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${avail === 0 ? 'text-red-400 bg-red-500/10' : ratio < 0.35 ? 'text-amber-505 bg-amber-500/10' : 'text-slate-300 bg-slate-950 border border-slate-850'}`}>
                              {avail}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold">{statusBadge}</td>
                          {(currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor') && (
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteEquipment(eq.id)}
                                className="p-1 px-2.5 rounded bg-red-955/20 hover:bg-red-900 border border-red-900/30 text-red-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1 ml-auto cursor-pointer transition-all"
                                title="Delete equipment structure"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-955/20 border-t border-slate-850/60 px-6 py-4">
              <span className="text-xs text-slate-400 font-mono">
                Total unique equipment profiles: <strong>{filteredEquipment.length}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP OVERLAY MODAL FOR EXPANDED EQUIPMENT */}
      {selectedEquipmentForModal && (() => {
        const item = selectedEquipmentForModal;
        const total = item.total_quantity;
        const avail = item.available_quantity;
        const ratio = total > 0 ? avail / total : 0;
        
        // Find active checkouts for this item
        const itemCheckouts = (assignments || []).filter(
          asg => asg.equipment_id === item.id && asg.status === 'Out'
        );

        let statusText = 'Fully Available';
        let statusColor = 'text-emerald-400';
        let barColor = 'bg-emerald-500';
        if (avail === 0) {
          statusText = 'Out of Stock';
          statusColor = 'text-red-400';
          barColor = 'bg-red-500';
        } else if (ratio < 0.35) {
          statusText = 'Low Stock';
          statusColor = 'text-amber-500';
          barColor = 'bg-amber-500';
        }

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in flex flex-col justify-between max-h-[85vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-850 bg-slate-950/50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider bg-indigo-950 text-indigo-400 border border-indigo-500/20">
                      ID PREFIX: {item.unique_prefix || 'CANTOR'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">ID: #{item.id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mt-1 font-sans tracking-tight">
                    {item.equipment_name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEquipmentForModal(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer select-none transition-colors border border-transparent hover:border-slate-705"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Stock gauge metric */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-slate-400 font-medium">Real-time Stock Level</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                      ● {statusText}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-3xl font-black text-slate-100">{avail}</span>
                    <span className="text-sm text-slate-500 font-normal">/ {total} units in stock</span>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full ${barColor} rounded-full transition-all duration-300`} 
                      style={{ width: `${Math.max(4, Math.min(100, (total > 0 ? (avail / total) * 100 : 0)))}%` }}
                    />
                  </div>
                </div>

                {/* Queue of serial markers and current state */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <LayoutGrid className="h-4 w-4 text-indigo-400" />
                    Physical Badge Serials ({item.unit_ids?.length || 0})
                  </h4>

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1.5 bg-slate-950/30 rounded-xl border border-slate-850/60 font-mono">
                    {(item.unit_ids || []).map((uid) => {
                      // Find if this unit is currently out
                      const activeC = itemCheckouts.find(c => c.unit_id === uid);
                      
                      return (
                        <div 
                          key={uid} 
                          className={`flex items-center justify-between p-2.5 rounded-lg text-xs border ${
                            activeC 
                              ? 'bg-red-950/20 border-red-900/30 text-red-400' 
                              : 'bg-slate-950/50 border-slate-850 text-slate-300 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${activeC ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span className="tracking-tight">{uid}</span>
                          </div>
                          
                          <div className="flex items-center gap-2.5">
                            {activeC ? (
                              <span className="text-[10px] text-slate-400 bg-red-955/25 border border-slate-855 px-2.5 py-0.5 rounded-md font-sans font-medium">
                                Claimed: <strong className="text-slate-200">{activeC.user_name}</strong>
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 uppercase font-bold text-[9px]">
                                Available
                              </span>
                            )}

                            {(currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor') && (
                              <button
                                type="button"
                                disabled={!!activeC}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUnit(item.id, uid);
                                }}
                                className={`p-1 rounded transition-colors ${
                                  activeC 
                                    ? 'text-slate-700 cursor-not-allowed opacity-30' 
                                    : 'text-red-400 hover:text-white hover:bg-red-950/60 cursor-pointer pointer-events-auto'
                                }`}
                                title={activeC ? `Cannot delete because unit is actively checked out by ${activeC.user_name}` : `Delete serial ${uid}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {(!item.unit_ids || item.unit_ids.length === 0) && (
                      <p className="text-xs text-slate-500 p-4 text-center select-none">No unit serial IDs registered.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-850 bg-slate-950/30 flex items-center justify-between gap-4">
                {currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEquipment(item.id)}
                    className="bg-red-950/35 hover:bg-gradient-to-r hover:from-red-900 hover:to-red-800 text-red-400 hover:text-white border border-red-900/50 hover:border-red-650 font-bold py-2 px-4 rounded-xl text-xs transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-red-950/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Equipment Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-semibold uppercase tracking-wider font-mono">
                    <Lock className="h-3.5 w-3.5" />
                    Only Admins & Supervisors can edit/delete
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => setSelectedEquipmentForModal(null)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2 px-5 rounded-xl text-xs transition-all text-center cursor-pointer border border-slate-700 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
