export const TEAM_ALIASES: Record<string, string[]> = {
  // Germany
  "Bayern Munich": ["Bayern München", "Munich", "München", "Munique", "Bavaria"],
  "Eintracht Frankfurt": ["Francfort", "Frankfurt", "Francoforte", "Eintracht"],
  "Borussia Dortmund": ["Dortmund", "BVB"],
  "Bayer Leverkusen": ["Leverkusen", "Bayer"],
  "RB Leipzig": ["Leipzig"],
  "Stuttgart": ["Stuttgart"],
  "FC Koln": ["Cologne", "Köln"],
  "Schalke 04": ["Schalke"],
  "Werder Bremen": ["Brême", "Bremen"],
  "Hannover 96": ["Hanovre", "Hannover"],
  "Nurnberg": ["Nuremberg", "Nürnberg"],

  // Italy
  "Bologna": ["Bologne"],
  "AC Milan": ["Milan AC", "Milan", "Mailand"],
  "Inter": ["Inter Milan", "Internazionale", "Inter"],
  "Juventus": ["Juve", "Juventus Turin", "Turin"],
  "Torino": ["Turin"],
  "AS Roma": ["Rome", "Roma"],
  "Napoli": ["Naples", "Neapel"],
  "Lazio": ["Lazio Rome"],
  "Fiorentina": ["Florence", "Florenz"],
  "Genoa": ["Gênes", "Genua"],
  "Venezia": ["Venise", "Venice", "Venedig"],

  // Spain
  "FC Barcelona": ["Barça", "Barcelone", "Barcelona"],
  "Real Madrid": ["Real", "Real Madrid", "Madrid"],
  "Atletico Madrid": ["Atlético", "Atletico", "Atleti"],
  "Sevilla": ["Séville", "Seville", "Sevilla"],
  "Girona": ["Gérone"],
  "Zaragoza": ["Saragosse", "Saragossa"],

  // Portugal
  "FC Porto": ["Porto"],
  "Sporting CP": ["Sporting", "Sporting Portugal", "Sporting Lisbon", "Sporting Clube"],
  "Benfica": ["Benfica Lisbon", "Benfica"],

  // France
  "Paris Saint Germain": ["PSG", "Paris SG", "Paris"],
  "Olympique Marseille": ["OM", "Marseille"],
  "Olympique Lyonnais": ["OL", "Lyon"],
  "Lille OSC": ["LOSC", "Lille"],
  "AS Monaco": ["ASM", "Monaco"],
  "Saint-Etienne": ["ASSE", "Saint Etienne", "St Etienne"],

  // England
  "Manchester United": ["Man U", "Man Utd", "Manchester"],
  "Manchester City": ["Man City"],
  "Tottenham Hotspur": ["Spurs", "Tottenham"],
  "Arsenal": ["Arsenal"],
  "Chelsea": ["Chelsea"],
  "Liverpool": ["Liverpool"],
  "Newcastle United": ["Newcastle", "Magpies"],

  // Rest of Europe
  "Crvena Zvezda": ["Etoile Rouge", "Red Star", "Estrella Roja", "Estrela Vermelha", "Stella Rossa", "Roter Stern", "Belgrade"],
  "Partizan": ["Partizan Belgrade"],
  "Dinamo Zagreb": ["Dynamo Zagreb"],
  "Shakhtar Donetsk": ["Chaktar Donetsk", "Chakhtar"],
  "FC Copenhagen": ["Copenhague", "København", "Kopenhagen", "Copenhagen"],
  "Ajax": ["Ajax Amsterdam"],
  "PSV Eindhoven": ["PSV"],
  "Feyenoord": ["Feyenoord Rotterdam"],
};

export function normalizeString(str: string): string {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Checks if a search term matches a target name or any of its localized aliases.
 */
export function matchTeamOrLeague(searchTerm: string, targetName: string): boolean {
  if (!searchTerm || !targetName) return false;
  
  const normalizedSearch = normalizeString(searchTerm);
  const normalizedTarget = normalizeString(targetName);
  
  if (normalizedTarget.includes(normalizedSearch)) return true;

  for (const [key, aliases] of Object.entries(TEAM_ALIASES)) {
    const allVariations = [key, ...aliases].map(normalizeString);
    
    // Check if target name maps to this team group
    const targetMatchesGroup = allVariations.some(v => normalizedTarget.includes(v) || v.includes(normalizedTarget));
    
    // Check if search term maps to this team group
    const searchMatchesGroup = allVariations.some(v => normalizedSearch.includes(v) || v.includes(normalizedSearch));
    
    if (targetMatchesGroup && searchMatchesGroup) return true;
  }

  return false;
}

/**
 * Returns all possible variations (translations/aliases) of a search term
 * to send to the API or check against.
 */
export function getSearchVariations(searchTerm: string): string[] {
  if (!searchTerm || searchTerm.length < 3) return [searchTerm];
  
  const normalizedSearch = normalizeString(searchTerm);
  const variations = new Set<string>();
  variations.add(searchTerm);

  for (const [key, aliases] of Object.entries(TEAM_ALIASES)) {
    const allVariations = [key, ...aliases].map(normalizeString);
    if (allVariations.some(v => v.includes(normalizedSearch) || normalizedSearch.includes(v))) {
      variations.add(key); // Add the main canonical name
      break;
    }
  }

  return Array.from(variations);
}
