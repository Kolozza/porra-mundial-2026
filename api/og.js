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
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b1e0d",
          fontFamily: "system-ui, sans-serif",
        },
      },
      React.createElement(
        "div",
        { style: { fontSize: 96, marginBottom: 24 } },
        "\u26BD"
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "0.06em",
          },
        },
        "LA PORRA"
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: 52,
            fontWeight: 700,
            color: "#8aab8e",
            letterSpacing: "0.12em",
            marginTop: 12,
          },
        },
        "MUNDIAL 2026"
      )
    ),
    { width: 1200, height: 630 }
  );
}
