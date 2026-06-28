import { ImageResponse } from "@vercel/og";
import React from "react";

export const config = { runtime: "edge" };

export default function handler() {
  return new ImageResponse(
    React.createElement("img", {
      src: "https://porra-mundial-2026-seven-tau.vercel.app/og-image.jpg",
      width: 800,
      height: 800,
      style: { objectFit: "cover" },
    }),
    { width: 800, height: 800 }
  );
}
