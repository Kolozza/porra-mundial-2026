import React, { useState, useEffect, useCallback } from "react";
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
  0:"28 Jun", 2:"29 Jun", 3:"29 Jun", 1:"29 Jun",
  5:"30 Jun", 4:"30 Jun", 6:"30 Jun",
  7:"1 Jul",  8:"1 Jul",  9:"1 Jul",
  10:"2 Jul", 11:"2 Jul", 12:"2 Jul",
  13:"3 Jul", 14:"3 Jul", 15:"3 Jul",
};

const PLAYER_COLORS = {
  "Matias":  "#74ACDF",  // albiceleste
  "Niko":    "#ef4444",  // rojo
  "Gentjan": "#FFFFFF",  // blanco
  "Alex":    "#ADFF2F",  // fluorescente
  "Ray":     "#1F77B4",  // azul
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
      if (Number(pred.h) === Number(res.h) && Number(pred.a) === Number(res.a))
        pts += 2;
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
      ) : tab === "jugar" ? (
        <Jugar admin={admin} me={me} onSave={handleSave} />
      ) : tab === "clasi" ? (
        <Clasificacion standings={standings} admin={admin} meId={meId} />
      ) : tab === "picks" ? (
        <Picks admin={admin} standings={standings} meId={meId} />
      ) : (
        <Reglas />
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

  return (
    <div className="pane">
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
          {fx.map((m, i) => {
            const id = matchId(round.id, i);
            const p = draft.preds[round.id]?.[id] || { h: "", a: "", adv: "" };
            const isDraw =
              p.h !== "" && p.a !== "" && Number(p.h) === Number(p.a);
            return (
              <MatchRow
                key={id}
                home={m[0]}
                away={m[1]}
                pred={p}
                draw={isDraw}
                locked={locked}
                onScore={(side, v) =>
                  setPred(id, { [side]: v === "" ? "" : Math.max(0, Number(v)) })
                }
                onAdv={(team) => setPred(id, { adv: team })}
              />
            );
          })}
        </div>
      )}

      {!locked && fx.length > 0 && (
        <button className="btn big" onClick={save}>
          Guardar mis pronósticos
        </button>
      )}
    </div>
  );
}

function MatchRow({ home, away, pred, draw, locked, onScore, onAdv }) {
  return (
    <div className="match">
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
    fx.forEach((m, i) => {
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      if (!res || res.adv == null || res.h === "" || res.a === "") return;
      const pred = player.preds?.[R.id]?.[id];
      if (!pred || (pred.h === "" && pred.a === "")) { results.push("skip"); return; }
      results.push(predAdv(pred, m[0], m[1]) === res.adv ? "hit" : "miss");
    });
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
  if (!admin.champion) max += BONUS.champion;
  if (!admin.pichichi) max += BONUS.pichichi;
  return max;
}

/* ---------------- Carrera (chart) ---------------- */
function buildHistory(players, admin) {
  const events = [];
  for (const R of ROUNDS) {
    const fx = fixturesFor(admin, R.id);
    fx.forEach((m, i) => {
      const id = matchId(R.id, i);
      const res = admin.results?.[id];
      if (res && res.adv != null && res.h !== "" && res.a !== "")
        events.push({ roundId: R.id, id, m, res, mult: R.mult });
    });
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
        if (Number(pred.h) === Number(ev.res.h) && Number(pred.a) === Number(ev.res.a)) p += 2;
        p *= ev.mult;
      }
      pts += p;
      snap.push(pts);
    });
    return { player, snap };
  });
  return { histories, events };
}

