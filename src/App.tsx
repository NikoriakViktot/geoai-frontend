
// src/App.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import DeckGL from "@deck.gl/react";
import { BitmapLayer } from "@deck.gl/layers";
import { TileLayer, type TileLayerProps } from "@deck.gl/geo-layers";
import Map from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import layersIndex from "./assets/layers_index.json";
import {GL} from '@luma.gl/constants';

/* ========= Types ========= */
type Category = "dem" | "flood_scenarios";
type Level = `${number}m`;
type Stretch = readonly [number, number];
type BBox = [[number, number], [number, number]];

type LayerRec = {
    category: Category | string;
    name: string;
    dem?: string | null;
    hand?: string | null;
    flood?: Level | string | null;
};

type DemLevels = Record<string, Level[]>;
type DemLevelToHand = Record<string, Record<Level, string>>;

/* ========= Constants ========= */
const TC_BASE = import.meta.env.DEV ? "/tc" : "https://geohydroai.org/tc";
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
const HAS_MAPBOX = Boolean(MAPBOX_TOKEN);
const DASH_HOME = "/dashboard";

const COLORS = {
    dem: "#2dd4bf",
    floodA: "#60a5fa",
    floodB: "#f87171",
} as const;

const PANEL_WIDTH = 300;

/* ========= Styles ========= */
const drawerStyle = (open: boolean, pinned: boolean, isDesktop: boolean): CSSProperties => ({
    position: "absolute",
    top: 60,
    left: 10,
    width: PANEL_WIDTH,
    maxHeight: isDesktop ? "80vh" : "100vh",
    overflowY: "auto",
    zIndex: 10,
    background: "#111",
    color: "#eee",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    padding: 12,
    transform: (open || pinned) ? "translateX(0)" : "translateX(-110%)",
    transition: "transform 240ms ease",
});


const backdropStyle = (visible: boolean): CSSProperties => ({
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 9,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 200ms ease",
});
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
const dot = (color: string): CSSProperties => ({
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: color,
    boxShadow: "0 0 0 2px rgba(255,255,255,.06)",
});
const selectStyle: CSSProperties = {
    width: "100%",
    background: "#1b1b1b",
    color: "#eee",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "6px 8px",
    outline: "none",
};
const row: CSSProperties = { display: "flex", gap: 8, alignItems: "center", margin: "6px 0" };
const slider: CSSProperties = { width: "100%", marginTop: 4 };
const button: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 10,
    background: "#198754",
    color: "#fff",
    fontWeight: 600,
    border: 0,
    cursor: "pointer",
};

/* ========= Helpers ========= */
const parseLevel = (s: Level | string): number =>
    Number(String(s).toLowerCase().replace("m", "").trim());

// const buildDemUrl = (dem: string, cmap: string, stretch: Stretch): string =>
//     `${TC_BASE}/singleband/dem/${encodeURIComponent(dem)}/{z}/{x}/{y}.png?colormap=${encodeURIComponent(
//         cmap
//     )}&stretch_range=[${stretch[0]},${stretch[1]}]`;
//
//
// const buildFloodUrl = (
//     dem: string,
//     hand: string,
//     level: Level | string,
//     cmap: string,
//     stretch: Stretch,
//     pureBlue = false
// ): string => {
//     const layer = `${dem}_${hand}_flood_${level}`;
//     const base = `${TC_BASE}/singleband/flood_scenarios/${encodeURIComponent(layer)}/{z}/{x}/{y}.png`;
//     return pureBlue
//         ? `${base}?colormap=custom&colors=0000ff&stretch_range=[${stretch[0]},${stretch[1]}]`
//         : `${base}?colormap=${encodeURIComponent(cmap)}&stretch_range=[${stretch[0]},${stretch[1]}]`;
// };

const buildDemUrl = (dem: string, cmap: string, stretch: Stretch): string =>
    `${TC_BASE}/singleband/dem/${encodeURIComponent(dem)}/{z}/{x}/{y}.png` +
    `?colormap=${encodeURIComponent(cmap)}` +
    `&stretch_range=[${stretch[0]},${stretch[1]}]` +
    `&resampling=linear`;              // ← додано

