const fs = require('fs');

let code = fs.readFileSync('src/components/AdminZone.tsx', 'utf8');

// 1. Add leagueActivationPrompt state
const stateMarker = `const [leagueSort, setLeagueSort] = useState<{column: string, direction: 'asc'|'desc'}>({column: 'id', direction: 'asc'});`;
if (code.includes(stateMarker) && !code.includes('leagueActivationPrompt')) {
    code = code.replace(stateMarker, 
        stateMarker + '\n  const [leagueActivationPrompt, setLeagueActivationPrompt] = useState<{ id: number, name: string } | null>(null);'
    );
}

// 2. Add handleDisableAllLeagues just before handleActivateOngoingLeagues
const activateFuncMarker = `const handleActivateOngoingLeagues = async () => {`;
if (code.includes(activateFuncMarker) && !code.includes('handleDisableAllLeagues')) {
    code = code.replace(activateFuncMarker, 
`  const handleDisableAllLeagues = async () => {
    if (!window.confirm("Voulez-vous vraiment désactiver toutes les compétitions ?")) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'Désactivation de toutes les compétitions...' });
    try {
      let batch = writeBatch(db);
      let opsCount = 0;
      const newLeagues = [...leagues];
      
      for (let i = 0; i < leagues.length; i++) {
        if (!leagues[i].league.isActive) continue;
        const leagueRef = doc(db, 'leagues', leagues[i].league.id.toString());
        batch.set(leagueRef, { isActive: false }, { merge: true });
        newLeagues[i] = { ...newLeagues[i], league: { ...newLeagues[i].league, isActive: false } };
        opsCount++;
        
        if (opsCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opsCount = 0;
        }
      }
      
      if (opsCount > 0) {
        await batch.commit();
      }
      
      setLeagues(newLeagues);
      setStatus({ type: 'success', message: 'Toutes les compétitions ont été désactivées.' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Erreur.' });
    } finally {
      setLoading(false);
    }
  };

  ` + activateFuncMarker);
}

// 3. Replace handleToggleCompetition
const toggleStart = code.lastIndexOf(`const handleToggleCompetition = async `);
const toggleEnd = code.indexOf(`const handleSortAndFilter = () => {`, toggleStart);
if (toggleStart !== -1 && toggleEnd !== -1) {
    code = code.slice(0, toggleStart) +
`const handleToggleCompetition = async (leagueId: number, currentStatus: boolean, leagueName: string) => {
    if (!currentStatus) {
      // Trying to activate -> open modal instead
      setLeagueActivationPrompt({ id: leagueId, name: leagueName });
      return;
    }
    // Deactivating
    handleConfirmLeagueActivation(leagueId, leagueName, false, 'none');
  };

  const handleConfirmLeagueActivation = async (leagueId: number, leagueName: string, newStatus: boolean, createType: 'mission' | 'pass' | 'none') => {
    setLeagueActivationPrompt(null);
    setLoading(true);
    setStatus({ type: 'info', message: \`\${newStatus ? 'Activation' : 'Désactivation'} de la compétition \${leagueName}...\` });
    try {
      const leagueRef = doc(db, 'leagues', leagueId.toString());
      await setDoc(leagueRef, { isActive: newStatus }, { merge: true });
      
      setLeagues(prev => prev.map(l => {
        if (l.league.id === leagueId) {
          return { ...l, league: { ...l.league, isActive: newStatus } };
        }
        return l;
      }));

      setStatus({ type: 'success', message: \`Compétition \${leagueId} \${newStatus ? 'activée' : 'désactivée'}.\` });
      
      if (newStatus) {
         if (createType === 'mission') {
           setActiveTab('users');
           setActiveUserSubTab('missions');
           setEditingMission({
             id: \`mission-\${Date.now()}\`,
             title: \`Jouer dans \${leagueName}\`,
             description: \`Fais 1 duel dans la compétition: \${leagueName}\`,
             type: 'duel_count',
             target: 1,
             reward: { type: 'money', amount: 100 },
             isActive: true,
             period: 'daily',
             conditionType: 'league',
             conditionValue: leagueId.toString(),
           });
         } else if (createType === 'pass') {
           setActiveTab('users');
           setActiveUserSubTab('passes');
           setEditingPass({
             id: \`pass-\${Date.now()}\`,
             name: \`Pass \${leagueName}\`,
             description: \`Gagne des points sur les matchs de \${leagueName}...\`,
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
             isActive: true,
             conditionType: 'league',
             conditionValue: leagueId.toString(),
           });
         }
      }

    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Erreur lors du changement de statut.' });
    } finally {
      setLoading(false);
    }
  };

  ` + code.slice(toggleEnd);
}

// 4. Update the render: add button and modal
const disableAllButtonJSX = `
          <Button
            onClick={handleDisableAllLeagues}
            disabled={loading}
            className="flex items-center gap-2"
            variant="outline"
          >
            Désactiver toutes
          </Button>`;
          
const activeAllBtn = `<Button
            onClick={handleActivateOngoingLeagues}`;
if (code.includes(activeAllBtn) && !code.includes('handleDisableAllLeagues}')) {
    code = code.replace(activeAllBtn, disableAllButtonJSX + "\n          " + activeAllBtn);
}

// Add Modal
const modalJSX = `
      {leagueActivationPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <Card className="p-6 max-w-md w-full bg-gray-900 border-white/10 shadow-2xl relative space-y-6">
            <h3 className="text-xl font-bold">Activer la compétition</h3>
            <p className="text-gray-400">
              Vous êtes sur le point d'activer <strong className="text-white">{leagueActivationPrompt.name}</strong>. Que souhaitez-vous créer avec cette compétition ?
            </p>
            <div className="space-y-3">
              <Button className="w-full text-left justify-start font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'mission')}>
                Créer une nouvelle MISSION liée
              </Button>
              <Button className="w-full text-left justify-start font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'pass')}>
                Créer un nouveau PASS lié
              </Button>
              <Button className="w-full text-left justify-start bg-gray-800 hover:bg-gray-700 text-white border-transparent" variant="outline" onClick={() => handleConfirmLeagueActivation(leagueActivationPrompt.id, leagueActivationPrompt.name, true, 'none')}>
                Rien, juste rendre visible
              </Button>
            </div>
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button variant="outline" onClick={() => setLeagueActivationPrompt(null)}>Annuler</Button>
            </div>
          </Card>
        </div>
      )}
`;
const footballTabMarker = `{activeTab === 'football' && (\n      <Card className="p-6 space-y-6">`;
if (code.includes(footballTabMarker)) {
    code = code.replace(footballTabMarker, modalJSX + footballTabMarker);
}

fs.writeFileSync('src/components/AdminZone.tsx', code);
