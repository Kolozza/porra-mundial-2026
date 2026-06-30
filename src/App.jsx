import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

/* ----------------------------------------------------------------
   PORRA MUNDIAL 2026 — fase eliminatoria
   Reglas (acordadas):
   - 3 pts por acertar quién pasa la eliminatoria
   - 2 pts por acertar el resultado exacto a los 90'
   - Multiplicadores por ronda: x1 / x1 / x2 / x3 / x3
   - Bonus de campeón (bloqueado al inicio): +15
   Identidad por enlace personal (secreto en localStorage / ?key=)
------------------------------------------------------------------*/

const ROUNDS = [
  { id: "r32", name: "Dieciseisavos", short: "16avos", mult: 1 },
  { id: "r16", name: "Octavos", short: "8avos", mult: 1 },
  { id: "qf", name: "Cuartos", short: "Cuartos", mult: 2 },
  { id: "sf", name: "Semifinales", short: "Semis", mult: 3 },
  { id: "final", name: "Final", short: "Final", mult: 3 },
];
const BONUS = {
  champion: 15,
  pichichi: 10,
};
const PLENO = { r32: 8, r16: 5, qf: 3 };
const BONUS_TOTAL =
  BONUS.champion + BONUS.pichichi + PLENO.r32 + PLENO.r16 + PLENO.qf; // 41


/* ── Canciones por jugador (YouTube video IDs) ─────────── */
const PLAYER_SONGS = {
  "Mati":    "UeFC_9oGqWg", // Los Palmeras - Bombón Asesino
  "Sebas":   "UeFC_9oGqWg",
  "Juan":    "UeFC_9oGqWg",
  "Flo":     "pw4hP6lgrP4", // Erika - German March
  "Erika":   "pw4hP6lgrP4",
  "Canario": "yx2hlHq7b7U", // Himno Nacional de España
  "Mocete":  "2E1p-xSCTKM", // Cara al Sol - Himno de la Falange
  "Ivan":    "2E1p-xSCTKM",
  "Niko":    "UeFC_9oGqWg", // Los Palmeras - Bombón Asesino
  "Gentjan": "d76REwyqtsM", // Albanian National Anthem
  "Ray":     "YnopHCL1Jk8", // O-Zone - Dragostea Din Tei
  "Alex":    "LydqaFWYjgA", // Swords of Iraq - Iraqi Patriotic Song
};

// Singleton YouTube IFrame player (vive fuera del árbol React)
let _yt = null;
let _ytOk = false;
let _ytCbs = [];
function _initYT(cb) {
  if (_ytOk) { cb(); return; }
  _ytCbs.push(cb);
  if (!document.getElementById('_yt_api')) {
    window.onYouTubeIframeAPIReady = () => {
      _ytOk = true;
      _ytCbs.forEach(f => f());
      _ytCbs = [];
    };
    const s = document.createElement('script');
    s.id = '_yt_api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
}
function _ytDiv() {
  let d = document.getElementById('_yt_div');
  if (!d) {
    d = document.createElement('div');
    d.id = '_yt_div';
    d.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden';
    document.body.appendChild(d);
  }
  return d;
}

const PICHICHI = [
  // Argentina
  "Lionel Messi (Argentina)",
  "Lautaro Martínez (Argentina)",
  "Julián Álvarez (Argentina)",
  // Francia
  "Kylian Mbappé (Francia)",
  "Ousmane Dembélé (Francia)",
  "Marcus Thuram (Francia)",
  // Brasil
  "Vinícius Júnior (Brasil)",
  "Raphinha (Brasil)",
  "Rodrygo (Brasil)",
  "Richarlison (Brasil)",
  // Noruega
  "Erling Haaland (Noruega)",
  // Inglaterra
  "Harry Kane (Inglaterra)",
  "Phil Foden (Inglaterra)",
  "Bukayo Saka (Inglaterra)",
  // España
  "Lamine Yamal (España)",
  "Mikel Oyarzabal (España)",
  "Dani Olmo (España)",
  // Portugal
  "Cristiano Ronaldo (Portugal)",
  "Diogo Jota (Portugal)",
  "Gonçalo Ramos (Portugal)",
  // Alemania
  "Jamal Musiala (Alemania)",
  "Florian Wirtz (Alemania)",
  "Kai Havertz (Alemania)",
  // Países Bajos
  "Cody Gakpo (Países Bajos)",
  "Xavi Simons (Países Bajos)",
  "Memphis Depay (Países Bajos)",
  // Suecia
  "Viktor Gyökeres (Suecia)",
  "Alexander Isak (Suecia)",
  // Bélgica
  "Romelu Lukaku (Bélgica)",
  // Egipto
  "Mohamed Salah (Egipto)",
  // Colombia
  "Luis Díaz (Colombia)",
  "James Rodríguez (Colombia)",
  // México
  "Santiago Giménez (México)",
  "Raúl Jiménez (México)",
  // Estados Unidos
  "Christian Pulisic (Estados Unidos)",
  "Ricardo Pepi (Estados Unidos)",
  // Ghana
  "Mohammed Kudus (Ghana)",
  // Suiza
  "Breel Embolo (Suiza)",
  // Senegal
  "Sadio Mané (Senegal)",
];

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

const TEAMS = [...new Set(R32.flat())].sort((a, b) => a.localeCompare(b, "es"));

// Orden cronológico de los partidos de r32 (índices del array R32)
// No modifica R32 para preservar los IDs de predicciones guardadas
const R32_DATE_ORDER = [0, 2, 3, 1, 5, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const R32_DATES = {
  0:"28 Jun", 2:"29 Jun", 3:"29 Jun", 1:"30 Jun",
  5:"30 Jun", 4:"30 Jun", 6:"1 Jul",
  7:"1 Jul",  8:"1 Jul",  9:"2 Jul",
  10:"2 Jul", 11:"3 Jul", 12:"3 Jul",
  13:"3 Jul", 14:"4 Jul", 15:"4 Jul",
};
const R32_TIMES = {
  0:"21:00", 2:"19:00", 3:"22:30", 1:"03:00",
  5:"19:00", 4:"23:00", 6:"03:00",
  7:"18:00", 8:"22:00", 9:"02:00",
  10:"21:00",11:"01:00",12:"05:00",
  13:"20:00",14:"00:00",15:"03:30",
};

const PLAYER_COLORS = {
  "Matias":  "#74ACDF",  // albiceleste
  "Niko":    "#ef4444",  // rojo
  "Gentjan": "#FFFFFF",  // blanco
  "Alex":    "#ADFF2F",  // fluorescente
  "Ray":     "#FFD700",  // amarillo
  "Ivan":    "#1F77B4",  // azul
};

const COLOR_PALETTE = [
  "#1F77B4", // azul
  "#FF7F0E", // naranja
  "#2CA02C", // verde
  "#D62728", // rojo
  "#9467BD", // morado
  "#8C564B", // marrón
  "#E377C2", // rosa
  "#7F7F7F", // gris
  "#BCBD22", // amarillo oliva
  "#17BECF", // cian
  "#393B79", // azul marino oscuro
];

let _colorMap = {};

function computeColorMap(players) {
  const map = { ...PLAYER_COLORS };
  const used = new Set(Object.values(PLAYER_COLORS));
  const avail = COLOR_PALETTE.filter(c => !used.has(c));
  [...players]
    .filter(p => !map[p.name])
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .forEach((p, i) => { map[p.name] = avail[i % avail.length]; });
  _colorMap = map;
}

function getPlayerColor(name) {
  return _colorMap[name] || PLAYER_COLORS[name] || COLOR_PALETTE[0];
}

// ISO codes para flagcdn.com (funciona en Windows donde los emojis de bandera no se ven)
const COUNTRY_CODES = {
  "Alemania":"de","Argelia":"dz","Argentina":"ar","Australia":"au",
  "Austria":"at","Bélgica":"be","Bosnia":"ba","Brasil":"br",
  "Cabo Verde":"cv","Canadá":"ca","Colombia":"co","Costa de Marfil":"ci",
  "Croacia":"hr","Ecuador":"ec","Egipto":"eg","España":"es",
  "Estados Unidos":"us","Francia":"fr","Ghana":"gh","Inglaterra":"gb-eng",
  "Japón":"jp","Marruecos":"ma","México":"mx","Noruega":"no",
  "Países Bajos":"nl","Paraguay":"py","Portugal":"pt","RD Congo":"cd",
  "Senegal":"sn","Sudáfrica":"za","Suecia":"se","Suiza":"ch",
};

function Flag({ country, size = 24 }) {
  const code = COUNTRY_CODES[country];
  if (!code) return null;
  const isSubdivision = code.includes("-");
  return (
    <span
      className={`fi fi-${code}${isSubdivision ? " fis" : ""}`}
      style={{
        width: size * 1.4,
        height: size,
        borderRadius: 3,
        display: "inline-block",
        flexShrink: 0,
        backgroundSize: "cover",
        verticalAlign: "middle",
      }}
      title={country}
    />
  );
}

const playerCountry = (name) => {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : null;
};

const DEFAULT_ADMIN = {
  openRound: "r32",
  locked: {},
  fixtures: {},
  results: {},
  champion: "",
  pichichi: "",
  adminClaimed: false,
};

/* ---------- model helpers ---------- */
const fixturesFor = (admin, roundId) =>
  roundId === "r32" ? R32 : admin.fixtures?.[roundId] || [];

const matchId = (roundId, i) => `${roundId}-${i}`;

const predAdv = (p, home, away) => {
  if (!p || p.h === "" || p.a === "" || p.h == null || p.a == null) return null;
  const h = Number(p.h), a = Number(p.a);
  if (h > a) return home;
  if (a > h) return away;
  return p.adv || null;
};

function scorePlayer(player, admin) {
  let total = 0;
  let pending = 0;
  const byRound = {};
  const plenos = {};
  let plenoTotal = 0;

  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    let rp = 0;
    let allResolved = fx.length > 0;
    let allAdvCorrect = fx.length > 0;
    fx.forEach((m, i) => {
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      const pred = player.preds?.[R.id]?.[id];
      const resolved =
        res && res.adv != null && res.h !== "" && res.a !== "";
      if (!resolved) {
        allResolved = false;
        allAdvCorrect = false;
        if (pred && (pred.h !== "" || pred.a !== "")) pending++;
        return;
      }
      if (!pred) {
        allAdvCorrect = false;
        return;
      }
      let pts = 0;
      const pa = predAdv(pred, m[0], m[1]);
      if (pa && pa === res.adv) pts += 3;
      else allAdvCorrect = false;
      const rh90 = res.h90 != null && res.h90 !== "" ? Number(res.h90) : Number(res.h);
      const ra90 = res.a90 != null && res.a90 !== "" ? Number(res.a90) : Number(res.a);
      if (Number(pred.h) === rh90 && Number(pred.a) === ra90) pts += 2;
      pts *= R.mult;
      rp += pts;
    });
    byRound[R.id] = rp;
    total += rp;
    if (PLENO[R.id] && allResolved && allAdvCorrect) {
      plenos[R.id] = PLENO[R.id];
      plenoTotal += PLENO[R.id];
    }
  }
  total += plenoTotal;

  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const bonus = { champion: 0, pichichi: 0 };
  if (admin.champion && player.champion && player.champion === admin.champion)
    bonus.champion = BONUS.champion;
  if (admin.pichichi && player.pichichi && norm(player.pichichi) === norm(admin.pichichi))
    bonus.pichichi = BONUS.pichichi;

  const bonusPts = bonus.champion + bonus.pichichi;
  total += bonusPts;

  return { total, byRound, plenos, plenoTotal, bonus, bonusPts, pending };
}

/* ================================================================
   Routing: / → MainApp, /admin → AdminPage
================================================================ */
function PitchLines() {
  return (
    <svg
      style={{
        position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:680,height:"100vh",
        pointerEvents:"none",zIndex:0,overflow:"visible",
      }}
      viewBox="0 0 680 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Borde del campo */}
      <rect x="24" y="24" width="632" height="852" fill="none" stroke="white" strokeWidth="1.5" opacity=".07"/>
      {/* Línea central */}
      <line x1="24" y1="450" x2="656" y2="450" stroke="white" strokeWidth="1.5" opacity=".07"/>
      {/* Círculo central */}
      <circle cx="340" cy="450" r="88" fill="none" stroke="white" strokeWidth="1.5" opacity=".07"/>
      {/* Punto central */}
      <circle cx="340" cy="450" r="3.5" fill="white" opacity=".1"/>
      {/* Área grande superior */}
      <rect x="148" y="24" width="384" height="148" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
      {/* Área pequeña superior */}
      <rect x="248" y="24" width="184" height="56" fill="none" stroke="white" strokeWidth="1.5" opacity=".055"/>
      {/* Punto penalti superior */}
      <circle cx="340" cy="136" r="3" fill="white" opacity=".08"/>
      {/* Arco área superior */}
      <path d="M 248 172 A 88 88 0 0 1 432 172" fill="none" stroke="white" strokeWidth="1.5" opacity=".055"/>
      {/* Área grande inferior */}
      <rect x="148" y="728" width="384" height="148" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
      {/* Área pequeña inferior */}
      <rect x="248" y="820" width="184" height="56" fill="none" stroke="white" strokeWidth="1.5" opacity=".055"/>
      {/* Punto penalti inferior */}
      <circle cx="340" cy="764" r="3" fill="white" opacity=".08"/>
      {/* Arco área inferior */}
      <path d="M 248 728 A 88 88 0 0 0 432 728" fill="none" stroke="white" strokeWidth="1.5" opacity=".055"/>
      {/* Esquinas */}
      <path d="M 24 44 A 20 20 0 0 1 44 24" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
      <path d="M 636 24 A 20 20 0 0 1 656 44" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
      <path d="M 656 856 A 20 20 0 0 1 636 876" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
      <path d="M 44 876 A 20 20 0 0 1 24 856" fill="none" stroke="white" strokeWidth="1.5" opacity=".06"/>
    </svg>
  );
}

export default function Root() {
  if (window.location.pathname === "/admin") return <AdminPage />;
  return <MainApp />;
}


/* ── MusicPlayer ─────────────────────────────────────────── */
function MusicPlayer({ me }) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [attract, setAttract] = useState(false);
  const loadedSong = useRef(null);
  const songId = me ? PLAYER_SONGS[me.name] : null;

  // Mostrar animación de atracción los primeros segundos al detectar canción
  useEffect(() => {
    if (!songId) return;
    setAttract(true);
    const t = setTimeout(() => setAttract(false), 4000);
    return () => clearTimeout(t);
  }, [songId]);

  useEffect(() => {
    if (!songId) {
      if (_yt) { try { _yt.pauseVideo(); } catch(_) {} }
      setPlaying(false);
      return;
    }
    _ytDiv();
    _initYT(() => {
      if (!_yt) {
        _yt = new window.YT.Player('_yt_div', {
          width: 1, height: 1,
          videoId: songId,
          playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: songId, origin: window.location.origin },
          events: {
            onReady: () => { loadedSong.current = songId; setReady(true); },
          },
        });
      } else if (loadedSong.current !== songId) {
        try { _yt.cueVideoById({ videoId: songId, startSeconds: 0 }); } catch(_) {}
        loadedSong.current = songId;
        setPlaying(false);
      }
    });
  }, [songId]); // eslint-disable-line

  const toggle = () => {
    setAttract(false);
    if (!_yt || !ready) return;
    if (playing) { _yt.pauseVideo(); setPlaying(false); }
    else { _yt.playVideo(); setPlaying(true); }
  };

  if (!songId) return null;
  return (
    <button
      className={`music-btn${attract && !playing ? " music-attract" : ""}`}
      onClick={toggle}
      title={playing ? "Parar música" : "Reproducir música"}
    >
      {playing ? "🔊" : "🔇"}
    </button>
  );
}

