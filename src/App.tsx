// // src/App.tsx


// src/App.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import DeckGL from "@deck.gl/react";
import type { JSX } from "react";
import { BitmapLayer } from "@deck.gl/layers";
import { TileLayer, type TileLayerProps } from "@deck.gl/geo-layers";
import Map from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import layersIndex from "./assets/layers_index.json";

/* =========================
   Types
========================= */
type LayerRec = {
    category: "dem" | "flood_scenarios" | string;
    name: string;
    dem?: string | null;
    hand?: string | null;
    flood?: string | null; // e.g. "5m"
};

type DemLevels = Record<string, string[]>; // DEM -> ["1m","5m",...]
type DemLevelToHand = Record<string, Record<string, string>>; // DEM -> { "5m": "hand_2000" }

/* =========================
   Constants
========================= */
const TC_BASE = import.meta.env.DEV ? "/tc" : "https://geohydroai.org/tc";
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
const HAS_MAPBOX = Boolean(MAPBOX_TOKEN);

const DASH_HOME = "/";

const COLORS = {
    dem: "#2dd4bf",    // бірюзовий
    floodA: "#60a5fa", // синій
    floodB: "#f87171", // червоний
} as const;

/* =========================
   Styles
========================= */
const panelStyle: CSSProperties = {
    position: "absolute",
    zIndex: 10,
    left: 10,
    top: 10,
    background: "#111",
    color: "#eee",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    width: 280
};
const groupTitle: CSSProperties = {
    margin: "10px 0 8px",
    fontSize: 12,
    letterSpacing: 0.2,
    color: "#9ca3af",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 8,
};
const dotStyle = (color: string): CSSProperties => ({
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: color,
    boxShadow: "0 0 0 2px rgba(255,255,255,.06)"
});
const selectStyle: CSSProperties = {
    width: "100%",
    background: "#1b1b1b",
    color: "#eee",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "6px 8px",
    outline: "none"
};
const checkRow: CSSProperties = { display: "flex", gap: 8, alignItems: "center", margin: "6px 0" };
const sliderStyle: CSSProperties = { width: "100%", marginTop: 4 };
const homeBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    padding: "8px 12px",
    borderRadius: 10,
    background: "#198754",
    color: "#fff",
    fontWeight: 600,
    textDecoration: "none",
    border: 0,
    cursor: "pointer"
};

/* =========================
   Helpers
========================= */
const parseLevel = (s: string): number => Number(String(s).toLowerCase().replace("m", "").trim());

const buildDemUrl = (dem: string, cmap: string, stretch: readonly [number, number]): string =>
    `${TC_BASE}/singleband/dem/${dem}/{z}/{x}/{y}.png?colormap=${cmap}&stretch_range=[${stretch[0]},${stretch[1]}]`;

const buildFloodUrl = (
    dem: string,
    hand: string,
    level: string,
    cmap: string,
    stretch: readonly [number, number],
    pureBlue = false
): string => {
    const layer = `${dem}_${hand}_flood_${level}`;
    const base = `${TC_BASE}/singleband/flood_scenarios/${layer}/{z}/{x}/{y}.png`;
    return pureBlue
        ? `${base}?colormap=custom&colors=0000ff&stretch_range=[${stretch[0]},${stretch[1]}]`
        : `${base}?colormap=${cmap}&stretch_range=[${stretch[0]},${stretch[1]}]`;
};

const pickDefaultLevel = (levels: string[]): string =>
    levels.includes("5m") ? "5m" : (levels[0] ?? "");

