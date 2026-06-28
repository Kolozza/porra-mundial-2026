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
          flexDirection: "column",
          backgroundColor: "#0b1e0d",
          fontFamily: "system-ui, sans-serif",
        },
      },
      // Foto arriba
      React.createElement("img", {
        src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
        width: 1200,
        height: 460,
        style: { objectFit: "cover", objectPosition: "center 10%" },
      }),
      // Texto abajo
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 170,
            backgroundColor: "#0b1e0d",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 58,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "0.06em",
            },
          },
          "LA PORRA \u00B7 MUNDIAL 2026"
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