const buildFloodUrl = (
    dem: string,
    hand: string,
    level: Level | string,
    cmap: string,
    stretch: Stretch,
    pureBlue = false
): string => {
    const layer = `${dem}_${hand}_flood_${level}`;
    const base = `${TC_BASE}/singleband/flood_scenarios/${encodeURIComponent(layer)}/{z}/{x}/{y}.png`;
    return pureBlue
        ? `${base}?colormap=custom&colors=0000ff&stretch_range=[${stretch[0]},${stretch[1]}]&resampling=linear`
        : `${base}?colormap=${encodeURIComponent(cmap)}&stretch_range=[${stretch[0]},${stretch[1]}]&resampling=linear`;
};

const pickDefaultLevel = (levels: readonly (Level | string)[]): Level | "" => {
    const normalized = levels.map(String) as Level[];
    return (normalized.find((v) => v === "5m") ?? normalized[0] ?? "") as Level | "";
};

function makeTile(common: Partial<TileLayerProps<any>>, id: string, url: string, opacity: number) {
    return new TileLayer<any>({
        id,
        data: url,
        ...common,
        // (необов'язково) просити детальніші тайли
        zoomOffset: 1, // +1 рівень зуму -> менше "квадратиків", якщо сервер має ці тайли
        renderSubLayers: (p) => {
            const bb = (p.tile?.boundingBox ?? [[0,0],[0,0]]) as BBox;
            return new BitmapLayer<any>({
                id: `${p.id}-bmp`,
                image: p.data as ImageBitmap | HTMLImageElement | string | null | undefined,
                bounds: [bb[0][0], bb[0][1], bb[1][0], bb[1][1]],
                opacity,
                parameters: { depthTest: false },
                textureParameters: {
                    [GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
                    [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
                    [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
                    [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
                },
            });
        },
    });
}

/* ========= Control Panel ========= */
type PanelProps = {
    DEM_LIST: string[];
    DEM_LEVELS: DemLevels;
    demName: string;
    setDemName: (v: string) => void;
    showDem: boolean;
    setShowDem: (v: boolean) => void;
    opacityDEM: number;
    setOpacityDEM: (v: number) => void;

    demA: string;
    setDemA: (v: string) => void;
    levelA: Level | "";
    setLevelA: (v: Level | "") => void;
    showFloodA: boolean;
    setShowFloodA: (v: boolean) => void;
    opacityA: number;
    setOpacityA: (v: number) => void;

    demB: string;
    setDemB: (v: string) => void;
    levelB: Level | "";
    setLevelB: (v: Level | "") => void;
    showFloodB: boolean;
    setShowFloodB: (v: boolean) => void;
    opacityB: number;
    setOpacityB: (v: number) => void;
    pinned: boolean;
    setPinned: (v: boolean | ((p: boolean) => boolean)) => void;
    setIsOpen: (v: boolean | ((p: boolean) => boolean)) => void;
    isDesktop: boolean;
    autoClose: () => void;
};
function ControlPanel(p: PanelProps) {
    const validA = (p.DEM_LEVELS[p.demA] ?? []).includes(p.levelA as Level)
        ? p.levelA
        : "";
    const validB = (p.DEM_LEVELS[p.demB] ?? []).includes(p.levelB as Level)
        ? p.levelB
        : "";

    return (
        <div>
            {/* Шапка панелі */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                    onClick={() => (window.location.href = DASH_HOME)}
                    style={{ ...button }}
                >
                    ← Back to Dashboard
                </button>

                <button
                    onClick={() => p.setPinned((prev) => !prev)}
                    style={{ ...button, background: p.pinned ? "#444" : "#2563eb" }}
                    title="Pin keeps the panel always open"
                >
                    {p.pinned ? "📌 Unpin" : "📌 Pin"}
                </button>

                {/* ✕ працює лише коли НЕ pinned */}
                {!p.pinned && (
                    <button
                        onClick={() => p.setIsOpen(false)}
                        style={{ ...button, background: "#374151" }}
                        title="Close panel"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* BASE DEM */}
            <div style={groupTitle}>
                <span style={dot(COLORS.dem)} />
                <span>Base DEM</span>
            </div>
            <select
                value={p.demName}
                onChange={(e) => p.setDemName(e.target.value)}
                style={selectStyle}
            >
                {p.DEM_LIST.map((d) => (
                    <option key={d} value={d}>
                        {d}
                    </option>
                ))}
            </select>
            <div style={row}>
                <input
                    type="checkbox"
                    checked={p.showDem}
                    onChange={(e) => p.setShowDem(e.target.checked)}
                />
                <span>Show DEM</span>
            </div>
            <label style={{ fontSize: 12, color: "#9ca3af" }}>
                Opacity: {p.opacityDEM.toFixed(2)}
            </label>
            <input
                style={slider}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={p.opacityDEM}
                onChange={(e) => p.setOpacityDEM(parseFloat(e.target.value))}
            />

            {/* FLOOD A */}
            <div style={{ ...groupTitle, marginTop: 12 }}>
                <span style={dot(COLORS.floodA)} />
                <span>HAND A (blues)</span>
            </div>
            <select
                value={p.demA}
                onChange={(e) => p.setDemA(e.target.value)}
                style={selectStyle}
            >
                {p.DEM_LIST.map((d) => (
                    <option key={d} value={d}>
                        {d}
                    </option>
                ))}
            </select>
            <div style={{ height: 6 }} />
            <select
                value={validA}
                onChange={(e) => p.setLevelA(e.target.value as Level)}
                style={selectStyle}
                disabled={(p.DEM_LEVELS[p.demA] ?? []).length === 0}
            >
                {(p.DEM_LEVELS[p.demA] ?? []).map((l) => (
                    <option key={l} value={l}>
                        {parseLevel(l)} m
                    </option>
                ))}
            </select>
            <div style={row}>
                <input
                    type="checkbox"
                    checked={p.showFloodA}
                    onChange={(e) => p.setShowFloodA(e.target.checked)}
                />
                <span>Show HAND A</span>
            </div>
            <label style={{ fontSize: 12, color: "#9ca3af" }}>
                Opacity: {p.opacityA.toFixed(2)}
            </label>
            <input
                style={slider}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={p.opacityA}
                onChange={(e) => p.setOpacityA(parseFloat(e.target.value))}
            />

            {/* FLOOD B */}
            <div style={{ ...groupTitle, marginTop: 12 }}>
                <span style={dot(COLORS.floodB)} />
                <span>HAND B (reds)</span>
            </div>
            <select
                value={p.demB}
                onChange={(e) => p.setDemB(e.target.value)}
                style={selectStyle}
            >
                {p.DEM_LIST.map((d) => (
                    <option key={d} value={d}>
                        {d}
                    </option>
                ))}
            </select>
            <div style={{ height: 6 }} />
            <select
                value={validB}
                onChange={(e) => p.setLevelB(e.target.value as Level)}
                style={selectStyle}
                disabled={(p.DEM_LEVELS[p.demB] ?? []).length === 0}
            >
                {(p.DEM_LEVELS[p.demB] ?? []).map((l) => (
                    <option key={l} value={l}>
                        {parseLevel(l)} m
                    </option>
                ))}
            </select>
            <div style={row}>
                <input
                    type="checkbox"
                    checked={p.showFloodB}
                    onChange={(e) => p.setShowFloodB(e.target.checked)}
                />
                <span>Show HAND B</span>
            </div>
            <label style={{ fontSize: 12, color: "#9ca3af" }}>
                Opacity: {p.opacityB.toFixed(2)}
            </label>
            <input
                style={slider}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={p.opacityB}
                onChange={(e) => p.setOpacityB(parseFloat(e.target.value))}
            />
        </div>
    );
}


/* ========= App ========= */
export default function App() {
    const [isOpen, setIsOpen] = useState(true);
    const [pinned, setPinned] = useState(true);
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const onResize = () => setIsDesktop(window.innerWidth >= 768);
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // дефолт: pinned = true на десктопі, але гамбургер завжди є
    useEffect(() => {
        setPinned(isDesktop);
        if (!isDesktop) setIsOpen(false); // стартово закрита на мобілці
    }, [isDesktop]);

    const autoClose = () => {
        if (!pinned && !isDesktop) setIsOpen(false);
    };

    const [index] = useState<LayerRec[]>(layersIndex as LayerRec[]);

    const { DEM_LIST, DEM_LEVELS, DEM_LEVEL_TO_HAND } = useMemo(() => {
        const demSet = new Set<string>();
        const tmpLevels: Record<string, Set<Level>> = {};
        const tmpLevel2hand: Record<string, Set<string>> = {};

        for (const r of index) {
            if (r.category === "dem" && r.name) demSet.add(r.name);
            if (r.category === "flood_scenarios" && r.dem && r.flood) {
                (tmpLevels[r.dem] ??= new Set()).add(String(r.flood) as Level);
                const key = `${r.dem}|${r.flood}`;
                (tmpLevel2hand[key] ??= new Set()).add(r.hand ?? "");
            }
        }
        const demList = Array.from(demSet).sort();
        const demLevels: DemLevels = {};
        const demLevelToHand: DemLevelToHand = {};
        for (const d of demList) {
            const levels = Array.from(tmpLevels[d] ?? []).sort((a, b) => parseLevel(a) - parseLevel(b)) as Level[];
            demLevels[d] = levels;
            demLevelToHand[d] = {};
            for (const l of levels) {
                const hands = Array.from(tmpLevel2hand[`${d}|${l}`] ?? []);
                demLevelToHand[d][l] = hands.includes("hand_2000") ? "hand_2000" : (hands[0] ?? "");
            }
        }
        return { DEM_LIST: demList, DEM_LEVELS: demLevels, DEM_LEVEL_TO_HAND: demLevelToHand };
    }, [index]);

    const [demName, setDemName] = useState<string>("alos_dem");
    const [showDem, setShowDem] = useState<boolean>(true);
    const [opacityDEM, setOpacityDEM] = useState<number>(0.1);
    const demCmap = "terrain";
    const demStretch: Stretch = [250, 2200];

    const [demA, setDemA] = useState<string>("alos_dem");
    const [levelA, setLevelA] = useState<Level | "">("5m");
    const [showFloodA, setShowFloodA] = useState<boolean>(true);
    const [opacityA, setOpacityA] = useState<number>(0.6);
    const floodCmapA = "blues";
    const floodStretchA: Stretch = [0, 5];

    const [demB, setDemB] = useState<string>("aster_dem");
    const [levelB, setLevelB] = useState<Level | "">("5m");
    const [showFloodB, setShowFloodB] = useState<boolean>(true);
    const [opacityB, setOpacityB] = useState<number>(0.6);
    const floodCmapB = "reds";
    const floodStretchB: Stretch = [0, 5];

    useEffect(() => {
        if (demName && !DEM_LIST.includes(demName) && DEM_LIST[0]) setDemName(DEM_LIST[0]);
        if (demA && !DEM_LIST.includes(demA) && DEM_LIST[0]) setDemA(DEM_LIST[0]);
        if (demB && !DEM_LIST.includes(demB) && DEM_LIST[0]) setDemB(DEM_LIST[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [DEM_LIST]);

    useEffect(() => {
        const lvls = DEM_LEVELS[demA] ?? [];
        if (!lvls.length) setLevelA("");
        else if (!lvls.includes(levelA as Level)) setLevelA(pickDefaultLevel(lvls));
    }, [demA, DEM_LEVELS, levelA]);

    useEffect(() => {
        const lvls = DEM_LEVELS[demB] ?? [];
        if (!lvls.length) setLevelB("");
        else if (!lvls.includes(levelB as Level)) setLevelB(pickDefaultLevel(lvls));
    }, [demB, DEM_LEVELS, levelB]);

    const demUrl = demName ? buildDemUrl(demName, demCmap, demStretch) : "";
    const handA = demA && levelA ? (DEM_LEVEL_TO_HAND[demA]?.[levelA as Level] ?? "") : "";
    const floodUrlA = demA && levelA && handA ? buildFloodUrl(demA, handA, levelA, floodCmapA, floodStretchA) : "";
    const handB = demB && levelB ? (DEM_LEVEL_TO_HAND[demB]?.[levelB as Level] ?? "") : "";
    const floodUrlB = demB && levelB && handB ? buildFloodUrl(demB, handB, levelB, floodCmapB, floodStretchB) : "";

    const layers = useMemo(() => {
        const L: Array<TileLayer<any> | BitmapLayer<any>> = [];
        const COMMON: Partial<TileLayerProps<any>> = {
            minZoom: 0,
            maxZoom: 16,
            tileSize: 512,
            refinementStrategy: "no-overlap",
            pickable: false,
            maxRequests: 8,
            maxCacheSize: 512,
        };
        if (demUrl && showDem) L.push(makeTile(COMMON, "dem-tiles", demUrl, opacityDEM));
        if (floodUrlA && showFloodA) L.push(makeTile(COMMON, "flood-tiles-A", floodUrlA, opacityA));
        if (floodUrlB && showFloodB) L.push(makeTile(COMMON, "flood-tiles-B", floodUrlB, opacityB));
        return L;
    }, [demUrl, floodUrlA, floodUrlB, showDem, showFloodA, showFloodB, opacityDEM, opacityA, opacityB]);

    const mapEl = useMemo(
        () =>
            HAS_MAPBOX ? (
                <Map mapboxAccessToken={MAPBOX_TOKEN} mapStyle="mapbox://styles/mapbox/satellite-streets-v12" fadeDuration={0} reuseMaps />
            ) : null,
        []
    );

    return (
        <div
            style={{
                height: "100vh",
                width: "100vw",
                position: "relative",
                background: "#0b0b0b",
            }}
        >
            {/* 🔹 Гамбургер завжди видимий */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    zIndex: 20,
                    background: "#198754",
                    color: "#fff",
                    padding: "8px 12px",
                    border: 0,
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                ☰ Menu
            </button>

            {/* Бекдроп показуємо лише коли відкрита і НЕ pinned */}
            <div
                style={backdropStyle(isOpen && !pinned)}
                onClick={() => setIsOpen(false)}
            />

            {/* Панель керування */}
            <div style={drawerStyle(isOpen, pinned, isDesktop)}>
                <ControlPanel
                    /* ==== передаємо всі твої існуючі пропси ==== */
                    DEM_LIST={DEM_LIST}
                    DEM_LEVELS={DEM_LEVELS}
                    demName={demName}
                    setDemName={setDemName}
                    showDem={showDem}
                    setShowDem={setShowDem}
                    opacityDEM={opacityDEM}
                    setOpacityDEM={setOpacityDEM}
                    demA={demA}
                    setDemA={setDemA}
                    levelA={levelA}
                    setLevelA={setLevelA}
                    showFloodA={showFloodA}
                    setShowFloodA={setShowFloodA}
                    opacityA={opacityA}
                    setOpacityA={setOpacityA}
                    demB={demB}
                    setDemB={setDemB}
                    levelB={levelB}
                    setLevelB={setLevelB}
                    showFloodB={showFloodB}
                    setShowFloodB={setShowFloodB}
                    opacityB={opacityB}
                    setOpacityB={setOpacityB}
                    /* ==== нові пропси для керування панеллю ==== */
                    pinned={pinned}
                    setPinned={setPinned}
                    setIsOpen={setIsOpen}
                    isDesktop={isDesktop}
                    autoClose={autoClose}
                />
            </div>

            {/* Мапа з DeckGL */}
            <DeckGL
                initialViewState={{ longitude: 24.85, latitude: 47.9, zoom: 10 }}
                controller={{ dragRotate: false }}
                layers={layers}
            >
                {mapEl}
            </DeckGL>
        </div>
    );

}