/* =========================
   Component
========================= */
export default function App(): JSX.Element {
    /* 1) індекс шарів */
    const [index] = useState<LayerRec[]>(layersIndex as LayerRec[]);

    /* 2) словники */
    const { DEM_LIST, DEM_LEVELS, DEM_LEVEL_TO_HAND } = useMemo(() => {
        const demSet = new Set<string>();
        const tmpLevels: Record<string, Set<string>> = {};
        const tmpLevel2hand: Record<string, Set<string>> = {};

        for (const r of index) {
            if (r.category === "dem" && r.name) demSet.add(r.name);
            if (r.category === "flood_scenarios" && r.dem && r.flood) {
                (tmpLevels[r.dem] ??= new Set()).add(r.flood);
                const key = `${r.dem}|${r.flood}`;
                (tmpLevel2hand[key] ??= new Set()).add(r.hand ?? "");
            }
        }

        const demList = Array.from(demSet).sort();
        const demLevels: DemLevels = {};
        const demLevelToHand: DemLevelToHand = {};

        for (const d of demList) {
            const levels = Array.from(tmpLevels[d] ?? []).sort((a, b) => parseLevel(a) - parseLevel(b));
            demLevels[d] = levels;
            demLevelToHand[d] = {};
            for (const l of levels) {
                const hands = Array.from(tmpLevel2hand[`${d}|${l}`] ?? []);
                demLevelToHand[d][l] = hands.includes("hand_2000") ? "hand_2000" : (hands[0] ?? "");
            }
        }
        return { DEM_LIST: demList, DEM_LEVELS: demLevels, DEM_LEVEL_TO_HAND: demLevelToHand };
    }, [index]);

    /* ---------- UI state ---------- */
    // DEM
    const [demName, setDemName] = useState<string>("");
    const [showDem, setShowDem] = useState<boolean>(false);
    const [opacityDEM, setOpacityDEM] = useState<number>(0.30);
    const demCmap = "terrain" as const;
    const demStretch: readonly [number, number] = [250, 2200];

    // Flood A (blues)
    const [demA, setDemA] = useState<string>("");
    const [levelA, setLevelA] = useState<string>(""); // ніколи не undefined
    const [showFloodA, setShowFloodA] = useState<boolean>(true);
    const [opacityA, setOpacityA] = useState<number>(0.60);
    const floodCmapA = "blues" as const;
    const floodStretchA: readonly [number, number] = [0, 5];

    // Flood B (reds)
    const [demB, setDemB] = useState<string>("");
    const [levelB, setLevelB] = useState<string>("");
    const [showFloodB, setShowFloodB] = useState<boolean>(true);
    const [opacityB, setOpacityB] = useState<number>(0.45);
    const floodCmapB = "reds" as const;
    const floodStretchB: readonly [number, number] = [0, 5];

    // дефолти
    useEffect(() => {
        if (!demName && DEM_LIST.length) setDemName(DEM_LIST[0]);
        if (!demA && DEM_LIST.length) setDemA(DEM_LIST[0]);
        if (!demB && DEM_LIST.length) setDemB(DEM_LIST.length > 1 ? DEM_LIST[1] : DEM_LIST[0]);
    }, [DEM_LIST, demName, demA, demB]);

    // рівні: оновлюємо тільки коли поточний невалідний
    useEffect(() => {
        if (!demA) { setLevelA(""); return; }
        const lvls = DEM_LEVELS[demA] ?? [];
        if (!lvls.length) { setLevelA(""); return; }
        if (!lvls.includes(levelA)) setLevelA(pickDefaultLevel(lvls));
    }, [demA, DEM_LEVELS, levelA]);

    useEffect(() => {
        if (!demB) { setLevelB(""); return; }
        const lvls = DEM_LEVELS[demB] ?? [];
        if (!lvls.length) { setLevelB(""); return; }
        if (!lvls.includes(levelB)) setLevelB(pickDefaultLevel(lvls));
    }, [demB, DEM_LEVELS, levelB]);

    /* ---------- URLs ---------- */
    const demUrl = demName ? buildDemUrl(demName, demCmap, demStretch) : "";

    const handA = demA && levelA ? (DEM_LEVEL_TO_HAND[demA]?.[levelA] ?? "") : "";
    const floodUrlA =
        demA && levelA && handA
            ? buildFloodUrl(demA, handA, levelA, floodCmapA, floodStretchA, false)
            : "";

    const handB = demB && levelB ? (DEM_LEVEL_TO_HAND[demB]?.[levelB] ?? "") : "";
    const floodUrlB =
        demB && levelB && handB
            ? buildFloodUrl(demB, handB, levelB, floodCmapB, floodStretchB, false)
            : "";

    /* ---------- deck.gl layers (v9) ---------- */
    const layers = useMemo(() => {
        const L: Array<TileLayer<any> | BitmapLayer<any>> = [];

        const COMMON_TILE_PROPS: Partial<TileLayerProps<unknown>> = {
            minZoom: 0,
            maxZoom: 16,
            tileSize: 512,
            refinementStrategy: "no-overlap",
            pickable: false,
            maxRequests: 10,
            maxCacheSize: 1024
        };

        type BBox = [[number, number], [number, number]];

        if (demUrl && showDem) {
            L.push(
                new TileLayer<unknown>({
                    id: "dem-tiles",
                    data: demUrl,
                    ...COMMON_TILE_PROPS,
                    renderSubLayers: (subProps) => {
                        // subProps.tile.boundingBox is [[minX,minY],[maxX,maxY]]
                        const bb = (subProps.tile?.boundingBox ?? [[0,0],[0,0]]) as BBox;
                        return new BitmapLayer({
                            id: `${subProps.id}-bmp`,
                            image: subProps.data as ImageBitmap | HTMLImageElement | string | null | undefined,
                            bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
                            opacity: opacityDEM,
                            parameters: { depthTest: false }
                        });
                    }
                })
            );
        }

        if (floodUrlA && showFloodA) {
            L.push(
                new TileLayer<unknown>({
                    id: "flood-tiles-A",
                    data: floodUrlA,
                    ...COMMON_TILE_PROPS,
                    renderSubLayers: (subProps) => {
                        const bb = (subProps.tile?.boundingBox ?? [[0,0],[0,0]]) as BBox;
                        return new BitmapLayer({
                            id: `${subProps.id}-bmp`,
                            image: subProps.data as ImageBitmap | HTMLImageElement | string | null | undefined,
                            bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
                            opacity: opacityA,
                            parameters: { depthTest: false }
                        });
                    }
                })
            );
        }

        if (floodUrlB && showFloodB) {
            L.push(
                new TileLayer<unknown>({
                    id: "flood-tiles-B",
                    data: floodUrlB,
                    ...COMMON_TILE_PROPS,
                    renderSubLayers: (subProps) => {
                        const bb = (subProps.tile?.boundingBox ?? [[0,0],[0,0]]) as BBox;
                        return new BitmapLayer({
                            id: `${subProps.id}-bmp`,
                            image: subProps.data as ImageBitmap | HTMLImageElement | string | null | undefined,
                            bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
                            opacity: opacityB,
                            parameters: { depthTest: false }
                        });
                    }
                })
            );
        }

        return L;
    }, [demUrl, floodUrlA, floodUrlB, showDem, showFloodA, showFloodB, opacityDEM, opacityA, opacityB]);

    /* ---------- memoized Map (не ремонтуємо на кожен стейт) ---------- */
    const mapEl = useMemo(
        () =>
            HAS_MAPBOX ? (
                <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
                    fadeDuration={0}
                    reuseMaps
                />
            ) : null,
        []
    );

    /* ---------- render ---------- */
    const validA = (DEM_LEVELS[demA] ?? []).includes(levelA) ? levelA : "";
    const validB = (DEM_LEVELS[demB] ?? []).includes(levelB) ? levelB : "";

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0b0b" }}>
            <div style={panelStyle}>
                <button onClick={() => window.location.assign(DASH_HOME)} style={homeBtnStyle}>
                    ← Back to Dashboard
                </button>

                {/*/!* Легенда з «булітами» під вибрані групи шарів *!/*/}
                {/*<div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 8, marginBottom: 10, fontSize: 12, color: "#cbd5e1" }}>*/}
                {/*    <span style={dotStyle(COLORS.dem)} />*/}
                {/*    <span>Base DEM: <strong style={{ color: "#e5e7eb" }}>{demName || "—"}</strong></span>*/}
                {/*    <span style={dotStyle(COLORS.floodA)} />*/}
                {/*    <span>Flood A: <strong style={{ color: "#e5e7eb" }}>{demA || "—"}</strong>{validA ? ` (${parseLevel(validA)} m)` : ""}</span>*/}
                {/*    <span style={dotStyle(COLORS.floodB)} />*/}
                {/*    <span>Flood B: <strong style={{ color: "#e5e7eb" }}>{demB || "—"}</strong>{validB ? ` (${parseLevel(validB)} m)` : ""}</span>*/}
                {/*</div>*/}

                <div style={{ ...groupTitle }}>
                    <span style={dotStyle(COLORS.dem)} />
                    <span>Base DEM</span>
                </div>
                <select value={demName} onChange={(e) => setDemName(e.target.value)} style={selectStyle}>
                    {DEM_LIST.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <div style={checkRow}>
                    <input type="checkbox" checked={showDem} onChange={(e) => setShowDem(e.target.checked)} />
                    <span>Show DEM</span>
                </div>
                <label style={{ fontSize: 12, color: "#9ca3af" }}>Opacity: {opacityDEM.toFixed(2)}</label>
                <input
                    style={sliderStyle}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacityDEM}
                    onChange={(e) => setOpacityDEM(parseFloat(e.target.value))}
                />

                <div style={{ ...groupTitle, marginTop: 12 }}>
                    <span style={dotStyle(COLORS.floodA)} />
                    <span>Flood A (blues)</span>
                </div>
                <select value={demA} onChange={(e) => setDemA(e.target.value)} style={selectStyle}>
                    {DEM_LIST.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <div style={{ height: 6 }} />
                <select
                    value={validA}
                    onChange={(e) => setLevelA(e.target.value)}
                    style={selectStyle}
                    disabled={(DEM_LEVELS[demA] ?? []).length === 0}
                >
                    {(DEM_LEVELS[demA] ?? []).map((l) => (
                        <option key={l} value={l}>{parseLevel(l)} m</option>
                    ))}
                </select>
                <div style={checkRow}>
                    <input type="checkbox" checked={showFloodA} onChange={(e) => setShowFloodA(e.target.checked)} />
                    <span>Show Flood A</span>
                </div>
                <label style={{ fontSize: 12, color: "#9ca3af" }}>Opacity: {opacityA.toFixed(2)}</label>
                <input
                    style={sliderStyle}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacityA}
                    onChange={(e) => setOpacityA(parseFloat(e.target.value))}
                />

                <div style={{ ...groupTitle, marginTop: 12 }}>
                    <span style={dotStyle(COLORS.floodB)} />
                    <span>Flood B (reds)</span>
                </div>
                <select value={demB} onChange={(e) => setDemB(e.target.value)} style={selectStyle}>
                    {DEM_LIST.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <div style={{ height: 6 }} />
                <select
                    value={validB}
                    onChange={(e) => setLevelB(e.target.value)}
                    style={selectStyle}
                    disabled={(DEM_LEVELS[demB] ?? []).length === 0}
                >
                    {(DEM_LEVELS[demB] ?? []).map((l) => (
                        <option key={l} value={l}>{parseLevel(l)} m</option>
                    ))}
                </select>
                <div style={checkRow}>
                    <input type="checkbox" checked={showFloodB} onChange={(e) => setShowFloodB(e.target.checked)} />
                    <span>Show Flood B</span>
                </div>
                <label style={{ fontSize: 12, color: "#9ca3af" }}>Opacity: {opacityB.toFixed(2)}</label>
                <input
                    style={sliderStyle}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacityB}
                    onChange={(e) => setOpacityB(parseFloat(e.target.value))}
                />
            </div>

            <DeckGL
                initialViewState={{ longitude: 25.03, latitude: 47.8, zoom: 10 }}
                controller={{ dragRotate: false }}
                layers={layers}
            >
                {mapEl}
            </DeckGL>
        </div>
    );
}



