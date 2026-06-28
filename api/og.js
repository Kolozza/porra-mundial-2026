import { ImageResponse } from "@vercel/og";
import React from "react";

export const config = { runtime: "edge" };

export default function handler() {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#0b1e0d",
          fontFamily: "system-ui, sans-serif",
        },
      },
      // Foto ocupando todo
      React.createElement("img", {
        src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        style: { objectFit: "cover", objectPosition: "center 35%" },
      }),
      // Gradiente + texto superpuesto abajo
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.6) 60%, transparent 100%)",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 54,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "0.06em",
              textShadow: "0 2px 12px rgba(0,0,0,.8)",
            },
          },
          "LA PORRA \u00B7 MUNDIAL 2026"
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
