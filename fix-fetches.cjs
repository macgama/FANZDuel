const fs = require('fs');
const files = [
  'src/components/MatchesPage.tsx',
  'src/components/TeamDetails.tsx',
  'src/components/LeagueDetails.tsx',
  'src/components/MatchDetails.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const res = await fetch\('([a-zA-Z0-9\/_\$\{\}\`\?]+)'\);\s*if \(res\.ok\) \{\s*const duelsData = await res\.json\(\);\s*setActiveDuels\(duelsData\);\s*\}/g, 
`const res = await fetch('$1', { headers: { 'Accept': 'application/json' }});
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const duelsData = await res.json();
            setActiveDuels(duelsData);
          }
        }`);
  
  // also handle MatchDetails
  content = content.replace(/const res = await fetch\(`\/api\/duels\/\$\{fixtureId\}`\);\s*if \(res.ok\) \{\s*const data = await res.json\(\);/g,
  `const res = await fetch(\`/api/duels/\${fixtureId}\`, { headers: { 'Accept': 'application/json' }});
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();`);
            
  // update the closing brace for MatchDetails
  content = content.replace(/setActiveDuels\(data\.filter\(\(d: any\) => !d\.participants\.find\(\(p: any\) => p\.uid === user\.uid\)\)\);\s*\}/g,
  `setActiveDuels(data.filter((d: any) => !d.participants.find((p: any) => p.uid === user.uid)));
          }
        }`);

  fs.writeFileSync(file, content);
}
console.log('Fixed fetches in multiple files');
