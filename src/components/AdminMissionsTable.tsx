import React, { useState } from 'react';
import { Mission } from '../types';
import { Plus, Search, SortAsc, SortDesc } from 'lucide-react';
import { Button } from './Layout';
import { AdminMissionRow } from './AdminMissionRow';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function AdminMissionsTable({ missions, onRefresh }: { missions: Mission[], onRefresh: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Mission | 'reward.type' | 'reward.amount'; direction: 'asc' | 'desc' } | null>(null);

  const handleCreateMission = async () => {
    const newMission: Mission = {
      id: `mission-${Date.now()}`,
      title: 'Nouvelle Mission',
      description: 'Description...',
      type: 'duel_count',
      target: 1,
      reward: { type: 'money', amount: 100 },
      isActive: true,
      period: 'daily'
    };
    try {
      await setDoc(doc(db, 'missions', newMission.id), newMission);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missions', id));
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSort = (key: keyof Mission | 'reward.type' | 'reward.amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedMissions = React.useMemo(() => {
    let sortableItems = [...missions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Mission];
        let bValue: any = b[sortConfig.key as keyof Mission];

        if (sortConfig.key === 'reward.type') {
            aValue = a.reward?.type || '';
            bValue = b.reward?.type || '';
        } else if (sortConfig.key === 'reward.amount') {
            aValue = a.reward?.amount || 0;
            bValue = b.reward?.amount || 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [missions, sortConfig]);

  const filteredMissions = sortedMissions.filter(m => 
    (m.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(searchTerm.toLowerCase())
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
              placeholder="Rechercher une mission (Titre, ID, Desc)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="text-sm font-bold text-gray-400">
            {filteredMissions.length} {filteredMissions.length > 1 ? 'Missions' : 'Mission'}
          </div>
        </div>
        <Button onClick={handleCreateMission} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Créer une Mission
        </Button>
      </div>

      <div className="bg-black/50 border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="text-xs uppercase bg-gray-900/80 text-gray-400 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                Titre & ID <SortIcon columnKey="title" />
              </th>
              <th className="px-4 py-3 font-medium">
                 Description
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('type')}>
                Details <SortIcon columnKey="type" />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('conditionType')}>
                Conditions <SortIcon columnKey="conditionType" />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('reward.type')}>
                Récompenses <SortIcon columnKey="reward.type" />
              </th>
              <th className="px-4 py-3 font-medium text-center sticky right-0 bg-gray-900/90 shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucune mission trouvée.
                </td>
              </tr>
            ) : (
              filteredMissions.map((mission) => (
                <AdminMissionRow
                  key={mission.id}
                  mission={mission}
                  onSaved={onRefresh}
                  onDeleted={() => handleDelete(mission.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
