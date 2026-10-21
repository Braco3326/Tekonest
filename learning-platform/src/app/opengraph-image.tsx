import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tech Nest — Réussir le BTS Audiovisuel option Métiers du Son";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0e13",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#171c25",
              border: "2px solid #303948",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 8, height: 26, borderRadius: 2, background: "#e8b04b" }} />
            <div style={{ width: 8, height: 18, borderRadius: 2, background: "#3ddc97" }} />
            <div style={{ width: 8, height: 22, borderRadius: 2, background: "#5aa9f2" }} />
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#e9edf3" }}>
            Tech<span style={{ color: "#e8b04b" }}>&nbsp;Nest</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              color: "#e9edf3",
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            Le BTS Son se prépare
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              color: "#e8b04b",
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            épreuve par épreuve.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: 10, background: "#3ddc97" }} />
          <div style={{ display: "flex", fontSize: 26, color: "#9aa4b2" }}>
            Cours gratuits · Annales officielles E3 PTES · Référentiel RNCP37196
          </div>
        </div>
      </div>
    ),
    size
  );
}