function CarreraChart({ admin, players }) {
  const { histories, events } = buildHistory(players, admin);

  if (!events.length)
    return (
      <p className="mini muted center" style={{ padding: "16px 0 4px" }}>
        La carrera empieza con el primer resultado.
      </p>
    );

  const W = 580, H = 240;
  const pad = { t: 18, r: 82, b: 26, l: 30 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const steps = events.length;
  const maxPts = Math.max(...histories.map(h => h.snap[h.snap.length - 1]), 10);

  const xs = i => pad.l + (i / steps) * iW;
  const ys = v => pad.t + iH - (v / maxPts) * iH;

  // Round start markers
  const boundaries = [];
  let curRound = null;
  events.forEach((ev, i) => {
    if (ev.roundId !== curRound) { boundaries.push({ i, roundId: ev.roundId }); curRound = ev.roundId; }
  });

  // Y grid ticks
  const tickStep = maxPts <= 15 ? 5 : maxPts <= 40 ? 10 : maxPts <= 80 ? 20 : 50;
  const ticks = [];
  for (let v = 0; v <= maxPts; v += tickStep) ticks.push(v);

  // Sort histories by final score desc to layer lower scores above higher (draw on top)
  const sorted = [...histories].sort((a, b) => a.snap[a.snap.length - 1] - b.snap[b.snap.length - 1]);

  // Offset overlapping labels
  const labelPositions = [];
  const labelsSorted = [...histories].sort((a, b) => b.snap[b.snap.length - 1] - a.snap[a.snap.length - 1]);
  labelsSorted.forEach((h, idx) => {
    const raw = ys(h.snap[h.snap.length - 1]);
    const prev = labelPositions[idx - 1];
    labelPositions.push(prev != null && prev - raw < 13 ? prev - 13 : raw);
  });
  const labelMap = {};
  labelsSorted.forEach((h, idx) => { labelMap[h.player.id] = labelPositions[idx]; });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#031a06" />
          <stop offset="100%" stopColor="#010c03" />
        </linearGradient>
      </defs>

      {/* Field */}
      <rect x={pad.l} y={pad.t} width={iW} height={iH} fill="url(#cg)" rx="3" />
      {Array.from({ length: 7 }).map((_, k) => (
        <rect key={k} x={pad.l + k * (iW / 7)} y={pad.t} width={iW / 14} height={iH}
          fill="rgba(255,255,255,0.013)" />
      ))}

      {/* Y grid */}
      {ticks.map(v => (
        <g key={v}>
          <line x1={pad.l} y1={ys(v)} x2={pad.l + iW} y2={ys(v)}
            stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={pad.l - 4} y={ys(v) + 3.5} textAnchor="end" fontSize="9"
            fill="rgba(255,255,255,0.3)">{v}</text>
        </g>
      ))}

      {/* Round boundaries */}
      {boundaries.map(({ i, roundId }) => {
        const x = xs(i);
        const R = ROUNDS.find(r => r.id === roundId);
        return (
          <g key={roundId}>
            <line x1={x} y1={pad.t} x2={x} y2={pad.t + iH}
              stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={x + 3} y={pad.t + iH + 16} fontSize="9"
              fill="rgba(255,255,255,0.4)">{R?.short}</text>
          </g>
        );
      })}

      {/* Lines (sorted: winner on top) */}
      {sorted.map(({ player, snap }) => {
        const color = getPlayerColor(player.name);
        const pts = snap.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
        const lx = xs(snap.length - 1);
        const ly = labelMap[player.id];
        const dotY = ys(snap[snap.length - 1]);
        return (
          <g key={player.id}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${color}80)` }} />
            <line x1={lx} y1={dotY} x2={lx + 6} y2={ly}
              stroke={color} strokeWidth="1" opacity="0.5" />
            <circle cx={lx} cy={dotY} r="4" fill={color}
              style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
            <text x={lx + 9} y={ly + 4} fontSize="10.5" fill={color} fontWeight="800">
              {player.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- Clasificación ---------------- */
function Clasificacion({ standings, admin, meId }) {
  const [open, setOpen] = useState(null);
  if (standings.length === 0)
    return <div className="empty">Aún no hay jugadores. ¡Que entren los amigos!</div>;
  const medals = ["🥇", "🥈", "🥉"];
  const players = standings.map(s => s.p);
  return (
    <div className="pane">
      <div className="board">
        {standings.map(({ p, s }, i) => {
          const form = getForm(p, admin);
          const maxRem = maxRemaining(p, admin);
          return (
          <div key={p.id}>
            <div
              className={`row ${p.id === meId ? "me" : ""} ${i < 3 ? "podium" : ""}`}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <span className="rank">{medals[i] || i + 1}</span>
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
        <h3>Carrera de puntos</h3>
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
                      <div className="match-date">{R32_DATES[i]}</div>
                    )}
                    <div className="picks-teams">
                      <span><Flag country={m[0]} size={13} /> {m[0]}</span>
                      <span><Flag country={m[1]} size={13} /> {m[1]}</span>
                    </div>
                    {resolved && (
                      <div className="picks-result">
                        {res.h}–{res.a} · <Flag country={res.adv} size={11} />
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
                    const scoreOk = resolved && pred &&
                      Number(pred.h) === Number(res.h) &&
                      Number(pred.a) === Number(res.a);
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
        <AdminPanel admin={admin} saveAdmin={saveAdmin} onLogout={handleLogout} />
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

/* ---------------- Admin panel (tras login) ---------------- */
function AdminPanel({ admin, saveAdmin, onLogout }) {
  const round = ROUNDS.find((r) => r.id === admin.openRound) || ROUNDS[0];
  const fx = fixturesFor(admin, round.id);

  const setResult = (id, patch) => {
    const cur = admin.results?.[id] || { h: "", a: "", adv: "" };
    const next = { ...admin.results, [id]: { ...cur, ...patch } };
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
        <button
          className="btn sm"
          style={{marginTop:10}}
          onClick={() => {
            const s = localStorage.getItem("porra_admin_secret") || "";
            navigator.clipboard.writeText(s);
            alert("Secreto copiado: " + s);
          }}
        >
          Copiar ADMIN_SECRET
        </button>
      </Card>

      <button className="link" onClick={onLogout}>
        Salir de admin
      </button>
    </div>
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