// import {useEffect, useMemo, useState} from "react";
// import DeckGL from "@deck.gl/react";
// import {BitmapLayer} from "@deck.gl/layers";
// import {TileLayer} from "@deck.gl/geo-layers";
// import Map from "react-map-gl";
// import "mapbox-gl/dist/mapbox-gl.css";
//
// import layersIndex from "./assets/layers_index.json";
//
// type LayerRec = {
//     category: string;
//     name: string;
//     dem?: string | null;
//     hand?: string | null;
//     flood?: string | null;
// };
//
// // src/App.tsx
// const TC_BASE = import.meta.env.DEV ? "/tc" : "https://geohydroai.org/tc";
// const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
//
//
// /* ---------- styles (dark) ---------- */
// const panelStyle: React.CSSProperties = {
//     position: "absolute",
//     zIndex: 10,
//     left: 10,
//     top: 10,
//     background: "#111",
//     color: "#eee",
//     padding: 12,
//     borderRadius: 10,
//     border: "1px solid #2a2a2a",
//     boxShadow: "0 8px 24px rgba(0,0,0,.35)",
//     width: 260
// };
// const groupTitle: React.CSSProperties = {
//     margin: "10px 0 6px",
//     fontSize: 12,
//     letterSpacing: .2,
//     color: "#9ca3af",
//     textTransform: "uppercase"
// };
// const selectStyle: React.CSSProperties = {
//     width: "100%",
//     background: "#1b1b1b",
//     color: "#eee",
//     border: "1px solid #333",
//     borderRadius: 8,
//     padding: "6px 8px",
//     outline: "none"
// };
// const checkRow: React.CSSProperties = {display:"flex", gap:8, alignItems:"center", margin:"6px 0"};
// const sliderStyle: React.CSSProperties = {width:"100%", marginTop:4};
//
// /* ---------- helpers ---------- */
// const parseLevel = (s: string) =>
//     Number(String(s).toLowerCase().replace("m", "").trim());
//
// const buildDemUrl = (dem: string, cmap: string, stretch: [number, number]) =>
//     `${TC_BASE}/singleband/dem/${dem}/{z}/{x}/{y}.png?colormap=${cmap}&stretch_range=[${stretch[0]},${stretch[1]}]`;
//
// const buildFloodUrl = (
//     dem: string,
//     hand: string,
//     level: string,
//     cmap: string,
//     stretch: [number, number],
//     pureBlue = false
// ) => {
//     const layer = `${dem}_${hand}_flood_${level}`;
//     const base = `${TC_BASE}/singleband/flood_scenarios/${layer}/{z}/{x}/{y}.png`;
//     return pureBlue
//         ? `${base}?colormap=custom&colors=0000ff&stretch_range=[${stretch[0]},${stretch[1]}]`
//         : `${base}?colormap=${cmap}&stretch_range=[${stretch[0]},${stretch[1]}]`;
// };
//
// // ---- helpers at top of file (once) ----
// const DASH_HOME = "/";
//
// // const COLORS = {
// //     dem:    "#2dd4bf", // бірюзовий
// //     floodA: "#60a5fa", // синій
// //     floodB: "#f87171", // червоний
// // };
// //
// const homeBtnStyle: React.CSSProperties = {
//     display: "inline-flex",
//     alignItems: "center",
//     gap: 8,
//     marginBottom: 12,
//     padding: "8px 12px",
//     borderRadius: 10,
//     background: "#198754",
//     color: "#fff",
//     fontWeight: 600,
//     textDecoration: "none",
//     border: "0",
//     cursor: "pointer",
// };
// //
// // const Section: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => (
// //     <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: "#0f0f0f", border: "1px solid #272727" }}>
// //         <div style={{ ...groupTitle, display: "flex", alignItems: "center", gap: 8 }}>
// //             <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: color }} />
// //             <span>{title}</span>
// //         </div>
// //         {children}
// //     </div>
// // );
// //
// // // дрібний поліруючий CSS для контролів
// // const controlCSS = `
// // select, input[type="range"] {
// //   accent-color: #3b82f6;
// // }
// // input[type="checkbox"] {
// //   width: 16px; height: 16px;
// // }
// // `;
// //
// // function Section({
// //                      color,
// //                      title,
// //                      children,
// //                  }: { color: string; title: string; children: React.ReactNode }) {
// //     return (
// //         <div className="section" style={{ ["--accent" as any]: color }}>
// //             <div className="title">
// //                 <span className="dot" style={{ background: color }} />
// //                 <span>{title}</span>
// //             </div>
// //             {children}
// //         </div>
// //     );
// // }
//
// export default function App() {
//     /* 1) індекс шарів */
//     const [index] = useState<LayerRec[]>(layersIndex as LayerRec[]);
//
//     /* 2) словники */
//     const {DEM_LIST, DEM_LEVELS, DEM_LEVEL_TO_HAND} = useMemo(() => {
//         const demSet = new Set<string>();
//         const tmpLevels: Record<string, Set<string>> = {};
//         const tmpLevel2hand: Record<string, Set<string>> = {};
//
//         for (const r of index) {
//             if (r.category === "dem" && r.name) demSet.add(r.name);
//             if (r.category === "flood_scenarios" && r.dem && r.flood) {
//                 (tmpLevels[r.dem] ??= new Set()).add(r.flood);
//                 const key = `${r.dem}|${r.flood}`;
//                 (tmpLevel2hand[key] ??= new Set()).add(r.hand || "");
//             }
//         }
//
//         const DEM_LIST = Array.from(demSet).sort();
//         const DEM_LEVELS: Record<string, string[]> = {};
//         const DEM_LEVEL_TO_HAND: Record<string, Record<string, string>> = {};
//
//         for (const d of DEM_LIST) {
//             const levels = Array.from(tmpLevels[d] ?? []).sort(
//                 (a, b) => parseLevel(a) - parseLevel(b)
//             );
//             DEM_LEVELS[d] = levels;
//             DEM_LEVEL_TO_HAND[d] = {};
//             for (const l of levels) {
//                 const hands = Array.from(tmpLevel2hand[`${d}|${l}`] ?? []);
//                 DEM_LEVEL_TO_HAND[d][l] = hands.includes("hand_2000") ? "hand_2000" : (hands[0] || "");
//             }
//         }
//         return {DEM_LIST, DEM_LEVELS, DEM_LEVEL_TO_HAND};
//     }, [index]);
//
//     /* ---------- UI state ---------- */
//     // DEM
//     const [demName, setDemName] = useState<string>("");
//     const [showDem, setShowDem] = useState(false);
//     const [opacityDEM, setOpacityDEM] = useState(0.30);
//     const [demCmap] = useState("terrain");
//     const [demStretch] = useState<[number, number]>([250, 2200]);
//
//     // Flood A (blues)
//     const [demA, setDemA] = useState<string>("");
//     const [levelA, setLevelA] = useState<string | undefined>();
//     const [showFloodA, setShowFloodA] = useState(true);
//     const [opacityA, setOpacityA] = useState(0.60);
//     const [floodCmapA] = useState("blues");
//     const [floodStretchA] = useState<[number, number]>([0, 5]);
//
//     // Flood B (reds)
//     const [demB, setDemB] = useState<string>("");
//     const [levelB, setLevelB] = useState<string | undefined>();
//     const [showFloodB, setShowFloodB] = useState(true);
//     const [opacityB, setOpacityB] = useState(0.45);
//     const [floodCmapB] = useState("reds");
//     const [floodStretchB] = useState<[number, number]>([0, 5]);
//
//     // дефолти
//     useEffect(() => {
//         if (!demName && DEM_LIST?.length) setDemName(DEM_LIST[0]);
//         if (!demA && DEM_LIST?.length) setDemA(DEM_LIST[0]);
//         if (!demB && DEM_LIST?.length) setDemB(DEM_LIST[1] || DEM_LIST[0]);
//     }, [DEM_LIST, demName, demA, demB]);
//
//     useEffect(() => {
//         if (demA) {
//             const lvls = DEM_LEVELS[demA] ?? [];
//             setLevelA(lvls.includes("5m") ? "5m" : lvls[0]);
//         }
//     }, [demA, DEM_LEVELS]);
//
//     useEffect(() => {
//         if (demB) {
//             const lvls = DEM_LEVELS[demB] ?? [];
//             setLevelB(lvls.includes("5m") ? "5m" : lvls[0]);
//         }
//     }, [demB, DEM_LEVELS]);
//
//     /* ---------- URLs ---------- */
//     const demUrl = demName ? buildDemUrl(demName, demCmap, demStretch) : "";
//
//     const handA = demA && levelA ? (DEM_LEVEL_TO_HAND[demA]?.[levelA] || "") : "";
//     const floodUrlA = demA && levelA && handA
//         ? buildFloodUrl(demA, handA, levelA, floodCmapA, floodStretchA, false)
//         : "";
//
//     const handB = demB && levelB ? (DEM_LEVEL_TO_HAND[demB]?.[levelB] || "") : "";
//     const floodUrlB = demB && levelB && handB
//         ? buildFloodUrl(demB, handB, levelB, floodCmapB, floodStretchB, false)
//         : "";
//
//     /* ---------- deck.gl layers (v9) ---------- */
//     const layers = useMemo(() => {
//         const L: any[] = [];
//
//         const COMMON_TILE_PROPS: any = {
//             minZoom: 0,
//             maxZoom: 16,
//             tileSize: 256,
//             refinementStrategy: "no-overlap",
//             pickable: false
//         };
//
//         if (demUrl) {
//             L.push(new TileLayer({
//                 id: "dem-tiles",
//                 data: demUrl,
//                 ...COMMON_TILE_PROPS,
//                 visible: showDem,
//                 renderSubLayers: (props: any) => {
//                     const bb = props.tile.boundingBox as [[number,number],[number,number]];
//                     return new BitmapLayer({
//                         id: `${props.id}-bmp`,
//                         // ВАЖЛИВО: НЕ передавати props у конструктор і НЕ задавати data
//                         image: props.data,
//                         bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
//                         opacity: opacityDEM,
//                         parameters: { depthTest: false }
//                     });
//                 }
//             }));
//         }
//
//         if (floodUrlA) {
//             L.push(new TileLayer({
//                 id: "flood-tiles-A",
//                 data: floodUrlA,
//                 ...COMMON_TILE_PROPS,
//                 visible: showFloodA,
//                 renderSubLayers: (props: any) => {
//                     const bb = props.tile.boundingBox as [[number,number],[number,number]];
//                     return new BitmapLayer({
//                         id: `${props.id}-bmp`,
//                         image: props.data,
//                         bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
//                         opacity: opacityA,
//                         parameters: { depthTest: false }
//                     });
//                 }
//             }));
//         }
//
//         if (floodUrlB) {
//             L.push(new TileLayer({
//                 id: "flood-tiles-B",
//                 data: floodUrlB,
//                 ...COMMON_TILE_PROPS,
//                 visible: showFloodB,
//                 renderSubLayers: (props: any) => {
//                     const bb = props.tile.boundingBox as [[number,number],[number,number]];
//                     return new BitmapLayer({
//                         id: `${props.id}-bmp`,
//                         image: props.data,
//                         bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
//                         opacity: opacityB,
//                         parameters: { depthTest: false }
//                     });
//                 }
//             }));
//         }
//
//         return L;
//     }, [demUrl, floodUrlA, floodUrlB, showDem, showFloodA, showFloodB, opacityDEM, opacityA, opacityB]);
//     /* ---------- render ---------- */
//     return (
//         <div style={{height:"100vh", width:"100vw"}}>
//             <div style={panelStyle}>
//                 <button
//                     onClick={() => window.location.assign(DASH_HOME)}
//                     style={homeBtnStyle}
//                 >
//                     ← Back to Dashboard
//                 </button>
//                 <div style={groupTitle}>Base DEM</div>
//                 <select value={demName} onChange={(e)=>setDemName(e.target.value)} style={selectStyle}>
//                     {DEM_LIST?.map(d => <option key={d} value={d}>{d}</option>)}
//                 </select>
//                 <div style={checkRow}>
//                     <input type="checkbox" checked={showDem} onChange={e=>setShowDem(e.target.checked)} />
//                     <span>Show DEM</span>
//                 </div>
//                 <label style={{fontSize:12, color:"#9ca3af"}}>Opacity: {opacityDEM.toFixed(2)}</label>
//                 <input style={sliderStyle} type="range" min={0} max={1} step={0.05}
//                        value={opacityDEM} onChange={e=>setOpacityDEM(parseFloat(e.target.value))} />
//
//                 <div style={groupTitle}>Flood A (blues)</div>
//                 <select value={demA} onChange={(e)=>setDemA(e.target.value)} style={selectStyle}>
//                     {DEM_LIST?.map(d => <option key={d} value={d}>{d}</option>)}
//                 </select>
//                 <div style={{height:6}}/>
//                 <select value={levelA} onChange={(e)=>setLevelA(e.target.value)} style={selectStyle}>
//                     {(DEM_LEVELS[demA] ?? []).map(l => <option key={l} value={l}>{parseLevel(l)} m</option>)}
//                 </select>
//                 <div style={checkRow}>
//                     <input type="checkbox" checked={showFloodA} onChange={e=>setShowFloodA(e.target.checked)} />
//                     <span>Show Flood A</span>
//                 </div>
//                 <label style={{fontSize:12, color:"#9ca3af"}}>Opacity: {opacityA.toFixed(2)}</label>
//                 <input style={sliderStyle} type="range" min={0} max={1} step={0.05}
//                        value={opacityA} onChange={e=>setOpacityA(parseFloat(e.target.value))} />
//
//                 <div style={groupTitle}>Flood B (reds)</div>
//                 <select value={demB} onChange={(e)=>setDemB(e.target.value)} style={selectStyle}>
//                     {DEM_LIST?.map(d => <option key={d} value={d}>{d}</option>)}
//                 </select>
//                 <div style={{height:6}}/>
//                 <select value={levelB} onChange={(e)=>setLevelB(e.target.value)} style={selectStyle}>
//                     {(DEM_LEVELS[demB] ?? []).map(l => <option key={l} value={l}>{parseLevel(l)} m</option>)}
//                 </select>
//                 <div style={checkRow}>
//                     <input type="checkbox" checked={showFloodB} onChange={e=>setShowFloodB(e.target.checked)} />
//                     <span>Show Flood B</span>
//                 </div>
//                 <label style={{fontSize:12, color:"#9ca3af"}}>Opacity: {opacityB.toFixed(2)}</label>
//                 <input style={sliderStyle} type="range" min={0} max={1} step={0.05}
//                        value={opacityB} onChange={e=>setOpacityB(parseFloat(e.target.value))} />
//             </div>
//
//             <DeckGL
//                 initialViewState={{longitude: 25.03, latitude: 47.8, zoom: 10}}
//                 controller={{dragRotate:false}}
//                 layers={layers}
//             >
//                 <Map
//                     mapboxAccessToken={MAPBOX_TOKEN}
//                     mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
//                     fadeDuration={0}     // вимкнули фейди
//                 />
//             </DeckGL>
//         </div>
//     );
// }
