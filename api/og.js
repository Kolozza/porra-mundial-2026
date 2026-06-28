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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b1e0d",
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0px, rgba(255,255,255,.03) 56px, rgba(0,0,0,.10) 56px, rgba(0,0,0,.10) 112px)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        },
      },
      // Círculo central decorativo
      React.createElement("div", {
        style: {
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,.05)",
        },
      }),
      React.createElement("div", {
        style: {
          position: "absolute",
          width: "88%",
          height: 2,
          backgroundColor: "rgba(255,255,255,.05)",
        },
      }),
      // Contenido principal
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            zIndex: 1,
          },
        },
        // Pelota
        React.createElement(
          "div",
          { style: { fontSize: 96, lineHeight: 1, marginBottom: 16 } },
          "\u26BD"
        ),
        // Titulo
        React.createElement(
          "div",
          {
            style: {
              fontSize: 80,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              textAlign: "center",
              lineHeight: 1,
            },
          },
          "LA PORRA"
        ),
        // Subtitulo
        React.createElement(
          "div",
          {
            style: {
              fontSize: 54,
              fontWeight: 900,
              color: "#8aab8e",
              letterSpacing: "0.08em",
              marginTop: 10,
              textAlign: "center",
            },
          },
          "MUNDIAL 2026"
        ),
        // Descripcion
        React.createElement(
          "div",
          {
            style: {
              fontSize: 26,
              color: "rgba(255,255,255,.45)",
              marginTop: 28,
              textAlign: "center",
              letterSpacing: "0.04em",
            },
          },
          "Pronostica con tus amigos \u00B7 Ronda a ronda"
        ),
        // Sedes
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              marginTop: 32,
              background: "rgba(122,158,128,.12)",
              border: "1px solid rgba(122,158,128,.25)",
              borderRadius: 40,
              padding: "12px 32px",
              color: "#8aab8e",
              fontWeight: 700,
              letterSpacing: "0.06em",
              fontSize: 22,
            },
          },
          "USA \u00B7 Canada \u00B7 Mexico 2026"
        )
      ),
      // Trofeo esquina
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            bottom: 32,
            right: 48,
            fontSize: 80,
            opacity: 0.12,
          },
        },
        "\uD83C\uDFC6"
      )
    ),
    { width: 1200, height: 630 }
  );
}
