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
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b1e0d",
        },
      },
      React.createElement("img", {
        src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        style: { objectFit: "contain" },
      })
    ),
    { width: 1200, height: 630 }
  );
}
