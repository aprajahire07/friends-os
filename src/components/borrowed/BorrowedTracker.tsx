import React, { useState, useMemo } from 'react';
import { 
  Backpack, 
  Plus, 
  CheckCircle2, 
  History, 
  Clock, 
  Filter, 
  Search, 
  Calendar, 
  User, 
  Info,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { BorrowedItem } from '../../types';
import { AddBorrowedItemModal } from './AddBorrowedItemModal';
import { BorrowedDetailModal } from './BorrowedDetailModal';
import { useToast } from '../ui/Toast';

export const BorrowedTracker: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BorrowedItem | null>(null);

  // History & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'returned' | 'borrowed' | 'overdue'>('all');
  const [selectedDirection, setSelectedDirection] = useState<'all' | 'borrowed_by_me' | 'lent_by_me'>('all');

  const allItems = store.borrowed;
  const currentItems = allItems.filter(b => b.status === 'borrowed');
  const returnedItems = allItems.filter(b => b.status === 'returned');

  const handleReturnItem = (itemId: string, itemName: string) => {
    appStore.markItemReturned(itemId);
    showToast('Marked Returned 🎒', `Returned "${itemName}"! Moved to Borrowed History.`, 'success');
  };

  const isOverdue = (dueDateStr: string) => {
    try {
      const due = new Date(dueDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return due < today;
    } catch {
      return false;
    }
  };

  // Filtered History List
  const filteredHistory = useMemo(() => {
    return allItems.filter(item => {
      const isOwner = item.owner_id === currentUser.id;
      const isBorrower = item.borrower_id === currentUser.id;
      const otherProfile = appStore.profiles.find(
        p => p.id === (isOwner ? item.borrower_id : item.owner_id)
      );
      const itemOverdue = item.status === 'borrowed' && isOverdue(item.expected_return_date);

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.item_name.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchOther = otherProfile?.full_name.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchOther) return false;
      }

      // Friend Filter
      if (selectedFriend !== 'all') {
        if (item.owner_id !== selectedFriend && item.borrower_id !== selectedFriend) {
          return false;
        }
      }

      // Date Filters (using borrowed_date or created_at)
      const dateObj = new Date(item.borrowed_date || item.created_at);
      const monthStr = String(dateObj.getMonth() + 1);
      const yearStr = String(dateObj.getFullYear());

      if (selectedMonth !== 'all' && monthStr !== selectedMonth) return false;
      if (selectedYear !== 'all' && yearStr !== selectedYear) return false;

      // Status Filter
      if (selectedStatus === 'returned' && item.status !== 'returned') return false;
      if (selectedStatus === 'borrowed' && item.status !== 'borrowed') return false;
      if (selectedStatus === 'overdue' && !itemOverdue) return false;

      // Direction Filter
      if (selectedDirection === 'borrowed_by_me' && !isBorrower) return false;
      if (selectedDirection === 'lent_by_me' && !isOwner) return false;

      return true;
    });
  }, [allItems, currentUser.id, searchQuery, selectedFriend, selectedMonth, selectedYear, selectedStatus, selectedDirection]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalReturned = allItems.filter(i => i.status === 'returned').length;
    const totalBorrowedByMe = allItems.filter(i => i.borrower_id === currentUser.id && i.status === 'borrowed').length;
    const totalLentByMe = allItems.filter(i => i.owner_id === currentUser.id && i.status === 'borrowed').length;

    return { totalReturned, totalBorrowedByMe, totalLentByMe };
  }, [allItems, currentUser.id]);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Backpack className="w-5 h-5 text-indigo-400" />
            <span>Borrowed Items 🎒</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Keep track of items you or your friends borrowed, due dates, and return history.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Add Item</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'current'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Currently Borrowed ({currentItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Complete History ({allItems.length})</span>
        </button>
      </div>

      {/* ==================== CURRENT VIEW ==================== */}
      {activeTab === 'current' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {currentItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-3">
              <p className="text-sm font-bold text-white">Nothing currently borrowed 🎒</p>
              <p className="text-slate-400">All items are returned! Check History for past borrowings.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-500 transition-all"
              >
                Add Borrowed Item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentItems.map(item => {
                const isOwner = item.owner_id === currentUser.id;
                const owner = appStore.profiles.find(p => p.id === item.owner_id);
                const borrower = appStore.profiles.find(p => p.id === item.borrower_id);
                const overdue = isOverdue(item.expected_return_date);

                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900 border rounded-2xl p-4 text-slate-100 flex items-center justify-between gap-3 shadow-lg transition-colors ${
                      overdue ? 'border-rose-800/80 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div 
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer flex-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎒</span>
                        <h3 className="font-bold text-xs text-white">
                          {isOwner ? (
                            <>
                              <span className="text-amber-400">{borrower?.full_name.split(' ')[0]}</span> borrowed your{' '}
                              <span className="text-indigo-300">{item.item_name}</span>
                            </>
                          ) : (
                            <>
                              You borrowed <span className="text-emerald-300">{owner?.full_name.split(' ')[0]}'s</span>{' '}
                              <span className="text-indigo-300">{item.item_name}</span>
                            </>
                          )}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className={overdue ? 'text-rose-400 font-bold flex items-center gap-0.5' : 'text-amber-400 font-semibold'}>
                          {overdue && <AlertTriangle className="w-3 h-3" />}
                          Due: {formatDateDisplay(item.expected_return_date)} {overdue && '(Overdue!)'}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">
                          Borrowed: {formatDateDisplay(item.borrowed_date || item.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                        title="View Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleReturnItem(item.id, item.item_name)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Returned</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== HISTORY VIEW ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Returned Items</span>
              </p>
              <p className="text-lg font-black text-emerald-400">{summaryMetrics.totalReturned}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-indigo-400" />
                <span>You Borrowed</span>
              </p>
              <p className="text-lg font-black text-indigo-400">{summaryMetrics.totalBorrowedByMe}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-amber-400" />
                <span>You Lent Out</span>
              </p>
              <p className="text-lg font-black text-amber-400">{summaryMetrics.totalLentByMe}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Filter & Search Borrowed History</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search item name, friend, description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {/* Friend */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Friend</label>
                <select
                  value={selectedFriend}
                  onChange={e => setSelectedFriend(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Friends</option>
                  {appStore.profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.id === currentUser.id && '(You)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as any)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="returned">Returned ✓</option>
                  <option value="borrowed">Currently Borrowed</option>
                  <option value="overdue">Overdue ⚠️</option>
                </select>
              </div>

              {/* Direction */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Borrow Direction</label>
                <select
                  value={selectedDirection}
                  onChange={e => setSelectedDirection(e.target.value as any)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Items</option>
                  <option value="borrowed_by_me">Items I Borrowed</option>
                  <option value="lent_by_me">Items I Lent / Gave</option>
                </select>
              </div>
            </div>
          </div>

          {/* History List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Historical Records ({filteredHistory.length})
              </h3>
              {(searchQuery || selectedFriend !== 'all' || selectedStatus !== 'all' || selectedDirection !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFriend('all');
                    setSelectedMonth('all');
                    setSelectedYear('all');
                    setSelectedStatus('all');
                    setSelectedDirection('all');
                  }}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs">
                No matching borrowed items found with current filters.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredHistory.map(item => {
                  const isOwner = item.owner_id === currentUser.id;
                  const owner = appStore.profiles.find(p => p.id === item.owner_id);
                  const borrower = appStore.profiles.find(p => p.id === item.borrower_id);
                  const isReturned = item.status === 'returned';
                  const overdue = item.status === 'borrowed' && isOverdue(item.expected_return_date);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow hover:border-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          isReturned ? 'bg-emerald-400' : overdue ? 'bg-rose-400' : 'bg-indigo-400'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🎒</span>
                            <h4 className="text-xs font-bold text-white">
                              {isReturned ? (
                                <span className="text-emerald-400">
                                  {isOwner 
                                    ? `🟢 ${borrower?.full_name.split(' ')[0]} returned ${item.item_name}`
                                    : `🟢 You returned ${owner?.full_name.split(' ')[0]}'s ${item.item_name}`
                                  }
                                </span>
                              ) : (
                                <span className="text-white">
                                  {isOwner 
                                    ? `${borrower?.full_name.split(' ')[0]} has your ${item.item_name}`
                                    : `You have ${owner?.full_name.split(' ')[0]}'s ${item.item_name}`
                                  }
                                </span>
                              )}
                            </h4>
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>Borrowed: {formatDateDisplay(item.borrowed_date || item.created_at)}</span>
                            {isReturned && (item.returned_at || item.expected_return_date) && (
                              <span className="text-emerald-400 font-semibold">
                                • Returned: {formatDateDisplay(item.returned_at || item.expected_return_date)}
                              </span>
                            )}
                            {!isReturned && (
                              <span className={overdue ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                                • Due: {formatDateDisplay(item.expected_return_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                          isReturned 
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' 
                            : overdue
                            ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                            : 'bg-indigo-950/60 border-indigo-800 text-indigo-400'
                        }`}>
                          {isReturned ? '✓ Returned' : overdue ? '⚠️ Overdue' : 'Borrowed'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Borrowed Detail Modal */}
      <BorrowedDetailModal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />

      <AddBorrowedItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