/* ================================================================
   MainApp
================================================================ */
function MainApp() {
  const [admin, setAdmin] = useState(DEFAULT_ADMIN);
  const [players, setPlayers] = useState([]);
  const [meId, setMeId] = useState(null);
  const [mySecret, setMySecret] = useState(null);
  const [tab, setTab] = useState("jugar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const me = players.find((p) => p.id === meId) || null;

  // Resolve identity from URL ?key= or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("key");
    if (urlKey) {
      localStorage.setItem("porra_secret", urlKey);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    const secret = urlKey || localStorage.getItem("porra_secret");
    const playerId = localStorage.getItem("porra_player_id");
    if (secret && playerId) {
      supabase.rpc("log_login", { p_player_id: playerId, p_method: urlKey ? "link" : "session" });
      setMySecret(secret);
      setMeId(playerId);
    }
  }, []);

  const load = useCallback(async () => {
    const [{ data: playersData }, { data: adminData }] = await Promise.all([
      supabase.from("v_players").select("*"),
      supabase.from("v_admin").select("*").single(),
    ]);
    if (playersData) { setPlayers(playersData); computeColorMap(playersData); }
    if (adminData) {
      setAdmin({
        openRound: adminData.open_round || "r32",
        locked: adminData.locked || {},
        fixtures: adminData.fixtures || {},
        results: adminData.results || {},
        champion: adminData.champion || "",
        pichichi: adminData.pichichi || "",
        adminClaimed: adminData.admin_claimed,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  // Cuando hay partido en vivo, sincroniza con la API de fútbol cada 60s
  // (complementa el cron de Vercel para mayor frecuencia durante el partido)
  const hasLive = Object.values(admin.results || {}).some(r => r.live && !r.adv);
  useEffect(() => {
    if (!hasLive) return;
    const lastSync = { t: 0 };
    const autoSync = async () => {
      const now = Date.now();
      if (now - lastSync.t < 55000) return;
      lastSync.t = now;
      try { await fetch("/api/sync-results"); } catch (_) {}
      load();
    };
    autoSync();
    const t = setInterval(autoSync, 60000);
    return () => clearInterval(t);
  }, [hasLive, load]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const joinGame = async (name, pin) => {
    setSaving(true);
    const { data, error } = await supabase.rpc("create_player", { p_name: name.trim(), p_pin: pin });
    setSaving(false);
    if (error || !data) {
      const msg = (error?.message || "").includes("unique_violation")
        ? "Ese nombre ya existe"
        : "Error al crear jugador";
      return { error: msg };
    }
    const { id, secret } = data;
    supabase.rpc("log_login", { p_player_id: id, p_method: "register" });
    localStorage.setItem("porra_secret", secret);
    localStorage.setItem("porra_player_id", id);
    setMySecret(secret);
    setMeId(id);
    await load();
    flash(`¡Dentro, ${name.trim()}!`);
    return { id, secret };
  };

  const recoverGame = async (name, pin) => {
    const { data } = await supabase.rpc("recover_player", { p_name: name.trim(), p_pin: pin });
    if (!data) return { error: "Nombre o PIN incorrectos" };
    const { id, secret } = data;
    supabase.rpc("log_login", { p_player_id: id, p_method: "recovery" });
    localStorage.setItem("porra_secret", secret);
    localStorage.setItem("porra_player_id", id);
    setMySecret(secret);
    setMeId(id);
    await load();
    flash("¡Cuenta recuperada!");
    return { id, secret };
  };

  const logout = () => {
    localStorage.removeItem("porra_secret");
    localStorage.removeItem("porra_player_id");
    setMySecret(null);
    setMeId(null);
  };

  const saveMyFutures = async (champion, pichichi) => {
    if (!mySecret) return false;
    const { data } = await supabase.rpc("save_futures", {
      p_secret: mySecret,
      p_champion: champion,
      p_pichichi: pichichi,
    });
    await load();
    return !!data;
  };

  const saveMyPreds = async (roundId, roundPreds) => {
    if (!mySecret) return false;
    const { data } = await supabase.rpc("save_predictions", {
      p_secret: mySecret,
      p_round: roundId,
      p_round_preds: roundPreds,
    });
    await load();
    return !!data;
  };

  const handleSave = async (champion, pichichi, roundId, roundPreds, champLocked) => {
    setSaving(true);
    const tasks = [saveMyPreds(roundId, roundPreds)];
    if (!champLocked) tasks.push(saveMyFutures(champion, pichichi));
    const results = await Promise.all(tasks);
    setSaving(false);
    flash(results.every(Boolean) ? "Guardado ✓" : "Error al guardar");
  };

  const standings = players
    .map((p) => ({ p, s: scorePlayer(p, admin) }))
    .sort((x, y) => y.s.total - x.s.total || x.p.name.localeCompare(y.p.name));

  return (
    <div className="porra">
      <style>{CSS}</style>
      <PitchLines />

      <header className="hdr">
        <div className="flag-strip">
          <div className="flag-strip-inner">
            {[...Object.keys(COUNTRY_CODES), ...Object.keys(COUNTRY_CODES)].map((c, i) => (
              <Flag key={i} country={c} size={18} />
            ))}
          </div>
        </div>
        <div className="hdr-mark">
          <span className="ball">⚽</span>
          <div className="hdr-titles">
            <h1>LA PORRA · MUNDIAL 2026</h1>
            <p className="hdr-sub">🏆 USA · Canadá · México · Fase eliminatoria</p>
          </div>
          <MusicPlayer me={me} />
        </div>
        <IdentityBar me={me} onJoin={joinGame} onRecover={recoverGame} onLogout={logout} />
      </header>

      <nav className="tabs">
        {[
          ["jugar", "Jugar"],
          ["clasi", "Clasificación"],
          ["picks", "Picks"],
          ["reglas", "Reglas"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "tab on" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="empty">Cargando porra…</div>
      ) : (
        <>
          <LiveMatchPanel admin={admin} players={players} standings={standings} />
          {tab === "jugar" ? (
            <Jugar admin={admin} me={me} onSave={handleSave} />
          ) : tab === "clasi" ? (
            <Clasificacion standings={standings} admin={admin} meId={meId} />
          ) : tab === "picks" ? (
            <Picks admin={admin} standings={standings} meId={meId} />
          ) : (
            <Reglas />
          )}
        </>
      )}

      {saving && <div className="saving">guardando…</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------------- Identity (enlace personal + PIN de recuperación) ---------------- */
function IdentityBar({ me, onJoin, onRecover, onLogout }) {
  const [mode, setMode] = useState("join"); // "join" | "recover"
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [personalLink, setPersonalLink] = useState(null);
  const [copied, setCopied] = useState(false);

  if (me) {
    return (
      <div className="ident">
        <div className="ident-me">
          Soy <strong>{me.name}</strong>
          <button className="link" onClick={onLogout}>
            cambiar
          </button>
        </div>
      </div>
    );
  }

  if (personalLink) {
    const copy = () => {
      navigator.clipboard.writeText(personalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <div className="ident">
        <p className="mini muted" style={{ marginBottom: 6 }}>
          ¡Dentro! Guarda tu enlace personal (es tu acceso):
        </p>
        <div className="link-box">
          <code className="personal-link">{personalLink}</code>
          <button className="btn sm" onClick={copy}>
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
        <p className="mini muted" style={{ marginTop: 4 }}>
          Quien tenga este enlace puede editar tu cuenta. No lo compartas.
        </p>
      </div>
    );
  }

  const join = async () => {
    setErr("");
    if (!name.trim()) return setErr("Pon tu nombre");
    if (pin.length !== 4) return setErr("PIN de 4 dígitos");
    const result = await onJoin(name, pin);
    if (result.error) {
      setErr(result.error);
    } else {
      const link = `${window.location.origin}${window.location.pathname}?key=${result.secret}`;
      setPersonalLink(link);
    }
  };

  const recover = async () => {
    setErr("");
    if (!name.trim()) return setErr("Pon tu nombre");
    if (pin.length !== 4) return setErr("PIN de 4 dígitos");
    const result = await onRecover(name, pin);
    if (result.error) setErr(result.error);
  };

  const switchMode = (m) => {
    setMode(m);
    setName("");
    setPin("");
    setErr("");
  };

  return (
    <div className="ident">
      <div className="ident-pick">
        <input
          className="inp"
          placeholder="tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (mode === "join" ? join() : recover())}
        />
        <input
          className="inp pin"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN 4 díg."
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && (mode === "join" ? join() : recover())}
        />
        {mode === "join" ? (
          <button className="btn sm" onClick={join}>Entrar</button>
        ) : (
          <button className="btn sm" onClick={recover}>Recuperar</button>
        )}
      </div>
      {err && <p className="ident-err">{err}</p>}
      <div style={{ marginTop: 4 }}>
        {mode === "join" ? (
          <button className="link" onClick={() => switchMode("recover")}>
            ¿Perdiste tu enlace? Recuperar cuenta
          </button>
        ) : (
          <button className="link" onClick={() => switchMode("join")}>
            ← Volver a crear cuenta
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Jugar (pronósticos) ---------------- */
function Jugar({ admin, me, onSave }) {
  if (!me)
    return (
      <div className="empty">
        Identifícate arriba con tu nombre para hacer tus pronósticos. Si eres
        nuevo, escribe tu nombre y pulsa Entrar. Si ya tienes enlace personal,
        ábrelo.
      </div>
    );

  const round = ROUNDS.find((r) => r.id === admin.openRound) || ROUNDS[0];
  const fx = fixturesFor(admin, round.id);
  const locked = !!admin.locked?.[round.id];

  const [draft, setDraft] = useState(() => ({
    champion: me.champion || "",
    pichichi: me.pichichi || "",
    preds: JSON.parse(JSON.stringify(me.preds || {})),
  }));

  useEffect(() => {
    setDraft({
      champion: me.champion || "",
      pichichi: me.pichichi || "",
      preds: JSON.parse(JSON.stringify(me.preds || {})),
    });
  }, [me.id, round.id]); // eslint-disable-line

  const setPred = (id, patch) => {
    setDraft((d) => {
      const r = { ...(d.preds[round.id] || {}) };
      r[id] = { h: "", a: "", adv: "", ...(r[id] || {}), ...patch };
      return { ...d, preds: { ...d.preds, [round.id]: r } };
    });
  };

  const champLocked = !!admin.locked?.r32 || admin.openRound !== "r32";

  const save = () =>
    onSave(draft.champion, draft.pichichi, round.id, draft.preds[round.id] || {}, champLocked);

  const displayMatches = round.id === "r32"
    ? R32_DATE_ORDER.map(origIdx => ({
        m: fx[origIdx],
        id: matchId(round.id, origIdx),
        dateStr: R32_DATES[origIdx],
        timeStr: R32_TIMES[origIdx],
      }))
    : fx.map((m, i) => ({ m, id: matchId(round.id, i), dateStr: null, timeStr: null }));

  return (
    <div className="pane">
      <div className="round-banner">
        <div>
          <h2>{round.name}</h2>
          <span className="mult">multiplicador x{round.mult}</span>
        </div>
        {locked && <span className="locked-pill">cerrada</span>}
      </div>

      {fx.length === 0 ? (
        <div className="empty">
          Los cruces de {round.name.toLowerCase()} aún no están cargados. El admin los
          añade en la pestaña Admin cuando se conozcan.
        </div>
      ) : (
        <div className="matches">
          {displayMatches.map(({ m, id, dateStr, timeStr }, renderIdx) => {
            const prevDate = renderIdx > 0 ? displayMatches[renderIdx - 1].dateStr : null;
            const showDate = dateStr && dateStr !== prevDate;
            const p = draft.preds[round.id]?.[id] || { h: "", a: "", adv: "" };
            const isDraw = p.h !== "" && p.a !== "" && Number(p.h) === Number(p.a);
            const res = admin.results?.[id];
            return (
              <React.Fragment key={id}>
                {showDate && (
                  <div className="date-header">
                    {dateStr}
                    {timeStr && <span className="date-header-time"> · {timeStr}h</span>}
                  </div>
                )}
                <MatchRow
                  home={m[0]}
                  away={m[1]}
                  pred={p}
                  draw={isDraw}
                  locked={locked}
                  onScore={(side, v) =>
                    setPred(id, { [side]: v === "" ? "" : Math.max(0, Number(v)) })
                  }
                  onAdv={(team) => setPred(id, { adv: team })}
                  result={res}
                  roundMult={round.mult}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {!locked && fx.length > 0 && (
        <button className="btn big" onClick={save}>
          Guardar mis pronósticos
        </button>
      )}

      <section className="champ-pick">
        <div className="champ-head">
          <span className="gold">★</span> Apuestas de futuro
          <span className="bonus-tag">se resuelven al final · {BONUS.champion + BONUS.pichichi} pts en juego</span>
        </div>

        <div className="future-grid">
          <div className="future-cell">
            <label>Campeón <span className="gold">+{BONUS.champion}</span></label>
            <select
              className="sel wide"
              value={draft.champion}
              disabled={champLocked}
              onChange={(e) => setDraft((d) => ({ ...d, champion: e.target.value }))}
            >
              <option value="">Elige campeón…</option>
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="future-cell">
            <label>Pichichi (máximo goleador) <span className="gold">+{BONUS.pichichi}</span></label>
            <PichichiPicker
              value={draft.pichichi}
              disabled={champLocked}
              onChange={(v) => setDraft((d) => ({ ...d, pichichi: v }))}
            />
          </div>
        </div>

        <p className="mini muted">
          Pleno de ronda (acertar quién pasa en TODOS los partidos): {PLENO.r32} en 16avos,
          {" "}{PLENO.r16} en octavos, {PLENO.qf} en cuartos.
        </p>

        {champLocked && (
          <p className="mini muted">Las apuestas de futuro se bloquean al cerrar dieciseisavos.</p>
        )}
      </section>
    </div>
  );
}

function MatchRow({ home, away, pred, draw, locked, onScore, onAdv, result, roundMult }) {
  const resolved = result && result.adv != null && result.h !== "" && result.a !== "";
  const hasPred = pred.h !== "" && pred.h != null && pred.a !== "" && pred.a != null;

  let advOk = null, scoreOk = null, pts = null;
  if (resolved && hasPred) {
    const pa = predAdv(pred, home, away);
    advOk = pa === result.adv;
    const rh90 = result.h90 != null && result.h90 !== "" ? Number(result.h90) : Number(result.h);
    const ra90 = result.a90 != null && result.a90 !== "" ? Number(result.a90) : Number(result.a);
    scoreOk = Number(pred.h) === rh90 && Number(pred.a) === ra90;
    pts = ((advOk ? 3 : 0) + (scoreOk ? 2 : 0)) * (roundMult || 1);
  }

  return (
    <div className={`match${resolved ? " match-played" : ""}`}>
      <div className="m-team left">
        <span className="team-name">{home}</span>
        <Flag country={home} />
      </div>
      <div className="m-score">
        <input
          className="score"
          inputMode="numeric"
          value={pred.h}
          disabled={locked}
          onChange={(e) => onScore("h", e.target.value.replace(/\D/g, ""))}
        />
        <span className="dash">–</span>
        <input
          className="score"
          inputMode="numeric"
          value={pred.a}
          disabled={locked}
          onChange={(e) => onScore("a", e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="m-team right">
        <Flag country={away} />
        <span className="team-name">{away}</span>
      </div>
      {draw && (
        <div className="adv-row">
          <span className="adv-label">¿Quién pasa?</span>
          <button
            className={pred.adv === home ? "adv on" : "adv"}
            disabled={locked}
            onClick={() => onAdv(home)}
          >
            {home}
          </button>
          <button
            className={pred.adv === away ? "adv on" : "adv"}
            disabled={locked}
            onClick={() => onAdv(away)}
          >
            {away}
          </button>
        </div>
      )}
      {resolved && (
        <div className="match-result">
          {result.h90 != null && result.h90 !== "" && (String(result.h90) !== String(result.h) || String(result.a90) !== String(result.a)) && (
            <span className="mini muted" style={{ width:"100%", fontSize:10 }}>
              90': {result.h90}–{result.a90} · Final: {result.h}–{result.a}
            </span>
          )}
          {hasPred ? (
            <>
              <span className={`mr-badge${advOk ? " ok" : " miss"}`}>
                {advOk ? "✓" : "✗"} Clasif.
              </span>
              <span className={`mr-badge${scoreOk ? " ok" : " miss"}`}>
                {scoreOk ? "✓" : "✗"} Marcador 90'
              </span>
              <span className={`mr-pts${pts > 0 ? " pts-ok" : " pts-zero"}`}>
                +{pts} pt{pts !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className="mr-badge miss">Sin pronóstico · +0 pts</span>
          )}
        </div>
      )}
    </div>
  );
}

function PichichiPicker({ value, disabled, onChange }) {
  const inList = PICHICHI.includes(value);
  const isOther = value !== "" && !inList;
  const [otherMode, setOtherMode] = useState(isOther);

  useEffect(() => {
    setOtherMode(value !== "" && !PICHICHI.includes(value));
  }, [value]);

  const country = playerCountry(value);

  return (
    <div className="future-cell">
      {country && !otherMode && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <Flag country={country} size={22} />
          <span style={{ fontSize:13, color:"var(--muted)" }}>{value.replace(/\s*\([^)]+\)/, "")}</span>
        </div>
      )}
      <select
        className="sel wide"
        disabled={disabled}
        value={otherMode ? "__otro__" : value}
        onChange={(e) => {
          if (e.target.value === "__otro__") {
            setOtherMode(true);
            onChange("");
          } else {
            setOtherMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Elige goleador…</option>
        {PICHICHI.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
        <option value="__otro__">Otro (escribir)…</option>
      </select>
      {otherMode && (
        <input
          className="inp wide"
          placeholder="Nombre del jugador…"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/* ---------------- Forma y máximo potencial ---------------- */
function getForm(player, admin) {
  const results = [];
  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    const order = R.id === "r32"
      ? R32_DATE_ORDER.filter(idx => idx < fx.length)
      : fx.map((_, i) => i);
    for (const i of order) {
      const m = fx[i];
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      if (!res || res.adv == null || res.h === "" || res.a === "") continue;
      const pred = player.preds?.[R.id]?.[id];
      if (!pred || (pred.h === "" && pred.a === "")) { results.push("skip"); continue; }
      results.push(predAdv(pred, m[0], m[1]) === res.adv ? "hit" : "miss");
    }
  }
  return results.slice(-5);
}

function maxRemaining(player, admin) {
  let max = 0;
  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    let canPleno = !!PLENO[R.id];
    let anyUnresolved = false;
    fx.forEach((m, i) => {
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      const resolved = res && res.adv != null && res.h !== "" && res.a !== "";
      if (!resolved) { anyUnresolved = true; max += 5 * R.mult; return; }
      if (canPleno) {
        const pred = player.preds?.[R.id]?.[id];
        const pa = pred ? predAdv(pred, m[0], m[1]) : null;
        if (!pa || pa !== res.adv) canPleno = false;
      }
    });
    if (canPleno && anyUnresolved) max += PLENO[R.id];
  }
  return max;
}

/* ---------------- Carrera (chart) ---------------- */
function buildHistory(players, admin) {
  const events = [];
  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    const order = R.id === "r32"
      ? R32_DATE_ORDER.filter(idx => idx < fx.length)
      : fx.map((_, i) => i);
    for (const i of order) {
      const m = fx[i];
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      if (res && res.adv != null && res.h !== "" && res.a !== "")
        events.push({ roundId: R.id, id, m, res, mult: R.mult });
    }
  }
  const histories = players.map(player => {
    let pts = 0;
    const snap = [0];
    events.forEach(ev => {
      const pred = player.preds?.[ev.roundId]?.[ev.id];
      let p = 0;
      if (pred && (pred.h !== "" || pred.a !== "")) {
        const pa = predAdv(pred, ev.m[0], ev.m[1]);
        if (pa === ev.res.adv) p += 3;
        const rh = ev.res.h90 != null && ev.res.h90 !== "" ? Number(ev.res.h90) : Number(ev.res.h);
        const ra = ev.res.a90 != null && ev.res.a90 !== "" ? Number(ev.res.a90) : Number(ev.res.a);
        if (Number(pred.h) === rh && Number(pred.a) === ra) p += 2;
        p *= ev.mult;
      }
      pts += p;
      snap.push(pts);
    });
    return { player, snap };
  });
  return { histories, events };
}

/* ---------------- Countdown al próximo partido ---------------- */
function parseMatchDateTime(dateStr, timeStr) {
  const [day, mon] = dateStr.split(" ");
  const month = mon === "Jun" ? 5 : 6; // 0-indexed
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(2026, month, parseInt(day), h - 2, m, 0)); // CEST = UTC+2
}

function findNextMatch(admin) {
  const now = new Date();
  let next = null;
  for (const origIdx of R32_DATE_ORDER) {
    const id = matchId("r32", origIdx);
    const res = admin.results?.[id];
    const resolved = res && res.adv != null && res.h !== "" && res.a !== "";
    const live = res && res.live && !resolved;
    if (resolved || live) continue;
    const dateStr = R32_DATES[origIdx];
    const timeStr = R32_TIMES[origIdx];
    if (!dateStr || !timeStr) continue;
    const kickoff = parseMatchDateTime(dateStr, timeStr);
    if (kickoff > now && (!next || kickoff < next.kickoff))
      next = { kickoff, teams: R32[origIdx], dateStr, timeStr, id: matchId("r32", origIdx) };
  }
  return next;
}

function NextMatchCountdown({ admin, players }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const next = findNextMatch(admin);
  if (!next) return null;
  const diff = next.kickoff - now;
  if (diff <= 0) return null;

  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const secs  = Math.floor((diff % 60000) / 1000);

  const showPreds = diff < 3600000; // menos de 1 hora
  const preds = showPreds && players
    ? [...players]
        .sort((a, b) => {
          const sa = scorePlayer(a, admin).total;
          const sb = scorePlayer(b, admin).total;
          return sb - sa || a.name.localeCompare(b.name, "es");
        })
        .map(p => {
          const pred = p.preds?.["r32"]?.[next.id];
          const hasPred = pred && pred.h !== "" && pred.h != null && pred.a !== "" && pred.a != null;
          const adv = hasPred ? (pred.adv || predAdv(pred, next.teams[0], next.teams[1])) : null;
          return {
            name: p.name,
            h: hasPred ? pred.h : null,
            a: hasPred ? pred.a : null,
            adv,
          };
        })
    : null;

  return (
    <div className="cd-panel">
      <div className="cd-top">
        <span className="cd-label">Próximo partido</span>
        <span className="cd-when">{next.dateStr} · {next.timeStr}h</span>
      </div>
      <div className="cd-teams">
        <span className="cd-team"><Flag country={next.teams[0]} size={18} />{next.teams[0]}</span>
        <span className="cd-vs">vs</span>
        <span className="cd-team"><Flag country={next.teams[1]} size={18} />{next.teams[1]}</span>
      </div>
      <div className="cd-timer">
        {days > 0 && <div className="cd-unit"><b>{days}</b><span>d</span></div>}
        <div className="cd-unit"><b>{String(hours).padStart(2,"0")}</b><span>h</span></div>
        <div className="cd-unit"><b>{String(mins).padStart(2,"0")}</b><span>m</span></div>
        <div className="cd-unit"><b>{String(secs).padStart(2,"0")}</b><span>s</span></div>
      </div>
      {showPreds && preds && (
        <div className="cd-preds">
          <div className="cd-preds-title">Pronósticos</div>
          <div className="cd-preds-list">
            {preds.map(({ name, h, a, adv }) => (
              <div key={name} className="cd-pred-row">
                <span className="cd-pred-name">{name}</span>
                {h != null ? (
                  <span className="cd-pred-score">
                    {h} – {a}
                    {adv && <><span className="cd-pred-arrow"> → </span><Flag country={adv} size={13} /></>}
                  </span>
                ) : (
                  <span className="cd-pred-none">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Live Match Panel ---------------- */
function LiveCard({ R, m, id, res, players, standings }) {
  const h = Number(res.h), a = Number(res.a);
  const leading = h > a ? m[0] : a > h ? m[1] : null;
  const isET = res.duration === "EXTRA_TIME" || res.duration === "PENALTY_SHOOTOUT";
  // Marcador a 90' para el check de marcador exacto (+2 pts)
  const rh90 = res.h90 != null && res.h90 !== "" ? Number(res.h90) : h;
  const ra90 = res.a90 != null && res.a90 !== "" ? Number(res.a90) : a;

  // Orden de clasificación general (standings ya viene ordenado)
  const standingOrder = standings
    ? standings.map(s => s.p.id)
    : players.map(p => p.id);

  const stats = players
    .map((p) => {
      const pred = p.preds?.[R.id]?.[id];
      if (!pred || pred.h === "" || pred.h == null || pred.a === "" || pred.a == null)
        return { p, pred: null, pa: null, advStatus: "none", scoreOk: false, pts: 0 };
      const pa = predAdv(pred, m[0], m[1]);
      const advStatus =
        leading === null ? "tied" : pa === leading ? "winning" : "losing";
      const scoreOk = Number(pred.h) === rh90 && Number(pred.a) === ra90;
      const pts = ((advStatus === "winning" ? 3 : 0) + (scoreOk ? 2 : 0)) * R.mult;
      return { p, pred, pa, advStatus, scoreOk, pts };
    })
    .sort((x, y) => standingOrder.indexOf(x.p.id) - standingOrder.indexOf(y.p.id));

  return (
    <div className="live-card">
      <div className="live-card-hdr">
        <div className="live-hdr-top">
          <span className="live-rnd">{R.name} · ×{R.mult}</span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {isET && (
              <span style={{ fontSize:10, fontWeight:900, color:"#f59e0b", background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.3)", padding:"2px 7px", borderRadius:20, letterSpacing:".05em" }}>
                PRÓRROGA
              </span>
            )}
            <span className="live-badge-pill">
              <span className="live-dot" />
              EN VIVO
            </span>
          </div>
        </div>
        <div className="live-scoreline">
          <span className="live-tn">
            <Flag country={m[0]} size={20} />
            {m[0]}
          </span>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span className="live-score-big">
              {res.h} – {res.a}
            </span>
            {isET && res.h90 != null && res.h90 !== "" && (
              <span style={{ fontSize:10, color:"rgba(255,255,255,.45)", fontFamily:"var(--mono)", fontWeight:700 }}>
                90': {res.h90}–{res.a90}
              </span>
            )}
          </div>
          <span className="live-tn right">
            {m[1]}
            <Flag country={m[1]} size={20} />
          </span>
        </div>
      </div>
      <div className="live-picks-list">
        {stats.map(({ p, pred, pa, advStatus, scoreOk, pts }) => (
          <div
            key={p.id}
            className={`lp-row lps-${advStatus}${scoreOk ? " lps-exact" : ""}`}
          >
            <span className="lp-dot" style={{ background: getPlayerColor(p.name) }} />
            <span className="lp-name">{p.name}</span>
            <span className="lp-pred">
              {pred
                ? <>{pred.h}–{pred.a}{pa && <Flag country={pa} size={10} />}</>
                : <span style={{ fontSize: 10, opacity: .5 }}>sin pick</span>
              }
            </span>
            <span className="lp-pts">
              {pts > 0 ? `+${pts}` : advStatus === "none" ? "—" : "0"}
            </span>
          </div>
        ))}
      </div>
      <p style={{ textAlign:"center", fontSize:9, color:"var(--muted)", padding:"4px 0 10px", letterSpacing:".04em", textTransform:"uppercase" }}>
        Puntos provisionales · se confirman al terminar
      </p>
    </div>
  );
}

function LiveMatchPanel({ admin, players, standings }) {
  const now = new Date();
  const liveMatches = [];
  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    fx.forEach((m, i) => {
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      if (res && res.live && res.adv == null) {
        liveMatches.push({ R, m, id, res });
      }
    });
  }

  // Si hay partido en marcha (marcado como live), prevalece sobre el countdown
  if (liveMatches.length) {
    return (
      <div className="live-panel">
        {liveMatches.map((lm) => (
          <LiveCard key={lm.id} {...lm} players={players} standings={standings} />
        ))}
      </div>
    );
  }

  // Aunque no esté marcado como live, si el kickoff ya pasó y no está resuelto,
  // ocultamos el countdown (partido en marcha sin actualizar aún)
  const anyStarted = R32_DATE_ORDER.some(origIdx => {
    const id = matchId("r32", origIdx);
    const res = admin.results?.[id];
    const resolved = res && res.adv != null && res.h !== "" && res.a !== "";
    if (resolved) return false;
    const dateStr = R32_DATES[origIdx];
    const timeStr = R32_TIMES[origIdx];
    if (!dateStr || !timeStr) return false;
    return parseMatchDateTime(dateStr, timeStr) <= now;
  });

  if (anyStarted) return null;
  return <NextMatchCountdown admin={admin} players={players} />;
}

function CarreraChart({ admin, players }) {
  const [sel, setSel] = useState(null); // null = todos visibles; Set = IDs visibles

  const { histories, events } = buildHistory(players, admin);

  if (!events.length)
    return (
      <p className="mini muted center" style={{ padding: "16px 0 4px" }}>
        La carrera empieza con el primer resultado.
      </p>
    );

  const isVisible = (id) => sel === null || sel.has(id);

  const togglePlayer = (id) => {
    setSel(prev => {
      if (prev === null) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next.size === 0 ? null : next;
      } else {
        next.add(id);
        return next.size === players.length ? null : next;
      }
    });
  };

  const W = 580, H = 220;
  const pad = { t: 28, r: 94, b: 16, l: 22 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const n = Math.max(players.length, 2);
  const steps = events.length;

  const posAt = (step) => {
    const arr = histories.map(h => ({ id: h.player.id, score: h.snap[step] }));
    arr.sort((a, b) => b.score - a.score);
    const map = {};
    let i = 0;
    while (i < arr.length) {
      let j = i;
      while (j < arr.length && arr[j].score === arr[i].score) j++;
      const avgPos = (i + j + 1) / 2;
      for (let k = i; k < j; k++) map[arr[k].id] = avgPos;
      i = j;
    }
    return map;
  };

  const allPos = Array.from({ length: steps + 1 }, (_, s) => posAt(s));

  const xs = i => pad.l + (i / steps) * iW;
  const ys = pos => pad.t + ((pos - 1) / (n - 1)) * iH;

  const makePath = (id) => {
    let d = `M ${xs(0).toFixed(1)} ${ys(allPos[0][id]).toFixed(1)}`;
    for (let i = 1; i <= steps; i++) {
      const x0 = xs(i - 1), y0 = ys(allPos[i - 1][id]);
      const x1 = xs(i), y1 = ys(allPos[i][id]);
      const mx = ((x0 + x1) / 2).toFixed(1);
      d += ` C ${mx} ${y0.toFixed(1)} ${mx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  };

  const boundaries = [];
  let curRound = null;
  events.forEach((ev, i) => {
    if (ev.roundId !== curRound) { boundaries.push({ i, roundId: ev.roundId }); curRound = ev.roundId; }
  });

  const finalPos = allPos[steps];
  const finalScore = {};
  histories.forEach(h => { finalScore[h.player.id] = h.snap[steps]; });

  const minPos = Math.min(...Object.values(finalPos));
  const drawOrder = [...histories].sort((a, b) => finalPos[b.player.id] - finalPos[a.player.id]);

  const LABEL_GAP = 13;
  const sortedForLabels = [...histories].sort((a, b) => {
    const d = finalPos[a.player.id] - finalPos[b.player.id];
    return d !== 0 ? d : a.player.name.localeCompare(b.player.name, "es");
  });
  const labelYMap = {};
  let li = 0;
  while (li < sortedForLabels.length) {
    let lj = li;
    const sharedPos = finalPos[sortedForLabels[li].player.id];
    while (lj < sortedForLabels.length && finalPos[sortedForLabels[lj].player.id] === sharedPos) lj++;
    const groupSize = lj - li;
    const centerY = ys(sharedPos);
    const totalSpan = (groupSize - 1) * LABEL_GAP;
    for (let k = 0; k < groupSize; k++) {
      labelYMap[sortedForLabels[li + k].player.id] = centerY - totalSpan / 2 + k * LABEL_GAP;
    }
    li = lj;
  }

  // Chips sorted by final score desc
  const chipOrder = [...histories].sort((a, b) => finalScore[b.player.id] - finalScore[a.player.id]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        <rect x={pad.l} y={pad.t} width={iW} height={iH} fill="rgba(0,0,0,0.28)" rx="4" />

        {Array.from({ length: n }, (_, i) => {
          const y = ys(i + 1);
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={pad.l + iW} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={pad.l - 5} y={y + 4} textAnchor="end" fontSize="9"
                fill="rgba(255,255,255,0.25)" fontWeight="700">{i + 1}º</text>
            </g>
          );
        })}

        <text x={pad.l} y={pad.t - 10} fontSize="8" fill="rgba(255,255,255,0.3)"
          letterSpacing=".04em">1º = MEJOR</text>

        {boundaries.map(({ i, roundId }) => {
          const R = ROUNDS.find(r => r.id === roundId);
          const x = xs(i);
          return (
            <g key={roundId}>
              {i > 0 && (
                <line x1={x} y1={pad.t} x2={x} y2={pad.t + iH}
                  stroke="rgba(255,255,255,0.16)" strokeWidth="1" strokeDasharray="3,3" />
              )}
              <text x={x + (i === 0 ? 0 : 3)} y={pad.t - 10} fontSize="8.5"
                fill="rgba(255,255,255,0.5)" fontWeight="800" letterSpacing=".05em">
                {R?.short?.toUpperCase()}
              </text>
            </g>
          );
        })}

        {drawOrder.map(({ player }) => {
          const color = getPlayerColor(player.name);
          const visible = isVisible(player.id);
          const isLeader = finalPos[player.id] === minPos;
          return (
            <path key={player.id}
              d={makePath(player.id)}
              fill="none"
              stroke={visible ? color : "rgba(255,255,255,0.1)"}
              strokeWidth={visible && isLeader ? 3 : visible ? 1.8 : 1}
              opacity={visible ? (isLeader ? 1 : 0.65) : 0.18}
              strokeLinecap="round"
              style={visible && isLeader ? { filter: `drop-shadow(0 0 6px ${color}bb)` } : undefined}
            />
          );
        })}

        {histories.map(({ player }) => {
          const color = getPlayerColor(player.name);
          const visible = isVisible(player.id);
          const pos = finalPos[player.id];
          const score = finalScore[player.id];
          const cx = xs(steps);
          const cy = ys(pos);
          const ly = labelYMap[player.id];
          return (
            <g key={player.id} opacity={visible ? 1 : 0.15}>
              <circle cx={cx} cy={cy} r="3.5" fill={color}
                style={visible ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
              <line x1={cx + 4} y1={cy} x2={cx + 9} y2={ly}
                stroke={color} strokeWidth="0.8" opacity="0.45" />
              <text x={cx + 11} y={ly + 4} fontSize="10" fill={color} fontWeight="800">
                {player.name}
                <tspan fontSize="8" opacity="0.55" dx="3">{score}p</tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {/* Player filter chips */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"10px 4px 2px" }}>
        <button
          onClick={() => setSel(null)}
          style={{
            padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:800,
            cursor:"pointer", border:"1px solid",
            background: sel === null ? "rgba(255,255,255,0.12)" : "transparent",
            borderColor: sel === null ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)",
            color: sel === null ? "#fff" : "rgba(255,255,255,0.4)",
            letterSpacing:".04em",
          }}
        >
          TODOS
        </button>
        {chipOrder.map(({ player }) => {
          const color = getPlayerColor(player.name);
          const active = isVisible(player.id);
          return (
            <button
              key={player.id}
              onClick={() => togglePlayer(player.id)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:800,
                cursor:"pointer", border:"1px solid",
                background: active ? `${color}22` : "transparent",
                borderColor: active ? `${color}88` : "rgba(255,255,255,0.1)",
                color: active ? color : "rgba(255,255,255,0.3)",
                letterSpacing:".03em",
                transition:"all .15s",
              }}
            >
              <span style={{
                width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: active ? color : "rgba(255,255,255,0.2)",
              }} />
              {player.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Bracket / Cuadro ---------------- */
function BracketMatch({ m, res }) {
  const resolved = res && res.adv != null && res.h !== "" && res.a !== "";
  const live = res && res.live && !resolved;
  return (
    <div className={`bm${resolved ? " bm-done" : live ? " bm-live" : ""}`}>
      <div className={`bteam${resolved ? res.adv === m[0] ? " bw" : " bl" : ""}`}>
        <Flag country={m[0]} size={13} />
        <span className="bname">{m[0]}</span>
        {(resolved || live) && <span className="bsc">{res.h}</span>}
      </div>
      <div className={`bteam${resolved ? res.adv === m[1] ? " bw" : " bl" : ""}`}>
        <Flag country={m[1]} size={13} />
        <span className="bname">{m[1]}</span>
        {(resolved || live) && <span className="bsc">{res.a}</span>}
      </div>
      {live && (
        <div className="bm-live-bar">
          <span className="live-dot" /><span style={{fontSize:9,fontWeight:900,color:"var(--red)",letterSpacing:".05em"}}>EN VIVO</span>
        </div>
      )}
    </div>
  );
}

function BracketView({ admin }) {
  const [active, setActive] = useState(admin.openRound || "r32");
  const R = ROUNDS.find(r => r.id === active) || ROUNDS[0];
  const fx = fixturesFor(admin, R.id);

  return (
    <div>
      {/* Round chips */}
      <div className="chips" style={{ marginBottom:12 }}>
        {ROUNDS.map(r => {
          const fxr = fixturesFor(admin, r.id);
          const hasData = fxr.length > 0;
          return (
            <button
              key={r.id}
              className={active === r.id ? "chip on" : "chip"}
              onClick={() => setActive(r.id)}
              style={!hasData ? { opacity:.4 } : undefined}
            >
              {r.short}
            </button>
          );
        })}
      </div>

      {/* Round header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontSize:13, fontWeight:900, textTransform:"uppercase", letterSpacing:".06em" }}>{R.name}</span>
        <span className="mult">×{R.mult}</span>
      </div>

      {/* Matches */}
      {fx.length === 0 ? (
        <p className="mini muted center" style={{ padding:"12px 0" }}>Los cruces de {R.name.toLowerCase()} aún no están cargados.</p>
      ) : (
        <div className={`bracket-grid${fx.length <= 2 ? " bracket-single" : ""}`}>
          {fx.map((m, i) => {
            const id = matchId(R.id, i);
            const res = admin.results?.[id];
            return <BracketMatch key={id} m={m} res={res} />;
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Clasificación ---------------- */
function Clasificacion({ standings, admin, meId }) {
  const [open, setOpen] = useState(null);
  if (standings.length === 0)
    return <div className="empty">Aún no hay jugadores. ¡Que entren los amigos!</div>;
  const medals = ["🥇", "🥈", "🥉"];
  const players = standings.map(s => s.p);
  const rankOf = standings.map((item) => {
    const firstIdx = standings.findIndex(s => s.s.total === item.s.total);
    return firstIdx + 1;
  });
  return (
    <div className="pane">
      <div className="board">
        {standings.map(({ p, s }, i) => {
          const rank = rankOf[i];
          const form = getForm(p, admin);
          const maxRem = maxRemaining(p, admin);
          return (
          <div key={p.id}>
            <div
              className={`row ${p.id === meId ? "me" : ""} ${rank <= 3 ? "podium" : ""}`}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <span className="rank">{medals[rank - 1] || rank}</span>
              <span className="pname">
                <span className="pname-top">
                  <span className="player-dot" style={{ background: getPlayerColor(p.name) }} />
                  {p.name}
                  {admin.champion && p.champion === admin.champion && (
                    <span className="champ-won">★ campeón</span>
                  )}
                </span>
                {form.length > 0 && (
                  <span className="form-dots">
                    {form.map((f, fi) => <span key={fi} className={`form-dot fd-${f}`} />)}
                  </span>
                )}
              </span>
              <span className="pts-wrap">
                {s.pending > 0 && <span className="pend">{s.pending} pdte.</span>}
                <span className="pts">{s.total}</span>
                {maxRem > 0 && <span className="max-rem">+{maxRem} máx</span>}
              </span>
            </div>
            {open === p.id && (
              <div className="breakdown">
                {ROUNDS.map((R) => (
                  <span key={R.id} className="bd">
                    {R.short} <b>{s.byRound[R.id] || 0}</b>
                  </span>
                ))}
                {Object.entries(s.plenos).map(([rid, pts]) => (
                  <span key={rid} className="bd green">
                    pleno {ROUNDS.find((r) => r.id === rid)?.short} <b>+{pts}</b>
                  </span>
                ))}
                {s.bonus.champion > 0 && (
                  <span className="bd gold">campeón <b>+{s.bonus.champion}</b></span>
                )}
                {s.bonus.pichichi > 0 && (
                  <span className="bd gold">pichichi <b>+{s.bonus.pichichi}</b></span>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
      <p className="mini muted center">Toca un nombre para ver el desglose por ronda.</p>

      <section className="card" style={{ padding: "14px 8px 10px" }}>
        <h3>Carrera · posición tras cada partido</h3>
        <CarreraChart admin={admin} players={players} />
      </section>

    </div>
  );
}

/* ---------------- Picks (pronósticos revelados) ---------------- */
function Picks({ admin, standings, meId }) {
  const round = ROUNDS.find((r) => r.id === admin.openRound) || ROUNDS[0];
  const locked = !!admin.locked?.[round.id];
  const fx = fixturesFor(admin, round.id);
  const [selected, setSelected] = useState([]);

  if (!locked) {
    return (
      <div className="empty">
        Los pronósticos se revelan cuando el admin cierra la ronda.<br />
        <span style={{ fontSize: 12 }}>Vuelve aquí una vez cerrada.</span>
      </div>
    );
  }

  if (fx.length === 0) {
    return <div className="empty">No hay cruces cargados para esta ronda.</div>;
  }

  const allPlayers = standings.map((s) => s.p);
  const me = allPlayers.find((p) => p.id === meId) || null;
  const others = allPlayers.filter((p) => p.id !== meId);

  const togglePlayer = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const visibleOthers =
    selected.length === 0 ? others : others.filter((p) => selected.includes(p.id));
  const visiblePlayers = [...(me ? [me] : []), ...visibleOthers];

  // Orden de visualización: cronológico para r32, original para el resto
  const displayOrder = round.id === "r32"
    ? R32_DATE_ORDER.filter(idx => idx < fx.length)
    : fx.map((_, i) => i);

  // Primer partido sin resultado en orden cronológico
  const nextI = displayOrder.find(origIdx => {
    const res = admin.results?.[matchId(round.id, origIdx)];
    return !(res && res.adv && res.h !== "" && res.a !== "");
  }) ?? -1;

  const indexedFx = displayOrder.map(origIdx => ({ m: fx[origIdx], i: origIdx }));

  return (
    <div className="pane">
      <div className="round-banner">
        <div>
          <h2>{round.name}</h2>
          <span className="mult">pronósticos revelados</span>
        </div>
      </div>

      {others.length > 0 && (
        <div>
          <p className="mini muted" style={{ marginBottom: 8 }}>Comparar con:</p>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            <button
              className={selected.length === 0 ? "chip on" : "chip"}
              onClick={() => setSelected([])}
            >
              Todos
            </button>
            {others.map((p) => (
              <button
                key={p.id}
                className={selected.includes(p.id) ? "chip on" : "chip"}
                onClick={() => togglePlayer(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="picks-scroll">
        <table className="picks-table">
          <thead>
            <tr>
              <th className="picks-match-col">Partido</th>
              {visiblePlayers.map((p) => (
                <th
                  key={p.id}
                  className={`picks-player-col${p.id === meId ? " picks-me-col" : ""}`}
                >
                  <span className="player-dot" style={{ background: getPlayerColor(p.name) }} />
                  {p.id === meId ? "Yo" : p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indexedFx.map(({ m, i }) => {
              const id = matchId(round.id, i);
              const res = admin.results?.[id];
              const resolved = res && res.adv != null && res.h !== "" && res.a !== "";
              const isLive   = res && res.live && !resolved;
              const isNext = i === nextI;
              const hideOthers = !resolved && !isLive && !isNext;

              // Consenso: cuántos jugadores apostaron por cada equipo
              const consHome = allPlayers.filter(pl => {
                const pr = pl.preds?.[round.id]?.[id];
                return pr && predAdv(pr, m[0], m[1]) === m[0];
              }).length;
              const consAway = allPlayers.filter(pl => {
                const pr = pl.preds?.[round.id]?.[id];
                return pr && predAdv(pr, m[0], m[1]) === m[1];
              }).length;
              const consTotal = allPlayers.filter(pl => {
                const pr = pl.preds?.[round.id]?.[id];
                return pr && (pr.h !== "" || pr.a !== "");
              }).length;

              return (
                <tr key={id} className={`picks-row${hideOthers ? " picks-row-hidden" : ""}`}>
                  <td className="picks-match-cell">
                    {round.id === "r32" && R32_DATES[i] && (
                      <div className="match-date">
                        {R32_DATES[i]}{R32_TIMES[i] ? <span className="match-time"> · {R32_TIMES[i]}</span> : ""}
                      </div>
                    )}
                    <div className="picks-teams">
                      <span><Flag country={m[0]} size={13} /> {m[0]}</span>
                      <span><Flag country={m[1]} size={13} /> {m[1]}</span>
                    </div>
                    {resolved && (
                      <div className="picks-result">
                        {res.h}–{res.a}
                        {res.h90 != null && res.h90 !== "" && (String(res.h90) !== String(res.h) || String(res.a90) !== String(res.a)) && (
                          <span style={{ opacity:.65, fontSize:9, marginLeft:3 }}>(90': {res.h90}–{res.a90})</span>
                        )}
                        {" · "}<Flag country={res.adv} size={11} />
                      </div>
                    )}
                    {isLive && (
                      <div className="live-score">
                        <span className="live-dot" />
                        <span className="live-label">EN VIVO</span>
                        <span className="live-nums">{res.h}–{res.a}</span>
                      </div>
                    )}
                    {isNext && !resolved && !isLive && (
                      <div className="picks-next-badge">Próximo</div>
                    )}
                    {consTotal > 0 && (
                      <div className="consensus">
                        <div className="cons-bar">
                          <div className="cons-h" style={{ flex: consHome || 0.01 }} />
                          <div className="cons-none" style={{ flex: Math.max(0, consTotal - consHome - consAway) }} />
                          <div className="cons-a" style={{ flex: consAway || 0.01 }} />
                        </div>
                        <div className="cons-nums">
                          <span className="cons-hn"><Flag country={m[0]} size={9}/> {consHome}</span>
                          <span className="cons-an">{consAway} <Flag country={m[1]} size={9}/></span>
                        </div>
                      </div>
                    )}
                  </td>
                  {visiblePlayers.map((p) => {
                    const isMe = p.id === meId;
                    const pred = p.preds?.[round.id]?.[id];
                    const pa = pred ? predAdv(pred, m[0], m[1]) : null;
                    const advOk = resolved && pa === res.adv;
                    const rh90 = resolved ? (res.h90 != null && res.h90 !== "" ? Number(res.h90) : Number(res.h)) : null;
                    const ra90 = resolved ? (res.a90 != null && res.a90 !== "" ? Number(res.a90) : Number(res.a)) : null;
                    const scoreOk = resolved && pred &&
                      Number(pred.h) === rh90 &&
                      Number(pred.a) === ra90;
                    const noPred = !pred || (pred.h === "" && pred.a === "");
                    const hidden = hideOthers && !isMe;
                    return (
                      <td
                        key={p.id}
                        className={`picks-cell${isMe ? " picks-me-cell" : ""}${scoreOk ? " score-ok" : advOk ? " adv-ok" : ""}`}
                      >
                        {hidden ? (
                          <span className="picks-hidden">🔒</span>
                        ) : noPred ? (
                          <span className="picks-empty">—</span>
                        ) : (
                          <>
                            <div className="picks-score">{pred.h}–{pred.a}</div>
                            {pa && <div className="picks-adv"><Flag country={pa} size={13} /></div>}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mini muted center">
        🟢 Acertó quién pasa · 🟡 Además acertó el marcador exacto
      </p>
    </div>
  );
}

/* ---------------- Reglas ---------------- */
function Reglas() {
  return (
    <div className="pane reglas">
      <Card title="Cómo se puntúa">
        <ul>
          <li><b>+3</b> por acertar quién pasa la eliminatoria (en 90', prórroga o penaltis).</li>
          <li><b>+2</b> por acertar el resultado exacto <b>a los 90 minutos</b>.</li>
          <li>Son dos aciertos independientes: puedes llevarte uno, los dos o ninguno.</li>
        </ul>
      </Card>
      <Card title="Multiplicadores por ronda">
        <div className="mult-grid">
          {ROUNDS.map((R) => (
            <div key={R.id} className="mult-cell">
              <span>{R.short}</span>
              <b>x{R.mult}</b>
            </div>
          ))}
        </div>
        <div className="mult-rows">
          {ROUNDS.map((R) => {
            const fxN = R.id === "r32" ? 16 : R.id === "r16" ? 8 : R.id === "qf" ? 4 : R.id === "sf" ? 2 : 1;
            return (
              <div key={R.id} className="mult-r">
                <span>{R.name}</span>
                <span className="muted">{fxN} × 5 × {R.mult}</span>
                <b>{fxN * 5 * R.mult} pts</b>
              </div>
            );
          })}
          <div className="mult-r total">
            <span>Total de rondas</span>
            <span></span>
            <b>205 pts</b>
          </div>
        </div>
        <p className="mini muted">
          Sin multiplicador, semis y final valdrían una miseria. Subir por partido desde
          cuartos deja un 41% de los puntos para el final, así el rezagado remonta — pero
          la final se queda en x3 para que un solo partido con suerte no tumbe al líder.
        </p>
      </Card>
      <Card title="Apuestas de futuro (al inicio)">
        <ul>
          <li>Campeón: <b>+{BONUS.champion}</b> (exacto, sin consolación).</li>
          <li>Pichichi (máximo goleador): <b>+{BONUS.pichichi}</b>.</li>
        </ul>
        <p className="mini muted">
          Se eligen antes de dieciseisavos y se resuelven al final: mantienen vivo al
          rezagado hasta el último partido.
        </p>
      </Card>
      <Card title="Pleno de ronda">
        <ul>
          <li>Aciertas quién pasa en <b>todos</b> los partidos de la ronda.</li>
          <li>Dieciseisavos: <b>+{PLENO.r32}</b> · Octavos: <b>+{PLENO.r16}</b> · Cuartos: <b>+{PLENO.qf}</b>.</li>
        </ul>
        <p className="mini muted">
          Premia la ronda perfecta. Semis y final no tienen pleno (con 2 y 1 partido sería
          trivial). Bote total de bonus: {BONUS_TOTAL} pts (~17% del juego).
        </p>
      </Card>
      <Card title="Empates a 90'">
        <p>
          Si pronosticas empate (ej. 1-1), tienes que decir además quién pasa. Si pones
          un marcador con ganador (ej. 2-1), ya lleva implícito quién pasa.
        </p>
      </Card>
    </div>
  );
}

/* ================================================================
   AdminPage — ruta /admin
================================================================ */
function AdminPage() {
  const [admin, setAdmin] = useState(DEFAULT_ADMIN);
  const [adminMode, setAdminMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from("v_admin").select("*").single();
    if (data) {
      setAdmin({
        openRound: data.open_round || "r32",
        locked: data.locked || {},
        fixtures: data.fixtures || {},
        results: data.results || {},
        champion: data.champion || "",
        pichichi: data.pichichi || "",
        adminClaimed: data.admin_claimed,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Auto-login if secret stored
    const stored = localStorage.getItem("porra_admin_secret");
    if (stored) {
      supabase.rpc("admin_login", { p_secret: stored }).then(({ data }) => {
        if (data) setAdminMode(true);
        else localStorage.removeItem("porra_admin_secret");
      });
    }
  }, [load]);

  const saveAdmin = async (newAdmin) => {
    const adminSecret = localStorage.getItem("porra_admin_secret");
    if (!adminSecret) return;
    setSaving(true);
    const patch = {
      open_round: newAdmin.openRound,
      locked: newAdmin.locked,
      fixtures: newAdmin.fixtures,
      results: newAdmin.results,
      champion: newAdmin.champion,
      pichichi: newAdmin.pichichi,
    };
    const { data } = await supabase.rpc("admin_save", {
      p_admin_secret: adminSecret,
      p_patch: patch,
    });
    if (data) setAdmin(newAdmin);
    else await load();
    setSaving(false);
    flash(data ? "Guardado ✓" : "Error al guardar");
  };

  const handleClaim = async () => {
    const secret = crypto.randomUUID();
    const { data } = await supabase.rpc("admin_claim", { p_secret: secret });
    if (data) {
      localStorage.setItem("porra_admin_secret", secret);
      setAdminMode(true);
      flash("Panel reclamado ✓");
    } else {
      flash("Ya hay un admin registrado. Usa tu enlace.");
    }
  };

  const handleLogin = async (secret) => {
    const { data } = await supabase.rpc("admin_login", { p_secret: secret });
    if (data) {
      localStorage.setItem("porra_admin_secret", secret);
      setAdminMode(true);
      return null;
    }
    return "Secreto incorrecto";
  };

  const handleLogout = () => {
    localStorage.removeItem("porra_admin_secret");
    setAdminMode(false);
  };

  return (
    <div className="porra">
      <style>{CSS}</style>
      <header className="hdr">
        <div className="hdr-mark">
          <span className="ball">⚽</span>
          <div>
            <h1>ADMIN · PORRA MUNDIAL 2026</h1>
            <p>
              <a href="/" className="link" style={{ fontSize: 12 }}>
                ← Volver al juego
              </a>
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : adminMode ? (
        <AdminPanel admin={admin} saveAdmin={saveAdmin} onLogout={handleLogout} flash={flash} />
      ) : (
        <AdminLogin
          adminClaimed={admin.adminClaimed}
          onClaim={handleClaim}
          onLogin={handleLogin}
        />
      )}

      {saving && <div className="saving">guardando…</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------------- Admin login / claim ---------------- */
function AdminLogin({ adminClaimed, onClaim, onLogin }) {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");

  const tryLogin = async () => {
    setErr("");
    if (!secret.trim()) return setErr("Pega tu secreto de admin");
    const error = await onLogin(secret.trim());
    if (error) setErr(error);
  };

  return (
    <div className="pane">
      <Card title="Modo administrador">
        {!adminClaimed ? (
          <>
            <p className="muted">
              Nadie ha reclamado el panel aún. Pulsa el botón para reclamar el rol
              de admin. Tu secreto se guardará en este navegador.
            </p>
            <button className="btn" style={{ marginTop: 12 }} onClick={onClaim}>
              Reclamar panel de admin
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              El panel ya tiene un admin. Si eres tú y tienes este navegador,
              deberías entrar automáticamente. Si no, pega tu secreto de admin:
            </p>
            <div className="ident-pick" style={{ marginTop: 8 }}>
              <input
                className="inp"
                placeholder="Secreto de admin"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              />
              <button className="btn" onClick={tryLogin}>
                Entrar
              </button>
            </div>
            {err && <p className="ident-err">{err}</p>}
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Force sync button ---------------- */
function ForceSyncButton({ flash }) {
  const [syncing, setSyncing] = useState(false);

  const doSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-results");
      const data = await res.json();
      if (data.ok) {
        flash(`Sync OK · ${data.updated} actualizados, ${data.live} en vivo`);
      } else {
        flash("Error al sincronizar");
      }
    } catch {
      flash("Error de red al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button className="btn sm" onClick={doSync} disabled={syncing}>
      {syncing ? "Sincronizando…" : "Forzar sync ahora"}
    </button>
  );
}

/* ---------------- Admin panel (tras login) ---------------- */
function AdminPanel({ admin, saveAdmin, onLogout, flash }) {
  const round = ROUNDS.find((r) => r.id === admin.openRound) || ROUNDS[0];
  const fx = fixturesFor(admin, round.id);

  const setResult = (id, patch) => {
    const cur = admin.results?.[id] || { h: "", a: "", adv: "" };
    const next = { ...admin.results, [id]: { ...cur, ...patch, manualOverride: true } };
    saveAdmin({ ...admin, results: next });
  };

  const unlockResult = (id) => {
    const cur = admin.results?.[id] || {};
    const next = { ...admin.results, [id]: { ...cur, manualOverride: false } };
    saveAdmin({ ...admin, results: next });
  };

  return (
    <div className="pane">
      <Card title="Ronda abierta">
        <div className="chips">
          {ROUNDS.map((R) => (
            <button
              key={R.id}
              className={admin.openRound === R.id ? "chip on" : "chip"}
              onClick={() => saveAdmin({ ...admin, openRound: R.id })}
            >
              {R.short}
            </button>
          ))}
        </div>
        <label className="lock-toggle">
          <input
            type="checkbox"
            checked={!!admin.locked?.[round.id]}
            onChange={(e) =>
              saveAdmin({
                ...admin,
                locked: { ...admin.locked, [round.id]: e.target.checked },
              })
            }
          />
          Cerrar pronósticos de {round.name.toLowerCase()} (bloquea ediciones)
        </label>
      </Card>

      {round.id !== "r32" && (
        <FixtureEditor admin={admin} saveAdmin={saveAdmin} roundId={round.id} />
      )}

      <Card title={`Resultados · ${round.name}`}>
        {fx.length === 0 ? (
          <p className="muted">Carga primero los cruces de esta ronda.</p>
        ) : (
          <div className="matches">
            {fx.map((m, i) => {
              const id = matchId(round.id, i);
              const r = admin.results?.[id] || { h: "", a: "", adv: "" };
              const draw = r.h !== "" && r.a !== "" && Number(r.h) === Number(r.a);
              return (
                <div key={id} className="match">
                  <div className="m-team left">{m[0]}</div>
                  <div className="m-score">
                    <input
                      className="score"
                      inputMode="numeric"
                      value={r.h}
                      onChange={(e) =>
                        setResult(id, { h: e.target.value.replace(/\D/g, "") })
                      }
                    />
                    <span className="dash">–</span>
                    <input
                      className="score"
                      inputMode="numeric"
                      value={r.a}
                      onChange={(e) =>
                        setResult(id, { a: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                  <div className="m-team right">{m[1]}</div>
                  <div className="adv-row">
                    <span className="adv-label">Pasa:</span>
                    <button
                      className={r.adv === m[0] ? "adv on" : "adv"}
                      onClick={() => setResult(id, { adv: m[0] })}
                    >
                      {m[0]}
                    </button>
                    <button
                      className={r.adv === m[1] ? "adv on" : "adv"}
                      onClick={() => setResult(id, { adv: m[1] })}
                    >
                      {m[1]}
                    </button>
                  </div>
                  <div className="adv-row" style={{ marginTop:8, paddingTop:8, borderTop:"1px dashed rgba(255,255,255,.08)" }}>
                    <span className="adv-label">Marcador 90'</span>
                    <input
                      className="score"
                      style={{ width:40, height:36, fontSize:16 }}
                      inputMode="numeric"
                      placeholder="—"
                      value={r.h90 ?? ""}
                      onChange={(e) => setResult(id, { h90: e.target.value.replace(/\D/g, "") })}
                    />
                    <span className="dash" style={{ fontSize:14 }}>–</span>
                    <input
                      className="score"
                      style={{ width:40, height:36, fontSize:16 }}
                      inputMode="numeric"
                      placeholder="—"
                      value={r.a90 ?? ""}
                      onChange={(e) => setResult(id, { a90: e.target.value.replace(/\D/g, "") })}
                    />
                    <span className="adv-label" style={{ opacity:.55, fontWeight:600 }}>solo si hubo prórroga/penaltis</span>
                  </div>
                  <div className="adv-row" style={{ marginTop:6, paddingTop:6, borderTop:"1px dashed rgba(255,255,255,.05)", gap:8 }}>
                    {r.manualOverride ? (
                      <>
                        <span style={{ fontSize:11, color:"var(--gold)", fontWeight:700 }}>🔒 auto-sync pausado</span>
                        <button
                          className="btn sm"
                          style={{ fontSize:10, padding:"4px 8px", background:"transparent", border:"1px solid var(--muted)", color:"var(--muted)" }}
                          onClick={() => unlockResult(id)}
                        >
                          Reactivar sync
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize:10, color:"var(--muted)", opacity:.5 }}>auto-sync activo</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Resolver apuestas de futuro (al acabar el torneo)">
        <label className="fut-label">Campeón</label>
        <select
          className="sel wide"
          value={admin.champion || ""}
          onChange={(e) => saveAdmin({ ...admin, champion: e.target.value })}
        >
          <option value="">Sin definir</option>
          {TEAMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label className="fut-label">Pichichi (máximo goleador)</label>
        <PichichiPicker
          value={admin.pichichi || ""}
          onChange={(v) => saveAdmin({ ...admin, pichichi: v })}
        />
        <p className="mini muted">
          Elige del mismo listado que los jugadores: así el cruce de nombres es exacto y
          los +{BONUS.pichichi} se reparten solos.
        </p>
      </Card>

      <Card title="Sincronización automática">
        <p className="muted" style={{fontSize:13}}>
          Para que los resultados se actualicen solos, añade <code>ADMIN_SECRET</code> como
          variable de entorno en Vercel con el valor de abajo.
        </p>
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          <button
            className="btn sm"
            onClick={() => {
              const s = localStorage.getItem("porra_admin_secret") || "";
              navigator.clipboard.writeText(s);
              alert("Secreto copiado: " + s);
            }}
          >
            Copiar ADMIN_SECRET
          </button>
          <ForceSyncButton flash={flash} />
        </div>
      </Card>

      <LoginLog />

      <button className="link" onClick={onLogout}>
        Salir de admin
      </button>
    </div>
  );
}

/* ---------------- Login log (admin) ---------------- */
function LoginLog() {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const secret = localStorage.getItem("porra_admin_secret") || "";
    const { data } = await supabase.rpc("admin_get_login_log", { p_admin_secret: secret });
    setLog(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const METHOD_LABEL = {
    register: "Registro nuevo",
    link: "Enlace personal",
    session: "Sesión",
    recovery: "Recuperación",
  };

  const fmt = (ts) =>
    new Date(ts).toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <Card title="Registro de accesos">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn sm" onClick={load} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : !log?.length ? (
        <p className="muted">Sin accesos registrados aún.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.15)" }}>
                {["Jugador", "Fecha y hora", "Tipo"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "var(--gold)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <td style={{ padding: "5px 8px" }}>{entry.player_name}</td>
                  <td style={{ padding: "5px 8px", fontVariantNumeric: "tabular-nums" }}>{fmt(entry.logged_at)}</td>
                  <td style={{ padding: "5px 8px", color: "var(--muted)" }}>{METHOD_LABEL[entry.method] || entry.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FixtureEditor({ admin, saveAdmin, roundId }) {
  const existing = admin.fixtures?.[roundId] || [];
  const [rows, setRows] = useState(
    existing.length ? existing : [["", ""]]
  );
  useEffect(() => {
    setRows((admin.fixtures?.[roundId] || []).length ? admin.fixtures[roundId] : [["", ""]]);
  }, [roundId]); // eslint-disable-line

  const update = (i, side, v) => {
    const c = rows.map((r) => [...r]);
    c[i][side] = v;
    setRows(c);
  };
  const save = () => {
    const clean = rows.filter((r) => r[0].trim() && r[1].trim());
    saveAdmin({ ...admin, fixtures: { ...admin.fixtures, [roundId]: clean } });
  };

  return (
    <Card title="Cargar cruces de esta ronda">
      {rows.map((r, i) => (
        <div key={i} className="fix-row">
          <input
            className="inp"
            placeholder="Local"
            value={r[0]}
            onChange={(e) => update(i, 0, e.target.value)}
          />
          <span className="vs">vs</span>
          <input
            className="inp"
            placeholder="Visitante"
            value={r[1]}
            onChange={(e) => update(i, 1, e.target.value)}
          />
        </div>
      ))}
      <div className="fix-actions">
        <button className="btn sm" onClick={() => setRows([...rows, ["", ""]])}>
          + Añadir cruce
        </button>
        <button className="btn sm" onClick={save}>
          Guardar cruces
        </button>
      </div>
    </Card>
  );
}

/* ---------------- bits ---------------- */
function Card({ title, children }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/* ---------------- styles ---------------- */
const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

.porra{
  --bg:transparent;
  --panel:rgba(4,14,5,.82);
  --panel2:rgba(6,20,7,.88);
  --line:rgba(80,160,80,.18);
  --txt:#e8f5e9;
  --muted:#7aaa82;
  --green:#e8f0e8;
  --green-dim:#7a9e80;
  --gold:#fcd34d;
  --gold2:#f59e0b;
  --red:#f87171;
  --blue:#60a5fa;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  background:transparent;
  color:var(--txt);
  min-height:100vh;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  max-width:680px;
  margin:0 auto;
  padding:0 0 72px;
  position:relative;
  z-index:1;
}

/* ── Header ─────────────────────────────────────────────── */
.hdr{
  position:relative;
  padding:0 0 14px;
  background:rgba(3,12,4,.9);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(180,210,180,.15);
  overflow:hidden;
  display:flex;flex-direction:column;gap:0;
}
.hdr::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(180,210,180,.03) 0%,transparent 100%);
  pointer-events:none;
}

/* Scrolling flag banner */
.flag-strip{
  overflow:hidden;white-space:nowrap;
  background:rgba(0,0,0,.3);
  border-bottom:1px solid rgba(255,255,255,.06);
  padding:5px 0;
}
.flag-strip-inner{
  display:inline-block;
  animation:marquee 28s linear infinite;
}
.flag-strip span{
  display:inline-block;font-size:18px;margin:0 6px;
}
@keyframes marquee{
  from{transform:translateX(0)}
  to{transform:translateX(-50%)}
}

.hdr-mark{
  display:flex;align-items:center;gap:14px;
  padding:16px 16px 0;position:relative;
}
.ball{
  font-size:38px;
  filter:drop-shadow(0 0 12px rgba(220,240,220,.3));
  animation:spin 10s linear infinite;
  flex-shrink:0;
}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.hdr-titles{flex:1}
.hdr h1{
  margin:0;font-size:19px;font-weight:900;
  letter-spacing:.12em;text-transform:uppercase;
  background:linear-gradient(90deg,#ffffff 30%,var(--green) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.hdr-sub{
  margin:4px 0 0;font-size:11px;color:var(--muted);
  letter-spacing:.05em;
}

/* ── Identity ────────────────────────────────────────────── */
.ident{font-size:13px;position:relative}
.ident-me{display:flex;align-items:center;gap:10px}
.ident-me strong{color:var(--green);font-size:14px}
.ident-pick{display:flex;gap:6px;flex-wrap:wrap;align-items:stretch}
.ident-pick .inp{flex:1;min-width:100px}
.inp.pin{width:88px;flex:none;text-align:center;letter-spacing:.12em}
.ident-err{color:var(--red);font-size:12px;margin:5px 0 0}
.link-box{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  background:#071209;border:1px solid rgba(200,220,200,.2);
  border-radius:10px;padding:10px 12px;
}
.personal-link{font-size:11px;color:var(--green);word-break:break-all;flex:1;opacity:.85}

/* ── Tabs ────────────────────────────────────────────────── */
.tabs{
  display:flex;gap:6px;padding:10px 12px;
  background:rgba(3,12,4,.92);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(255,255,255,.07);
  position:sticky;top:0;z-index:10;
}
.tab{
  flex:1;padding:10px 4px;border:0;border-radius:10px;
  background:transparent;color:var(--muted);
  font-weight:700;font-size:13px;cursor:pointer;
  transition:all .15s;
}
.tab.on{
  background:rgba(255,255,255,.08);
  color:var(--green);
  box-shadow:0 0 0 1px rgba(255,255,255,.18);
}

/* ── Pane / Empty ────────────────────────────────────────── */
.pane{padding:14px 12px;display:flex;flex-direction:column;gap:14px}
.empty{
  padding:48px 20px;text-align:center;
  color:var(--muted);font-size:14px;line-height:1.6;
}

/* ── Apuestas de futuro ──────────────────────────────────── */
.champ-pick{
  background:linear-gradient(160deg,#1c1000 0%,#110d00 50%,#0c1220 100%);
  border:1px solid rgba(255,215,0,.2);
  border-top:3px solid var(--gold);
  border-radius:14px;padding:16px;
  position:relative;overflow:hidden;
}
.champ-pick::after{
  content:'🏆';
  position:absolute;right:12px;bottom:-4px;
  font-size:64px;opacity:.08;pointer-events:none;
}
.champ-head{
  display:flex;align-items:center;gap:8px;
  font-weight:900;font-size:14px;margin-bottom:14px;
  flex-wrap:wrap;text-transform:uppercase;letter-spacing:.08em;
}
.gold{color:var(--gold)}
.bonus-tag{
  margin-left:auto;font-size:10px;color:var(--gold);
  background:rgba(255,215,0,.08);
  border:1px solid rgba(255,215,0,.25);padding:4px 10px;border-radius:20px;
  font-weight:800;letter-spacing:.04em;
}
.future-grid{display:flex;flex-direction:column;gap:12px}
.future-cell{display:flex;flex-direction:column;gap:6px}
.future-cell label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.inp.wide,.sel.wide{width:100%}
.fut-label{display:block;font-size:12px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.06em;margin:14px 0 5px}
.fut-label:first-child{margin-top:0}

/* ── Round banner ────────────────────────────────────────── */
.round-banner{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 2px 4px;
  border-bottom:2px solid var(--line);
}
.round-banner h2{
  margin:0;font-size:22px;font-weight:900;
  text-transform:uppercase;letter-spacing:.08em;
}
.mult{
  font-size:11px;color:var(--green);font-weight:800;
  background:#001a0a;border:1px solid var(--green-dim);
  padding:3px 8px;border-radius:20px;letter-spacing:.04em;
}
.locked-pill{
  font-size:11px;color:var(--red);border:1px solid var(--red);
  padding:3px 9px;border-radius:20px;font-weight:700;
  background:rgba(255,61,90,.08);
}

/* ── Date headers ───────────────────────────────────────── */
.date-header{
  font-size:10px;font-weight:800;text-transform:uppercase;
  letter-spacing:.07em;color:var(--muted);padding:2px 4px;
  border-left:2px solid var(--green-dim);
}
.date-header-time{color:var(--green);font-variant-numeric:tabular-nums}

/* ── Partidos ────────────────────────────────────────────── */
.matches{display:flex;flex-direction:column;gap:10px}
.match{
  background:linear-gradient(135deg,#071209 0%,#050e07 100%);
  border:1px solid var(--line);
  border-left:3px solid var(--green-dim);
  border-radius:14px;
  padding:14px 12px;
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;gap:8px;
  position:relative;overflow:hidden;
}
.match::before{
  content:'⚽';
  position:absolute;right:10px;bottom:-8px;
  font-size:48px;opacity:.035;pointer-events:none;
}
.m-team{line-height:1.3}
.m-team.left{
  display:flex;align-items:center;justify-content:flex-end;gap:6px;
}
.m-team.right{
  display:flex;align-items:center;justify-content:flex-start;gap:6px;
}
.team-flag{font-size:24px;flex-shrink:0}
.team-name{font-size:12px;font-weight:700;color:var(--txt);line-height:1.3}
.m-score{display:flex;align-items:center;gap:5px}
.score{
  width:48px;height:48px;text-align:center;
  font-family:var(--mono);font-size:22px;font-weight:900;
  background:#000814;color:var(--green);
  border:1px solid #00331a;border-radius:8px;
  font-variant-numeric:tabular-nums;
  text-shadow:none;
  caret-color:var(--green);
}
.score:focus{outline:none;border-color:var(--green-dim);box-shadow:0 0 0 2px rgba(220,240,220,.12)}
.score:disabled{opacity:.45;text-shadow:none}
.dash{color:var(--muted);font-weight:900;font-size:20px}
.adv-row{
  grid-column:1/-1;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  margin-top:6px;padding-top:10px;border-top:1px dashed var(--line);
}
.adv-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:700}
.adv{
  background:var(--panel2);border:1px solid var(--line);color:var(--muted);
  padding:7px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;
  transition:all .15s;
}
.adv:not(:disabled):hover{border-color:var(--green);color:var(--txt)}
.adv.on{
  background:linear-gradient(135deg,#2a4a30,#3d6645);
  color:#fff;border-color:rgba(200,220,200,.4);
  box-shadow:none;
}

/* ── Resultado de partido ────────────────────────────────── */
.match-played{border-left-color:rgba(100,200,100,.35)}
.match-result{
  grid-column:1/-1;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);
}
.mr-badge{
  font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;
  letter-spacing:.04em;
}
.mr-badge.ok{background:rgba(44,160,44,.18);color:#7ecf7e;border:1px solid rgba(44,160,44,.3)}
.mr-badge.miss{background:rgba(248,113,113,.1);color:rgba(248,113,113,.7);border:1px solid rgba(248,113,113,.2)}
.mr-pts{margin-left:auto;font-size:12px;font-weight:900;font-family:var(--mono)}
.mr-pts.pts-ok{color:var(--gold)}
.mr-pts.pts-zero{color:var(--muted)}

/* ── cd-pred-arrow ───────────────────────────────────────── */
.cd-pred-arrow{color:var(--muted);font-size:10px;margin:0 2px}

/* ── Botones ─────────────────────────────────────────────── */
.btn{
  background:linear-gradient(135deg,#2e5c38,#4a7a54);
  color:#e8f0e8;border:1px solid rgba(200,220,200,.2);border-radius:10px;
  padding:12px 18px;font-weight:900;cursor:pointer;font-size:14px;
  letter-spacing:.03em;transition:transform .1s,opacity .15s;
}
.btn:active{transform:scale(.97);opacity:.9}
.btn:disabled{opacity:.3;cursor:default;transform:none}
.btn.big{
  width:100%;padding:16px;font-size:16px;letter-spacing:.08em;
  text-transform:uppercase;border-radius:12px;
  box-shadow:0 6px 24px rgba(0,0,0,.4);
}
.btn.sm{padding:8px 14px;font-size:13px}
.link{
  background:0;border:0;color:var(--muted);text-decoration:underline;
  cursor:pointer;font-size:12px;padding:4px;
}
.sel,.inp{
  background:var(--panel2);color:var(--txt);
  border:1px solid var(--line);border-radius:10px;
  padding:10px 12px;font-size:14px;
  -webkit-appearance:none;
}
.sel:focus,.inp:focus{outline:none;border-color:var(--green-dim);box-shadow:0 0 0 2px rgba(200,220,200,.1)}
.sel.wide{width:100%}
.inp{min-width:90px}

/* ── Clasificación ───────────────────────────────────────── */
.board{display:flex;flex-direction:column;gap:8px}
.row{
  display:flex;align-items:center;gap:10px;padding:14px 12px;
  background:var(--panel);border:1px solid var(--line);
  border-radius:13px;cursor:pointer;transition:all .15s;
}
.row:active{transform:scale(.99)}
.row.podium{background:linear-gradient(135deg,#121e30,#0f1828)}
.row:nth-child(1) .row{border-left:3px solid var(--gold)}
.row.me{border-color:rgba(200,220,200,.4);box-shadow:0 0 0 1px rgba(200,220,200,.1)}
.rank{width:32px;text-align:center;font-weight:900;font-size:20px;color:var(--muted)}
.pname{flex:1;font-weight:700;font-size:15px;display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}
.pname-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.form-dots{display:flex;gap:4px;padding-left:18px}
.form-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.fd-hit{background:#2CA02C;box-shadow:0 0 4px #2CA02C80}
.fd-miss{background:#D62728;box-shadow:0 0 4px #D6272880}
.fd-skip{background:rgba(255,255,255,0.18)}
.pts-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
.max-rem{font-size:9px;color:var(--muted);font-weight:700;white-space:nowrap}
.consensus{margin-top:6px}
.cons-bar{height:5px;border-radius:3px;overflow:hidden;display:flex;gap:1px;background:rgba(255,255,255,0.06)}
.cons-h{background:#2CA02C;border-radius:3px 0 0 3px}
.cons-a{background:#D62728;border-radius:0 3px 3px 0}
.cons-none{background:rgba(255,255,255,0.1)}
.cons-nums{display:flex;justify-content:space-between;font-size:9px;font-weight:800;margin-top:3px}
.cons-hn{color:#2CA02C;display:flex;align-items:center;gap:3px}
.cons-an{color:#D62728;display:flex;align-items:center;gap:3px}
.player-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;vertical-align:middle}
.champ-won{
  font-size:10px;color:var(--gold);
  background:linear-gradient(135deg,rgba(255,215,0,.12),rgba(255,152,0,.08));
  border:1px solid rgba(255,215,0,.3);padding:2px 8px;border-radius:20px;font-weight:900;
}
.pend{font-size:11px;color:var(--muted)}
.pts{
  font-family:var(--mono);font-size:26px;font-weight:900;color:var(--green);
  font-variant-numeric:tabular-nums;
  text-shadow:none;
}
.breakdown{
  display:flex;gap:8px;flex-wrap:wrap;
  padding:8px 12px 6px;font-size:12px;color:var(--muted);
  border-top:1px solid var(--line);
}
.bd b{color:var(--txt)}
.bd.gold b{color:var(--gold)}
.bd.green b{color:var(--green)}

/* ── Reglas ──────────────────────────────────────────────── */
.mult-rows{display:flex;flex-direction:column;gap:0;margin:10px 0}
.mult-r{
  display:grid;grid-template-columns:1fr auto auto;gap:10px;
  align-items:center;padding:9px 4px;
  border-bottom:1px solid var(--line);font-size:13px;
}
.mult-r b{color:var(--green);font-variant-numeric:tabular-nums;font-family:var(--mono)}
.mult-r.total{
  border-bottom:0;border-top:2px solid var(--green);
  margin-top:4px;font-weight:800;
}
.mult-r.total b{color:var(--gold)}
.mult-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px}
.mult-cell{
  background:var(--panel2);border:1px solid var(--line);
  border-radius:10px;padding:10px 4px;text-align:center;
}
.mult-cell span{display:block;font-size:9px;color:var(--muted);margin-bottom:4px;
  text-transform:uppercase;letter-spacing:.04em}
.mult-cell b{color:var(--green);font-size:18px;font-weight:900}

/* ── Cards ───────────────────────────────────────────────── */
.card{
  background:var(--panel);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid var(--line);
  border-radius:14px;padding:16px;
}
.card h3{
  margin:0 0 14px;font-size:13px;font-weight:800;
  text-transform:uppercase;letter-spacing:.08em;color:var(--muted);
}
.card ul{margin:0;padding-left:18px;line-height:1.8;font-size:14px}
.card p{margin:0;line-height:1.6;font-size:14px}

/* ── Admin ───────────────────────────────────────────────── */
.chips,.fix-actions{display:flex;gap:6px;flex-wrap:wrap}
.chip{
  background:var(--panel2);border:1px solid var(--line);color:var(--muted);
  padding:9px 14px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;
  transition:all .15s;
}
.chip.on{background:rgba(200,220,200,.15);color:var(--green);border-color:rgba(200,220,200,.3)}
.lock-toggle{
  display:flex;align-items:center;gap:8px;margin-top:14px;
  font-size:13px;color:var(--muted);cursor:pointer;
}
.lock-toggle input{width:16px;height:16px;cursor:pointer}
.fix-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.fix-row .inp{flex:1;min-width:0}
.vs{color:var(--muted);font-size:12px;font-weight:700}

/* ── Misc ────────────────────────────────────────────────── */
.muted{color:var(--muted)}
.mini{font-size:12px}
.center{text-align:center}
.reglas{gap:12px}
.saving{position:fixed;bottom:80px;left:16px;font-size:12px;color:var(--muted);z-index:20}
.toast{
  position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
  background:rgba(30,60,35,.97);
  border:1px solid rgba(200,220,200,.25);
  color:#e8f0e8;font-weight:900;padding:11px 22px;
  border-radius:30px;font-size:14px;
  box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:50;
  white-space:nowrap;
  backdrop-filter:blur(12px);
}

/* ── Responsive móvil ────────────────────────────────────── */
/* ── Picks ───────────────────────────────────────────────── */
.live-score{
  display:flex;align-items:center;gap:5px;margin-top:4px;
}
.live-dot{
  width:7px;height:7px;border-radius:50%;background:var(--red);flex-shrink:0;
  animation:livepulse 1.1s ease-in-out infinite;
}
@keyframes livepulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
.live-label{font-size:9px;font-weight:900;color:var(--red);letter-spacing:.06em;text-transform:uppercase}
.live-nums{font-size:11px;font-weight:900;color:var(--txt);font-family:var(--mono)}
.picks-next-badge{
  display:inline-block;margin-top:4px;font-size:10px;font-weight:800;
  color:var(--gold);background:rgba(255,215,0,.1);
  border:1px solid rgba(255,215,0,.3);padding:2px 7px;border-radius:20px;
  text-transform:uppercase;letter-spacing:.05em;
}
.picks-hidden{color:var(--muted);font-size:14px;opacity:.5}
.picks-row-hidden td{opacity:.55}
.picks-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px;border:1px solid var(--line)}
.picks-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--panel)}
.picks-table th{
  background:var(--panel2);color:var(--muted);font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.04em;padding:10px 8px;
  border-bottom:2px solid var(--line);white-space:nowrap;
}
.picks-match-col{text-align:left;min-width:130px;position:sticky;left:0;background:var(--panel2);z-index:2}
.picks-player-col{text-align:center;min-width:72px}
.picks-row:not(:last-child) td{border-bottom:1px solid var(--line)}
.picks-match-cell{
  padding:10px 8px;position:sticky;left:0;
  background:var(--panel);z-index:1;
}
.match-date{font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;opacity:.7}
.match-time{color:var(--green);opacity:1;font-variant-numeric:tabular-nums}
.picks-teams{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:600}
.picks-teams span{display:flex;align-items:center;gap:5px}
.picks-result{font-size:10px;color:var(--green);margin-top:4px;font-family:var(--mono);display:flex;align-items:center;gap:3px}
.picks-cell{text-align:center;padding:10px 6px;transition:background .15s}
.picks-cell.adv-ok{background:rgba(0,230,118,.1)}
.picks-cell.score-ok{background:rgba(255,193,7,.15)}
.picks-me-col{color:var(--green);background:rgba(255,255,255,.04)}
.picks-me-cell{background:rgba(255,255,255,.03);border-left:2px solid rgba(200,220,200,.15);border-right:2px solid rgba(200,220,200,.15)}
.picks-score{font-family:var(--mono);font-weight:800;font-size:13px}
.picks-adv{margin-top:4px;display:flex;justify-content:center}
.picks-empty{color:var(--muted);font-size:16px}

/* ── Live match panel ─────────────────────────────────── */
.live-panel{padding:10px 12px 4px;display:flex;flex-direction:column;gap:10px}
.live-card{
  background:linear-gradient(135deg,rgba(26,5,5,.97) 0%,rgba(14,4,4,.99) 100%);
  border:1px solid rgba(248,113,113,.22);
  border-top:3px solid var(--red);
  border-radius:14px;overflow:hidden;
}
.live-card-hdr{padding:12px 14px 10px;border-bottom:1px solid rgba(248,113,113,.12)}
.live-hdr-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.live-rnd{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.live-badge-pill{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:900;color:var(--red);letter-spacing:.06em}
.live-scoreline{display:flex;align-items:center;justify-content:space-between;gap:6px}
.live-tn{font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;flex:1}
.live-tn.right{justify-content:flex-end}
.live-score-big{
  font-size:32px;font-weight:900;font-family:var(--mono);
  color:#fff;letter-spacing:.04em;flex-shrink:0;
  text-shadow:0 0 24px rgba(248,113,113,.55);
}
.live-picks-list{padding:4px 0}
.lp-row{
  display:flex;align-items:center;gap:8px;
  padding:8px 14px;font-size:12px;
  border-bottom:1px solid rgba(255,255,255,.04);
  transition:background .15s;
}
.lp-row:last-child{border-bottom:0}
.lps-winning{background:rgba(44,160,44,.09)}
.lps-winning.lps-exact{background:rgba(252,211,77,.11)}
.lps-losing{background:rgba(214,39,40,.06)}
.lps-tied{background:rgba(107,114,128,.05)}
.lps-none{opacity:.5}
.lp-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.lp-name{flex:1;font-weight:700}
.lp-pred{
  display:flex;align-items:center;gap:4px;
  font-family:var(--mono);font-size:11px;color:var(--muted);
  min-width:58px;justify-content:flex-end;
}
.lps-winning .lp-pred{color:var(--txt)}
.lps-winning.lps-exact .lp-pred{color:var(--gold)}
.lp-pts{
  font-weight:900;font-family:var(--mono);
  min-width:28px;text-align:right;font-size:14px;
}
.lps-winning .lp-pts{color:#2CA02C}
.lps-winning.lps-exact .lp-pts{color:var(--gold)}
.lps-losing .lp-pts,.lps-tied .lp-pts,.lps-none .lp-pts{color:var(--muted)}

/* ── Countdown ───────────────────────────────────────────── */
.cd-panel{
  margin:0 12px 4px;padding:14px 16px;
  background:linear-gradient(135deg,#071a09,#041209);
  border:1px solid rgba(100,200,100,.2);border-radius:14px;
  display:flex;flex-direction:column;gap:10px;
}
.cd-top{display:flex;align-items:center;justify-content:space-between}
.cd-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cd-when{font-size:11px;font-weight:700;color:var(--green)}
.cd-teams{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.cd-team{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800}
.cd-vs{font-size:11px;color:var(--muted);font-weight:700}
.cd-timer{display:flex;justify-content:center;gap:12px}
.cd-unit{display:flex;flex-direction:column;align-items:center;min-width:42px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  border-radius:10px;padding:8px 4px 6px}
.cd-unit b{font-size:24px;font-weight:900;font-family:var(--mono);color:#fff;line-height:1;font-variant-numeric:tabular-nums}
.cd-unit span{font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.cd-preds{border-top:1px solid rgba(255,255,255,.08);padding-top:10px;display:flex;flex-direction:column;gap:6px}
.cd-preds-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cd-preds-list{display:flex;flex-direction:column;gap:4px}
.cd-pred-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.cd-pred-name{font-weight:600;color:rgba(255,255,255,.75)}
.cd-pred-score{font-family:var(--mono);font-weight:900;font-size:13px;color:var(--green)}
.cd-pred-none{color:var(--muted);font-size:13px}

/* ── Bracket ─────────────────────────────────────────────── */
.bracket-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bracket-single{grid-template-columns:1fr}
.bm{
  background:var(--panel);border:1px solid var(--line);
  border-radius:12px;overflow:hidden;
}
.bm-done{border-color:rgba(100,180,100,.2)}
.bm-live{border-color:rgba(248,113,113,.35);border-top:2px solid var(--red)}
.bteam{
  display:flex;align-items:center;gap:7px;
  padding:8px 10px;font-size:11px;font-weight:600;
  border-bottom:1px solid var(--line);
}
.bteam:last-of-type{border-bottom:0}
.bname{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bsc{font-family:var(--mono);font-size:14px;font-weight:900;color:var(--green);margin-left:auto;flex-shrink:0}
.bw{background:rgba(44,160,44,.13);font-weight:900;color:#fff}
.bw .bsc{color:var(--gold)}
.bl{opacity:.38}
.bm-live-bar{
  display:flex;align-items:center;gap:5px;
  padding:4px 10px;background:rgba(248,113,113,.07);
}

/* ── Botón de música (header) ────────────────────────────── */
.music-btn{
  width:38px;height:38px;border-radius:50%;flex-shrink:0;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);
  font-size:18px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:transform .1s,box-shadow .15s,background .2s;
}
.music-btn:hover{background:rgba(255,255,255,.13)}
.music-btn:active{transform:scale(.88)}
.music-attract{
  animation:musicAttract 1s ease-in-out 4;
}
@keyframes musicAttract{
  0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(120,220,120,0)}
  30%{transform:scale(1.22);box-shadow:0 0 0 7px rgba(120,220,120,.25)}
  60%{transform:scale(1.08);box-shadow:0 0 0 13px rgba(120,220,120,0)}
}

@media(max-width:480px){
  .hdr h1{font-size:16px;letter-spacing:.08em}
  .ball{font-size:32px}
  .hdr-sub{font-size:10px}
  .ident-pick{flex-direction:column}
  .ident-pick .inp,.ident-pick .btn{width:100%}
  .inp.pin{width:100%;text-align:left}
  .team-flag{font-size:20px}
  .team-name{font-size:11px}
  .score{width:44px;height:44px;font-size:20px}
  .pts{font-size:22px}
  .pname{font-size:13px}
  .tabs{
    position:fixed;bottom:0;left:0;right:0;top:auto;
    border-top:1px solid rgba(255,255,255,.06);border-bottom:none;
    padding:8px 10px 14px;
    background:rgba(3,12,4,.96);
    backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  }
  .porra{padding-bottom:80px}
  .saving,.toast{bottom:90px}
  .tab{font-size:12px;padding:9px 2px}
  .flag-strip span{font-size:16px}
}
`;
