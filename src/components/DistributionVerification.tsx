import React, { useState } from 'react';
import { 
  ClipboardList, 
  Key, 
  User, 
  Calendar, 
  Moon, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Boxes,
  Lock
} from 'lucide-react';
import { Equipment, Assignment } from '../types';

interface DistributionProps {
  equipment: Equipment[];
  assignments: Assignment[];
  onRefresh: () => void;
}

export default function DistributionVerification({ equipment, assignments, onRefresh }: DistributionProps) {
  // Session Access state
  const [currentUser] = useState<{ email: string; name: string; role: string } | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  // Checkout form state
  const [selectedEqId, setSelectedEqId] = useState<string>('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [checkoutDate, setCheckoutDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Layout View Modes: 'person' or 'equipment'
  const [distributionViewMode, setDistributionViewMode] = useState<'person' | 'equipment'>('person');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate suggestions lists for recipient names from historical assignments
  const suggestions = Array.from(
    new Set(assignments.map(asg => asg.user_name?.trim()).filter(Boolean))
  )
    .sort((a, b) => a.localeCompare(b))
    .filter(name => 
      name.toLowerCase().includes(userName.toLowerCase())
    );

  // Expandable layouts accordion state
  const [expandedPersons, setExpandedPersons] = useState<Record<string, boolean>>({});
  const [expandedPersonItems, setExpandedPersonItems] = useState<Record<string, boolean>>({});
  const [expandedEquipments, setExpandedEquipments] = useState<Record<string, boolean>>({});

  // Filter assignments with status 'Out'
  const activeCheckouts = assignments.filter(asg => asg.status === 'Out');

  // Dynamically find how many units are actually free for any equipment model based on physical dispatch
  const getDynamicAvailableSerials = (eq: Equipment) => {
    const activeCheckoutsForThis = activeCheckouts.filter(asg => asg?.equipment_id === eq?.id);
    const activeCheckedOutSerialList = activeCheckoutsForThis.map(a => a?.unit_id).filter(Boolean);
    return (eq?.unit_ids || []).filter(uid => !activeCheckedOutSerialList.includes(uid));
  };

  const availableItems = equipment;

  const handleEqChange = (idStr: string) => {
    setSelectedEqId(idStr);
    if (!idStr) {
      setSelectedUnitIds([]);
      return;
    }
    const item = equipment.find(eq => eq.id === parseInt(idStr, 10));
    const avails = item ? getDynamicAvailableSerials(item) : [];
    
    if (avails.length > 0) {
      setSelectedUnitIds([avails[0]]); // Pre-select first available one as helpful default
    } else {
      setSelectedUnitIds([]);
    }
  };

  const toggleUnitSelection = (unitId: string) => {
    if (selectedUnitIds.includes(unitId)) {
      setSelectedUnitIds(prev => prev.filter(uid => uid !== unitId));
    } else {
      setSelectedUnitIds(prev => [...prev, unitId]);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    setCheckoutSuccess(null);

    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor') {
      setCheckoutError('Unauthorized: Only Administrators and Supervisors can distribute equipment inventory.');
      return;
    }

    if (!selectedEqId) {
      setCheckoutError('Please select an equipment model to check out.');
      return;
    }

    if (!userName.trim()) {
      setCheckoutError('Please specify the receiving user name.');
      return;
    }

    if (selectedUnitIds.length === 0) {
      setCheckoutError('Please select at least one unit ID/serial badge to check out.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/assignments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: parseInt(selectedEqId, 10),
          user_name: userName.trim(),
          checkout_date: checkoutDate,
          unit_ids: selectedUnitIds
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout process failed.');
      }

      const assignedCount = data.assignments ? data.assignments.length : 1;
      const serialList = data.assignments ? data.assignments.map((a: any) => a.unit_id).join(', ') : '';

      setCheckoutSuccess(`✓ Successfully checked out ${assignedCount} units (${serialList}) to ${userName}!`);
      setUserName('');
      setSelectedEqId('');
      setSelectedUnitIds([]);
      onRefresh(); // Refresh parent lists
    } catch (err: any) {
      setCheckoutError(err.message || 'An error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handleReclaim = async (assignmentId: number, equipmentName: string) => {
    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor') {
      alert('Unauthorized: Only Administrators and Supervisors can reclaim checked-out items.');
      return;
    }

    try {
      const response = await fetch(`/api/assignments/reclaim/${assignmentId}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reclaim inventory');
      }

      onRefresh(); // Refresh parent lists to show instant stock updates
    } catch (err: any) {
      alert(`Error reclaiming stock: ${err.message}`);
    }
  };

  // Accordion Toggle Handlers
  const togglePerson = (personName: string) => {
    setExpandedPersons(prev => ({
      ...prev,
      [personName]: !prev[personName]
    }));
  };

  const togglePersonItem = (personName: string, eqName: string) => {
    const key = `${personName}_${eqName}`;
    setExpandedPersonItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleEquipment = (eqName: string) => {
    setExpandedEquipments(prev => ({
      ...prev,
      [eqName]: !prev[eqName]
    }));
  };

  // 1. Group active checkouts by person
  const peopleMap: Record<string, Assignment[]> = {};
  activeCheckouts.forEach(asg => {
    const name = asg.user_name?.trim() || 'Unknown Recipient';
    if (!peopleMap[name]) {
      peopleMap[name] = [];
    }
    peopleMap[name].push(asg);
  });

  // Filter list of people based on search
  const filteredPeopleNames = Object.keys(peopleMap).filter(name => {
    const q = searchQuery.toLowerCase();
    const nameMatch = name.toLowerCase().includes(q);
    const itemMatch = peopleMap[name].some(asg => 
      (asg.equipment_name || '').toLowerCase().includes(q) ||
      (asg.unit_id || '').toLowerCase().includes(q)
    );
    return nameMatch || itemMatch;
  }).sort((a, b) => a.localeCompare(b));

  // 2. Group active checkouts by equipment
  const eqMap: Record<string, Assignment[]> = {};
  activeCheckouts.forEach(asg => {
    const name = asg.equipment_name?.trim() || 'Unknown Equipment';
    if (!eqMap[name]) {
      eqMap[name] = [];
    }
    eqMap[name].push(asg);
  });

  // Filter list of equipment based on search
  const filteredEqNames = Object.keys(eqMap).filter(name => {
    const q = searchQuery.toLowerCase();
    const nameMatch = name.toLowerCase().includes(q);
    const recipientMatch = eqMap[name].some(asg => 
      asg.user_name.toLowerCase().includes(q) ||
      (asg.unit_id || '').toLowerCase().includes(q)
    );
    return nameMatch || recipientMatch;
  }).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6" id="distribution-verification-section">
      <div className="border-b pb-4 border-slate-850">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5 font-sans">
          <ClipboardList className="h-6 w-6 text-indigo-400" />
          Distribution & Nightly Verification Portal
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Perform multi-unit checkouts to distribute active equipment assets, and verify returns instantly through collapsible recipient arrays or device indexes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: MULTI-SELECT CHECK OUT FORM */}
        <div className="lg:col-span-12 lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          {currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 border-b border-slate-850 pb-4 font-mono">
                <Key className="h-5 w-5 text-slate-650" />
                Serial Dispatcher
              </h3>
              <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 text-center space-y-3">
                <Lock className="h-8 w-8 text-slate-650 mx-auto" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Access Restrained</p>
                <p className="text-[10px] text-slate-500 font-medium font-mono">
                  Only Admins and Supervisors are authorized to distribute equipment assets in this portal.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2 border-b border-slate-850 pb-4">
                <Key className="h-5 w-5" />
                Serial Dispatcher
              </h3>

              {availableItems.length === 0 ? (
            <div className="bg-amber-955/20 border border-amber-900/30 rounded-xl p-5 text-center">
              <p className="text-xs text-amber-500 font-medium leading-relaxed font-mono">
                ⚠️ No equipment units are currently in stock! Add more stock items in the Inventory tab or check in outstanding items to proceed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  Select Equipment Category
                </label>
                <select
                  value={selectedEqId}
                  onChange={(e) => handleEqChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 bg-none cursor-pointer hover:border-slate-700 transition-colors pointer-events-auto"
                  required
                >
                  <option value="" className="bg-slate-900">-- Choose equipment category --</option>
                  {availableItems.map(item => {
                    const avails = getDynamicAvailableSerials(item);
                    return (
                      <option 
                        key={item.id} 
                        value={item.id} 
                        className="bg-slate-900"
                        disabled={avails.length === 0}
                      >
                        {item.equipment_name} {avails.length === 0 ? "(OUT OF STOCK)" : `(${avails.length} available)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedEqId && (() => {
                const selectedItem = equipment.find(eq => eq.id === parseInt(selectedEqId, 10));
                const activeCheckoutsForThis = activeCheckouts.filter(asg => asg.equipment_id === selectedItem?.id);
                const activeCheckedOutSerialList = activeCheckoutsForThis.map(a => a.unit_id).filter(Boolean);
                const availableSerials = (selectedItem?.unit_ids || []).filter(
                  uid => !activeCheckedOutSerialList.includes(uid)
                );

                return (
                  <div className="space-y-3 animate-fade-in bg-slate-950/40 border border-slate-800/85 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                        Select Serials / Unit IDs
                      </label>
                      <span className="text-[10px] text-indigo-400 font-bold font-mono bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        {selectedUnitIds.length} of {availableSerials.length} selected
                      </span>
                    </div>

                    {availableSerials.length === 0 ? (
                      <p className="text-xs text-red-400 leading-normal bg-red-955/20 border border-red-900/30 p-3 rounded-lg">
                        All serial markers for this category have already been checked out.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedUnitIds(availableSerials)}
                            className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2.5 py-1 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition-colors cursor-pointer"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedUnitIds([])}
                            className="text-[10px] uppercase font-bold text-slate-400 hover:text-white px-2.5 py-1 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 text-xs">
                          {availableSerials.map((serial) => {
                            const isSelected = selectedUnitIds.includes(serial);
                            return (
                              <button
                                key={serial}
                                type="button"
                                onClick={() => toggleUnitSelection(serial)}
                                className={`flex items-center justify-between p-2 md:p-2.5 rounded-lg text-[10px] md:text-xs font-mono transition-all border text-left cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow shadow-emerald-950/30 font-bold'
                                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                }`}
                              >
                                <span className="break-all whitespace-normal pr-1 flex-1 leading-tight">{serial}</span>
                                {isSelected ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 ml-1" />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 ml-1" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  Recipient Name / User
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <User className="h-4 w-4 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => {
                      setUserName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="e.g. Katherine Johnson"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-505 hover:border-slate-750 transition-colors"
                    required
                    autoComplete="off"
                  />

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl divide-y divide-slate-900">
                      {suggestions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={() => {
                            setUserName(name);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-850 hover:text-white transition-colors flex items-center gap-2 cursor-pointer font-sans"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                  Dispatch Date
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-500" />
                  </span>
                  <input
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 [color-scheme:dark] hover:border-slate-750 transition-colors"
                    required
                  />
                </div>
              </div>

              {checkoutError && (
                <div className="flex gap-2 items-start bg-red-955/40 text-red-400 px-3 py-2.5 border border-red-900/30 rounded-lg text-xs leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {checkoutSuccess && (
                <div className="flex gap-2 items-start bg-emerald-955/40 text-emerald-400 px-3 py-2.5 border border-emerald-900/30 rounded-lg text-xs leading-relaxed animate-fade-in font-sans">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{checkoutSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !selectedEqId || selectedUnitIds.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40 font-mono text-xs uppercase tracking-wider"
              >
                {loading ? 'Processing Dispatch...' : `Confirm Dispatch (${selectedUnitIds.length} Unit${selectedUnitIds.length === 1 ? '' : 's'})`}
              </button>
            </form>
          )}
          </>
          )}
        </div>

        {/* RIGHT COLUMN: DISTRIBUTION INTERACTIVE PRESENTER */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-4 gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Moon className="h-5 w-5 text-indigo-400" />
                Durable Verification Portal
              </h3>
              <p className="text-xs text-slate-400">
                Show live field handouts and verify nightly returns.
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-lg p-1 shrink-0">
              <button
                type="button"
                onClick={() => setDistributionViewMode('person')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  distributionViewMode === 'person'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                By Person
              </button>
              <button
                type="button"
                onClick={() => setDistributionViewMode('equipment')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  distributionViewMode === 'equipment'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                By Inventory
              </button>
            </div>
          </div>

          {/* ACTIVE QUEUE DISPLAY CARDS */}
          {activeCheckouts.length === 0 ? (
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-10 text-center flex flex-col items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
              <p className="text-sm text-slate-100 font-bold mb-1">Stock Securely Aligned!</p>
              <p className="text-xs text-slate-400 leading-normal max-w-sm">
                No physical devices are flagged as out in the field. All inventories have been accounted for and safely returned!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dynamic Query Filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    distributionViewMode === 'person'
                      ? "Search recipient names, models, or unit serials..."
                      : "Search equipment names, recipients, or serials..."
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-505"
                />
              </div>

              {/* RENDER VIEW: PERSONS MODE */}
              {distributionViewMode === 'person' && (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {filteredPeopleNames.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                      No matching user records are currently holding equipment.
                    </div>
                  ) : (
                    filteredPeopleNames.map(personName => {
                      const userAssignments = peopleMap[personName];
                      const isExpanded = !!expandedPersons[personName];

                      // Group individual items held by model name
                      const itemSubGroups: Record<string, Assignment[]> = {};
                      userAssignments.forEach(asg => {
                        const eqTitle = asg.equipment_name || 'Unknown Item';
                        if (!itemSubGroups[eqTitle]) {
                          itemSubGroups[eqTitle] = [];
                        }
                        itemSubGroups[eqTitle].push(asg);
                      });

                      return (
                        <div key={personName} className="bg-slate-950/25 border border-slate-800/80 rounded-xl overflow-hidden transition-all hover:border-slate-750">
                          {/* COLLAPSIBLE INDIVIDUAL HEADER CARD */}
                          <button
                            type="button"
                            onClick={() => togglePerson(personName)}
                            className="w-full flex items-center justify-between px-4.5 py-3.5 hover:bg-slate-900/40 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 pr-2 truncate">
                              <div className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0 font-mono">
                                {personName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-slate-200 truncate">{personName}</h4>
                                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                                  Holding {userAssignments.length} device{userAssignments.length === 1 ? '' : 's'} total
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-[9px] bg-indigo-950 border border-indigo-550/30 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full font-mono">
                                {userAssignments.length} Unit{userAssignments.length === 1 ? '' : 's'}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* NESTED CONTENT LEVEL 2 (Grouped names of assets) */}
                          {isExpanded && (
                            <div className="px-4.5 pb-4 pt-1 border-t border-slate-850/60 bg-slate-950/25 space-y-3">
                              <span className="text-[9px] uppercase tracking-widest font-black text-slate-500 font-mono block">
                                Grouped Item Inventory
                              </span>

                              <div className="space-y-2">
                                {Object.keys(itemSubGroups).sort().map(eqName => {
                                  const subUnits = itemSubGroups[eqName];
                                  const accordionKey = `${personName}_${eqName}`;
                                  const isSubItemExpanded = !!expandedPersonItems[accordionKey];

                                  return (
                                    <div key={eqName} className="border border-slate-850 bg-slate-900/40 rounded-lg overflow-hidden">
                                      {/* Sub Header (e.g. Cables - 10 items) */}
                                      <button
                                        type="button"
                                        onClick={() => togglePersonItem(personName, eqName)}
                                        className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-slate-900/70 transition-colors text-left text-xs cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2 select-none">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span className="text-slate-300 font-bold">{eqName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                            {subUnits.length} item{subUnits.length === 1 ? '' : 's'}
                                          </span>
                                          {isSubItemExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                          )}
                                        </div>
                                      </button>

                                      {/* LEVEL 3 EXPANSION: Show actual serial markers with individual return buttons */}
                                      {isSubItemExpanded && (
                                        <div className="px-3.5 py-3 bg-slate-950/70 border-t border-slate-850/60 space-y-2 animate-fade-in text-[11px]">
                                          <div className="grid grid-cols-1 gap-1.5">
                                            {subUnits.map(asg => (
                                              <div key={asg.assignment_id} className="flex items-center justify-between bg-slate-900/80 border border-slate-850 p-2 rounded-lg hover:border-slate-800 transition-colors">
                                                <div className="space-y-0.5 min-w-0 pr-2">
                                                  <span className="px-2 py-0.5 text-[9px] font-mono font-black rounded bg-indigo-950 border border-indigo-500/20 text-indigo-300">
                                                    {asg.unit_id || 'N/A'}
                                                  </span>
                                                  <div className="text-[9px] text-slate-500 font-mono">
                                                    Out since {asg.checkout_date}
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  disabled={currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor'}
                                                  onClick={() => handleReclaim(asg.assignment_id, eqName)}
                                                  className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 rounded ${
                                                    (currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor')
                                                      ? 'bg-slate-950 hover:bg-red-950/40 text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-900/50 cursor-pointer'
                                                      : 'bg-slate-950/40 text-slate-650 border border-slate-900 cursor-not-allowed opacity-50'
                                                  }`}
                                                  title={currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor' ? 'Required Administrator or Supervisor privileges to reclaim' : 'Reclaim this item'}
                                                >
                                                  <RefreshCw className="h-3 w-3" />
                                                  Reclaim
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* RENDER VIEW: EQUIPMENT / INVENTORY MODE */}
              {distributionViewMode === 'equipment' && (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {filteredEqNames.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                      No matching equipment catalog has active field checkouts.
                    </div>
                  ) : (
                    filteredEqNames.map(eqName => {
                      const modelAssignments = eqMap[eqName];
                      const isExpanded = !!expandedEquipments[eqName];

                      return (
                        <div key={eqName} className="bg-slate-950/25 border border-slate-800/80 rounded-xl overflow-hidden transition-all hover:border-slate-750">
                          {/* CLICKABLE EQUIPMENT HEADER BLOCK */}
                          <button
                            type="button"
                            onClick={() => toggleEquipment(eqName)}
                            className="w-full flex items-center justify-between px-4.5 py-3.5 hover:bg-slate-900/40 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 pr-2 truncate">
                              <div className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-550/30 flex items-center justify-center font-bold text-xs text-emerald-300 shrink-0 font-mono">
                                EQ
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-slate-200 truncate">{eqName}</h4>
                                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                                  {modelAssignments.length} marker{modelAssignments.length === 1 ? '' : 's'} on active duty
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-[9px] bg-emerald-955/40 border border-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full font-mono">
                                {modelAssignments.length} Out
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* DETAILED EXPANDED GRID: Show which serial is with whom */}
                          {isExpanded && (
                            <div className="px-4.5 pb-4 pt-1 border-t border-slate-850/60 bg-slate-950/20 space-y-3">
                              <span className="text-[9px] uppercase tracking-widest font-black text-slate-500 font-mono block">
                                Serial Unit Allocations
                              </span>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {modelAssignments.map(asg => (
                                  <div key={asg.assignment_id} className="bg-slate-900/80 border border-slate-850 p-3 rounded-lg flex flex-col justify-between gap-3 hover:border-slate-800 transition-colors text-xs">
                                    <div className="space-y-1.5 min-w-0">
                                      <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-850">
                                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-black bg-indigo-950 border border-indigo-500/20 text-indigo-300 rounded">
                                          {asg.unit_id || 'N/A'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-mono font-bold">Record ID: #{asg.assignment_id}</span>
                                      </div>
                                      <div className="truncate">
                                        <span className="text-slate-450 text-[10px]">Recipient:</span>{' '}
                                        <strong className="text-slate-205 font-bold font-sans text-xs">{asg.user_name}</strong>
                                      </div>
                                      <div className="text-[9px] text-slate-500 font-mono">
                                        Issued date: {asg.checkout_date}
                                      </div>
                                    </div>
                                    
                                    <button
                                      type="button"
                                      disabled={currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor'}
                                      onClick={() => handleReclaim(asg.assignment_id, eqName)}
                                      className={`w-full py-1.5 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 rounded ${
                                        (currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor')
                                          ? 'bg-slate-950 hover:bg-red-950/40 text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-900/40 cursor-pointer'
                                          : 'bg-slate-950/40 text-slate-650 border border-slate-900 cursor-not-allowed opacity-50'
                                      }`}
                                      title={currentUser?.role !== 'Admin' && currentUser?.role !== 'Supervisor' ? 'Required Administrator or Supervisor privileges to reclaim' : 'Reclaim dispatch'}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      Reclaim Dispatch
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
