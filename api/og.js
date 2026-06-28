import { ImageResponse } from "@vercel/og";
import React from "react";

export default function handler() {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0b1e0d",
        },
      },
      // Lado izquierdo — texto
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "52px 60px",
            background:
              "linear-gradient(135deg, #0b1e0d 0%, #0d2310 60%, #091a0b 100%)",
            position: "relative",
          },
        },
        // Líneas de campo decorativas
        React.createElement("div", {
          style: {
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,.05)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          },
        }),
        React.createElement("div", {
          style: {
            position: "absolute",
            width: "100%",
            height: "1.5px",
            backgroundColor: "rgba(255,255,255,.04)",
            top: "50%",
          },
        }),
        // Pelota
        React.createElement(
          "div",
          { style: { fontSize: 68, lineHeight: 1, marginBottom: 20, zIndex: 1 } },
          "\u26BD"
        ),
        // LA PORRA
        React.createElement(
          "div",
          {
            style: {
              fontSize: 66,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              zIndex: 1,
            },
          },
          "LA PORRA"
        ),
        // MUNDIAL 2026
        React.createElement(
          "div",
          {
            style: {
              fontSize: 40,
              fontWeight: 900,
              color: "#8aab8e",
              letterSpacing: "0.1em",
              marginTop: 10,
              zIndex: 1,
            },
          },
          "MUNDIAL 2026"
        ),
        // Separador
        React.createElement("div", {
          style: {
            width: 48,
            height: 3,
            backgroundColor: "#8aab8e",
            borderRadius: 2,
            marginTop: 28,
            opacity: 0.5,
            zIndex: 1,
          },
        }),
        // Descripción
        React.createElement(
          "div",
          {
            style: {
              fontSize: 20,
              color: "rgba(255,255,255,.45)",
              marginTop: 28,
              lineHeight: 1.6,
              zIndex: 1,
            },
          },
          "Pronostica los partidos"
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: 20,
              color: "rgba(255,255,255,.45)",
              lineHeight: 1.6,
              zIndex: 1,
            },
          },
          "con tus amigos \u00B7 Ronda a ronda"
        ),
        // Badge sedes
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              marginTop: 36,
              background: "rgba(122,158,128,.12)",
              border: "1px solid rgba(122,158,128,.28)",
              borderRadius: 30,
              padding: "10px 22px",
              color: "#8aab8e",
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: "0.04em",
              zIndex: 1,
            },
          },
          "\uD83C\uDFC6 USA \u00B7 Canad\u00E1 \u00B7 M\u00E9xico"
        )
      ),
      // Lado derecho — foto
      React.createElement("img", {
        src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
        style: {
          width: 460,
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
        },
      })
    ),
    { width: 1200, height: 630 }
  );
}
