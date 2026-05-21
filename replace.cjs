const fs = require('fs');
let code = fs.readFileSync('src/components/AdminZone.tsx', 'utf8');

// Also inject imports
if (!code.includes('AdminMissionsTable')) {
    code = code.replace(
        "import { AdminDuelCardRow } from './AdminDuelCardRow';",
        "import { AdminDuelCardRow } from './AdminDuelCardRow';\nimport { AdminMissionsTable } from './AdminMissionsTable';\nimport { AdminPassesTable } from './AdminPassesTable';"
    );
}

// Replace missions
const missionStart = code.indexOf(`          {activeUserSubTab === 'missions' && (`);
const passesStart = code.indexOf(`          {activeUserSubTab === 'passes' && (`);

if (missionStart !== -1 && passesStart !== -1) {
    code = code.substring(0, missionStart) +
`          {activeUserSubTab === 'missions' && (
            <AdminMissionsTable 
              missions={missions} 
              onRefresh={fetchMissions} 
            />
          )}

` + code.substring(passesStart);
}

// Replace passes
const duelConfigStart = code.indexOf(`      {activeTab === 'duelConfig' && duelConfig && (`);
const pStart = code.indexOf(`          {activeUserSubTab === 'passes' && (`);

if (pStart !== -1 && duelConfigStart !== -1) {
    code = code.substring(0, pStart) +
`          {activeUserSubTab === 'passes' && (
            <div className="space-y-6">
              {editingPass && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <Card className="p-6 relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-gray-900 border-white/10 shadow-2xl">
                      <Button variant="outline" size="sm" className="absolute top-4 right-4" onClick={() => setEditingPass(null)}>Fermer</Button>
                      <h3 className="text-xl font-bold mb-4">Éditer les niveaux : {editingPass.name}</h3>
                      <form onSubmit={(e) => { e.preventDefault(); handleSavePass(e as any); }} className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="font-bold text-sm border-b border-gray-800 pb-2 text-white">Niveaux & Récompenses</h4>
                          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {(editingPass.levels || []).map((lvl, idx) => (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr_auto] gap-4 items-end p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">NIVEAU {lvl.level}</label>
                                  <input
                                    type="number"
                                    value={lvl.pointsRequired}
                                    onChange={e => {
                                      const newLevels = [...(editingPass.levels || [])];
                                      newLevels[idx] = { ...lvl, pointsRequired: Number(e.target.value) };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    className="w-full p-2 bg-black text-white rounded border border-gray-600 text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">RECOMPENSE GRATUITE</label>
                                  <RewardSelector
                                    reward={lvl.freeReward}
                                    onChange={reward => {
                                      const newLevels = [...editingPass.levels];
                                      newLevels[idx] = { ...lvl, freeReward: reward };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    fanzTemplates={fanzTemplates}
                                    lifeActions={lifeActions}
                                    duelCards={duelCards}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500">RECOMPENSE PREMIUM</label>
                                  <RewardSelector
                                    reward={lvl.premiumReward}
                                    onChange={reward => {
                                      const newLevels = [...editingPass.levels];
                                      newLevels[idx] = { ...lvl, premiumReward: reward };
                                      setEditingPass({ ...editingPass, levels: newLevels });
                                    }}
                                    fanzTemplates={fanzTemplates}
                                    lifeActions={lifeActions}
                                    duelCards={duelCards}
                                  />
                                </div>
                                <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-900 hover:bg-red-900/30 hover:text-white" onClick={() => {
                                  let newLevels = (editingPass.levels || []).filter((_, i) => i !== idx);
                                  newLevels = newLevels.map((l, i) => ({ ...l, level: i + 1 }));
                                  setEditingPass({ ...editingPass, levels: newLevels });
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                              let nextLevelNum = 1;
                              if ((editingPass.levels || []).length > 0) {
                                nextLevelNum = Math.max(...(editingPass.levels || []).map(l => l.level)) + 1;
                              }
                              const lastPoints = (editingPass.levels || [])[(editingPass.levels || []).length - 1]?.pointsRequired || 0;
                              setEditingPass({
                                ...editingPass,
                                levels: [...(editingPass.levels || []), {
                                  level: nextLevelNum,
                                  pointsRequired: lastPoints + 100,
                                  freeReward: { type: 'money', amount: 50 },
                                  premiumReward: { type: 'gems', amount: 20 }
                                }]
                              });
                            }}>
                              <Plus className="w-4 h-4 mr-2" /> Ajouter un Niveau
                            </Button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                          <Button type="button" variant="outline" onClick={() => setEditingPass(null)}>Annuler</Button>
                          <Button type="submit">Sauvegarder les Niveaux</Button>
                        </div>
                      </form>
                    </Card>
                </div>
              )}

              <AdminPassesTable 
                passes={passes} 
                onRefresh={fetchPasses} 
                onEditFull={setEditingPass}
              />
            </div>
          )}

` + code.substring(duelConfigStart);
}

fs.writeFileSync('src/components/AdminZone.tsx', code);
