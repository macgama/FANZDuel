import React, { useState } from 'react';
import { Pass } from '../types';
import { Plus, Search, SortAsc, SortDesc } from 'lucide-react';
import { Button } from './Layout';
import { AdminPassRow } from './AdminPassRow';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function AdminPassesTable({ passes, onRefresh, onEditFull }: { passes: Pass[], onRefresh: () => void, onEditFull: (pass: Pass) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Pass; direction: 'asc' | 'desc' } | null>(null);

  const handleCreatePass = async () => {
    const newPass: Pass = {
      id: `pass-${Date.now()}`,
      name: 'Nouveau Pass',
      description: 'Description...',
      priceGems: 500,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      premiumPrice: { gems: 500 },
      levels: Array.from({ length: 5 }, (_, i) => ({
        level: i + 1,
        pointsRequired: (i + 1) * 100,
        freeReward: { type: 'money', amount: 50 },
        premiumReward: { type: 'gems', amount: 20 }
      })),
      isActive: true
    };
    try {
      await setDoc(doc(db, 'passes', newPass.id), newPass);
      onRefresh();
      onEditFull(newPass); // Open directly for levels editing
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'passes', id));
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSort = (key: keyof Pass) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPasses = React.useMemo(() => {
    let sortableItems = [...passes];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'levels') {
            aValue = (a.levels || []).length;
            bValue = (b.levels || []).length;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [passes, sortConfig]);

  const filteredPasses = sortedPasses.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <SortAsc className="w-3 h-3 ml-1 inline" /> : <SortDesc className="w-3 h-3 ml-1 inline" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-gray-900/50 p-4 rounded-xl border border-white/5">
        <div className="flex-1 flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un pass (Nom, ID, Desc)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="text-sm font-bold text-gray-400">
            {filteredPasses.length} {filteredPasses.length > 1 ? 'Pass' : 'Pass'}
          </div>
        </div>
        <Button onClick={handleCreatePass} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Créer un Pass
        </Button>
      </div>

      <div className="bg-black/50 border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="text-xs uppercase bg-gray-900/80 text-gray-400 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                Nom & ID <SortIcon columnKey="name" />
              </th>
              <th className="px-4 py-3 font-medium">
                 Description
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('startDate')}>
                Dates & Statut <SortIcon columnKey="startDate" />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('conditionType')}>
                Conditions <SortIcon columnKey="conditionType" />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('premiumPrice')}>
                Prix <SortIcon columnKey="premiumPrice" />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('levels')}>
                Niveaux <SortIcon columnKey="levels" />
              </th>
              <th className="px-4 py-3 font-medium text-center sticky right-0 bg-gray-900/90 shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPasses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Aucun pass trouvé.
                </td>
              </tr>
            ) : (
              filteredPasses.map((pass) => (
                <AdminPassRow
                  key={pass.id}
                  pass={pass}
                  onSaved={onRefresh}
                  onDeleted={() => handleDelete(pass.id)}
                  onEditFull={onEditFull}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
