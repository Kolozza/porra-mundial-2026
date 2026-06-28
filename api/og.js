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
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0b1e0d",
        },
      },
      // Imagen arriba
      React.createElement("img", {
        src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
        style: {
          width: "100%",
          height: 460,
          objectFit: "cover",
          objectPosition: "center 15%",
        },
      }),
      // Texto abajo
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0b1e0d",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 52,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            },
          },
          "La Porra \u00B7 Mundial 2026"
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
