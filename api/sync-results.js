// Vercel serverless function — sincroniza resultados del Mundial desde football-data.org
import { createClient } from "@supabase/supabase-js";

// Nombres en inglés (football-data.org) → español (nuestra app)
const TEAM_MAP = {
  "South Africa": "Sudáfrica",
  "Canada": "Canadá",
  "Netherlands": "Países Bajos",
  "Morocco": "Marruecos",
  "Brazil": "Brasil",
  "Japan": "Japón",
  "Germany": "Alemania",
  "France": "Francia",
  "Sweden": "Suecia",
  "Côte d'Ivoire": "Costa de Marfil",
  "Ivory Coast": "Costa de Marfil",
  "Norway": "Noruega",
  "Mexico": "México",
  "England": "Inglaterra",
  "DR Congo": "RD Congo",
  "Democratic Republic of Congo": "RD Congo",
  "Belgium": "Bélgica",
  "Senegal": "Senegal",
  "United States": "Estados Unidos",
  "USA": "Estados Unidos",
  "Bosnia and Herzegovina": "Bosnia",
  "Bosnia & Herzegovina": "Bosnia",
  "Spain": "España",
  "Austria": "Austria",
  "Portugal": "Portugal",
  "Croatia": "Croacia",
  "Switzerland": "Suiza",
  "Algeria": "Argelia",
  "Australia": "Australia",
  "Egypt": "Egipto",
  "Argentina": "Argentina",
  "Cape Verde": "Cabo Verde",
  "Colombia": "Colombia",
  "Ghana": "Ghana",
  "Ecuador": "Ecuador",
  "Paraguay": "Paraguay",
};

// Rondas de la API → IDs de nuestra app
const STAGE_MAP = {
  ROUND_OF_32: "r32",
  LAST_32: "r32",
  ROUND_OF_16: "r16",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  FINAL: "final",
};

// Cruces de dieciseisavos fijos para construir el lookup de IDs
const R32 = [
  ["Sudáfrica", "Canadá"],
  ["Países Bajos", "Marruecos"],
  ["Brasil", "Japón"],
  ["Alemania", "Paraguay"],
  ["Francia", "Suecia"],
  ["Costa de Marfil", "Noruega"],
  ["México", "Ecuador"],
  ["Inglaterra", "RD Congo"],
  ["Bélgica", "Senegal"],
  ["Estados Unidos", "Bosnia"],
  ["España", "Austria"],
  ["Portugal", "Croacia"],
  ["Suiza", "Argelia"],
  ["Australia", "Egipto"],
  ["Argentina", "Cabo Verde"],
  ["Colombia", "Ghana"],
];

function buildR32Lookup() {
  const m = {};
  R32.forEach(([h, a], i) => {
    m[`${h}|${a}`] = `r32-${i}`;
    m[`${a}|${h}`] = `r32-${i}`;
  });
  return m;
}

export default async function handler(req, res) {
  // Permite llamadas GET (cron externo) o POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl  = process.env.VITE_SUPABASE_URL;
  const supabaseKey  = process.env.VITE_SUPABASE_ANON_KEY;
  const adminSecret  = process.env.ADMIN_SECRET;
  const footballKey  = process.env.FOOTBALL_API_KEY;

  if (!supabaseUrl || !supabaseKey || !adminSecret || !footballKey) {
    return res.status(500).json({ error: "Faltan variables de entorno" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Pedir partidos a football-data.org
  const apiRes = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches",
    { headers: { "X-Auth-Token": footballKey } }
  );

  if (!apiRes.ok) {
    return res.status(502).json({ error: `API fútbol: ${apiRes.status}` });
  }

  const { matches } = await apiRes.json();

  // 2. Cargar estado actual de admin
  const { data: adminData } = await supabase
    .from("v_admin")
    .select("*")
    .single();

  if (!adminData) {
    return res.status(500).json({ error: "No se pudo cargar admin state" });
  }

  const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "HALFTIME", "LIVE"]);

  const r32Lookup  = buildR32Lookup();
  const newResults = { ...(adminData.results  || {}) };
  const newFixtures = { ...(adminData.fixtures || {}) };
  let updated = 0;
  let live = 0;

  // 3. Procesar partidos terminados y en juego
  for (const match of matches) {
    const isFinished = match.status === "FINISHED";
    const isLive     = LIVE_STATUSES.has(match.status);
    if (!isFinished && !isLive) continue;

    const roundId = STAGE_MAP[match.stage];
    if (!roundId) continue;

    const homeEng = match.homeTeam?.name;
    const awayEng = match.awayTeam?.name;
    const homeSpa = TEAM_MAP[homeEng];
    const awaySpa = TEAM_MAP[awayEng];
    if (!homeSpa || !awaySpa) continue;

    // Encontrar el ID del partido
    let matchId;
    if (roundId === "r32") {
      matchId = r32Lookup[`${homeSpa}|${awaySpa}`];
      if (!matchId) continue;
    } else {
      const fixtures = [...(newFixtures[roundId] || [])];
      let idx = fixtures.findIndex(([h, a]) => h === homeSpa && a === awaySpa);
      if (idx === -1) {
        fixtures.push([homeSpa, awaySpa]);
        idx = fixtures.length - 1;
        newFixtures[roundId] = fixtures;
      }
      matchId = `${roundId}-${idx}`;
    }

    // fullTime = marcador a los 90'. extraTime = marcador tras prórroga (acumulado).
    // Guardamos siempre el marcador a 90' en h/a para el bonus de resultado exacto.
    const duration = match.duration; // "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT"
    const ft = match.score.fullTime;
    const h90 = ft?.home ?? "";
    const a90 = ft?.away ?? "";

    if (isFinished) {
      let adv = null;
      if (match.score.winner === "HOME_TEAM") adv = homeSpa;
      else if (match.score.winner === "AWAY_TEAM") adv = awaySpa;

      // h/a = marcador 90' (para +2 exacto). adv = ganador final (para +3 quién pasa).
      // Si hubo prórroga o penaltis, ambos datos son independientes y correctos.
      newResults[matchId] = { h: String(h90), a: String(a90), adv, duration };
      updated++;
    } else {
      // En juego: marcador provisional sin adv, sin machacar un resultado final
      const existing = newResults[matchId];
      if (!existing?.adv && h90 !== "" && a90 !== "") {
        newResults[matchId] = { h: String(h90), a: String(a90), adv: null, live: true, duration };
        live++;
      }
    }
  }

  // 4. Guardar en Supabase
  const { data: saved } = await supabase.rpc("admin_save", {
    p_admin_secret: adminSecret,
    p_patch: { results: newResults, fixtures: newFixtures },
  });

  return res.json({
    ok: !!saved,
    updated,
    live,
    total: matches.filter((m) => m.status === "FINISHED").length,
  });
}
