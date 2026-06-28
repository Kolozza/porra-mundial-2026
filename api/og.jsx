import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b1e0d",
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0px, rgba(255,255,255,.03) 56px, rgba(0,0,0,.10) 56px, rgba(0,0,0,.10) 112px)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Líneas del campo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Círculo central */}
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.08)",
              position: "absolute",
            }}
          />
          {/* Línea central */}
          <div
            style={{
              position: "absolute",
              width: "88%",
              height: 2,
              backgroundColor: "rgba(255,255,255,.07)",
            }}
          />
          {/* Punto central */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,.12)",
              position: "absolute",
            }}
          />
        </div>

        {/* Borde del campo */}
        <div
          style={{
            position: "absolute",
            inset: 32,
            border: "2px solid rgba(255,255,255,.07)",
            borderRadius: 4,
            display: "flex",
          }}
        />

        {/* Contenido principal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            zIndex: 1,
          }}
        >
          {/* Pelota */}
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 16 }}>⚽</div>

          {/* Título */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            LA PORRA
          </div>

          {/* Subtítulo */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: "#4ade80",
              letterSpacing: "0.08em",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            MUNDIAL 2026
          </div>

          {/* Descripción */}
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,.5)",
              marginTop: 24,
              textAlign: "center",
              letterSpacing: "0.04em",
            }}
          >
            Pronostica con tus amigos · Ronda a ronda
          </div>

          {/* Sedes */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 28,
              fontSize: 36,
              background: "rgba(74,222,128,.1)",
              border: "1px solid rgba(74,222,128,.2)",
              borderRadius: 40,
              padding: "10px 28px",
              color: "#4ade80",
              fontWeight: 700,
              letterSpacing: "0.06em",
              fontSize: 22,
            }}
          >
            🇺🇸 USA · 🇨🇦 Canadá · 🇲🇽 México
          </div>
        </div>

        {/* Trofeo esquina */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 48,
            fontSize: 72,
            opacity: 0.15,
          }}
        >
          🏆
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
