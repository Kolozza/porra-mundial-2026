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
  "Congo DR": "RD Congo",
  "Democratic Republic of Congo": "RD Congo",
  "Democratic Republic of the Congo": "RD Congo",
  "Dem. Rep. Congo": "RD Congo",
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

    // Respetar correcciones manuales del admin: si está bloqueado, no tocarlo
    if (newResults[matchId]?.manualOverride === true) continue;

    // En football-data.org v4:
    //   score.regularTime = marcador a los 90' exactos (presente en ET y PSO)
    //   score.extraTime   = marcador final tras prórroga (ET y PSO)
    //                       ⚠️ En PSO acumula los goles de penaltis → NO usar para display en PSO
    //   score.fullTime    = marcador final del partido
    //                       ⚠️ En PSO también puede acumular penaltis → NO usar para display en PSO
    //
    // Estrategia por tipo de partido:
    //   REGULAR          → display = fullTime       | 90' = fullTime
    //   EXTRA_TIME       → display = extraTime      | 90' = regularTime
    //   PENALTY_SHOOTOUT → display = regularTime    | 90' = regularTime
    //     (PSO: extraTime y fullTime pueden incluir goles de penaltis acumulados)
    const scoreData = match.score;
    const duration = scoreData.duration || "REGULAR";
    const isPSO = duration === "PENALTY_SHOOTOUT";
    const isExtraTime = duration === "EXTRA_TIME";
    const ft = scoreData.fullTime;
    const et = scoreData.extraTime;
    const rt = scoreData.regularTime;

    // Marcador 90' (siempre regularTime si existe, si no fullTime — son iguales para REGULAR)
    const h90 = rt?.home ?? ft?.home ?? "";
    const a90 = rt?.away ?? ft?.away ?? "";

    // Marcador para display (sin contar goles de penaltis)
    let hFinal, aFinal;
    if (isPSO) {
      // PSO: usar regularTime — es el marcador antes de que empezaran los penaltis
      hFinal = rt?.home ?? ft?.home ?? "";
      aFinal = rt?.away ?? ft?.away ?? "";
    } else if (isExtraTime) {
      // ET ganado en prórroga: usar extraTime (marcador final de la prórroga)
      hFinal = et?.home ?? ft?.home ?? "";
      aFinal = et?.away ?? ft?.away ?? "";
    } else {
      hFinal = ft?.home ?? "";
      aFinal = ft?.away ?? "";
    }

    if (isFinished) {
      let adv = null;
      if (scoreData.winner === "HOME_TEAM") adv = homeSpa;
      else if (scoreData.winner === "AWAY_TEAM") adv = awaySpa;

      // h/a = marcador display (sin penaltis). adv = quien pasa.
      // h90/a90 solo se guarda cuando la prórroga añadió goles (ET ganado en prórroga).
      // En PSO el marcador de 90' = display, no hace falta guardarlo por separado.
      const result = { h: String(hFinal), a: String(aFinal), adv, duration };
      if (isExtraTime && (String(h90) !== String(hFinal) || String(a90) !== String(aFinal))) {
        result.h90 = String(h90);
        result.a90 = String(a90);
      }
      newResults[matchId] = result;
      updated++;
    } else {
      // En juego: hFinal ya es seguro (PSO→regularTime, ET→extraTime, normal→fullTime)
      const existing = newResults[matchId];
      if (!existing?.adv && hFinal !== "" && aFinal !== "") {
        const liveResult = { h: String(hFinal), a: String(aFinal), adv: null, live: true, duration };
        // Durante prórroga en vivo: guardar marcador 90' si difiere del display
        if (isExtraTime && (String(h90) !== String(hFinal) || String(a90) !== String(aFinal))) {
          liveResult.h90 = String(h90);
          liveResult.a90 = String(a90);
        }
        newResults[matchId] = liveResult;
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
