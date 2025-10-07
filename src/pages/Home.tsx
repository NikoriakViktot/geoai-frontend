import "../index.css";
import { useActiveSection } from "../hooks/useActiveSection";
const DASH_URL = import.meta.env.VITE_DASH_URL as string;


export default function Home() {
    const sections = ["manifesto", "expertise"];
    const active = useActiveSection(sections);

    return (
        <div>
            {/* full-bleed header */}
            <header className="gh-header">
                <div className="gh-container">
                    <div className="gh-brand">
                        <span className="gh-brand-title gh-drift gh-brand-lg">GeoHydroAI</span>
                    </div>
                    <nav className="gh-nav" aria-label="Primary">
                        <a href="#manifesto" className={active==="manifesto" ? "is-active" : ""}>Manifesto</a>
                        <a href="#expertise" className={active==="expertise" ? "is-active" : ""}>Expertise</a>
                    </nav>
                </div>
            </header>

            <main>
                {/* HERO */}
                <section className="gh-container gh-hero">
                    <div className="gh-hero-inner">
                        <img src="/logo-hero.png" alt="GeoHydroAI" className="gh-hero-logo" loading="eager" />
                        <h1 className="gh-h1">Align natural laws with technological clarity</h1>
                        <p className="gh-sub">
                            Physics-first GeoAI for DEM accuracy, flood readiness and hydrological insight — built
                            to reveal structure, not hide it.
                        </p>
                        <div className="gh-hero-actions">
                            <a className="gh-btn gh-btn--primary" href={DASH_URL}>▶ Try the Dashboard</a>
                            <a className="gh-btn gh-btn--ghost" href="https://www.linkedin.com/in/viktor-nikoriak-328404203/" target="_blank" rel="noreferrer">
                                Connect on LinkedIn
                            </a>
                        </div>
                    </div>
                    <a className="scroll-cue" href="#manifesto" aria-label="Scroll to Manifesto"></a>
                </section>

                {/* MANIFESTO */}
                <section id="manifesto" className="gh-container mf">
                    <article>
                        <header>
                            <h1>GeoHydroAI Manifesto</h1>
                            <p className="lead">A structured statement of ontology, purpose and practice — designed to be read with clarity and intent.</p>
                        </header>

                        <section>
                            <h2>Ontological Core</h2>
                            <p>Water flows toward the lowest gravitational potential. This is not just a law of physics — it is the foundation of hydrological structure. The terrain of the Earth shapes the pathways of water, and the Sun powers its return.</p>
                        </section>

                        <section>
                            <h2>Role of AI</h2>
                            <p>Artificial Intelligence in GeoHydroAI is not a black-box oracle. It is a transparent field of perception — an interpreter of flow, form, and uncertainty. Its role is to reveal the invisible: to show how data reflects the movement of energy and matter. It speaks not just in numbers, but in meaning — in ways the human mind can understand, reflect on, and act upon.</p>
                        </section>

                        <section>
                            <h2>Purpose</h2>
                            <p>To align natural laws with technological clarity, to support human decisions rooted in truth, and to help societies see the water beneath their feet, before it rises above their heads.</p>
                        </section>

                        <section>
                            <h2>Principles</h2>
                            <ul>
                                <li>AI must <strong>see more</strong>, but <strong>hide nothing</strong>.</li>
                                <li>Models must reflect the <strong>laws of energy and form</strong>, not just fit to past data.</li>
                                <li>Data must be <strong>transformed into insight</strong>, not just prediction.</li>
                                <li>People must remain <strong>at the center</strong>, with full agency to question, adapt, and learn.</li>
                            </ul>
                        </section>

                        <section className="callout" aria-label="Summary">
                            <p><strong>GeoHydroAI is a conscious interface between the Sun’s energy, the Earth’s terrain, and the human mind — with AI as a humble, transparent companion in the search for understanding and resilience.</strong></p>
                        </section>
                    </article>
                </section>

                {/* EXPERTISE */}
                <section id="expertise" className="gh-container exp-grid">
                    {[
                        { t: "Hydro/Hydraulic", d: "HEC-RAS, SWAT+, rating curves, FFA, HAND, unsteady routing." },
                        { t: "Remote Sensing", d: "Sentinel-1 SAR, ICESat-2, xDEM, geomorphons, slope, HAND." },
                        { t: "GeoAI Dashboards", d: "Deck.gl, Mapbox, Terracotta tiles, DEM QA/QC, flood scenarios." },
                    ].map((c) => (
                        <div key={c.t} className="exp-card">
                            <h3>{c.t}</h3>
                            <p>{c.d}</p>
                        </div>
                    ))}
                </section>
            </main>

            <footer className="gh-container" role="contentinfo">
                <span>© {new Date().getFullYear()} GeoHydroAI — Viktor Nikoriak</span>
                <div style={{ display:"flex", gap:12 }}>
                    <a href="mailto:nikoriakviktor@gmail.com">Email</a>
                    <a href="https://github.com/NikoriakViktot" target="_blank" rel="noreferrer">GitHub</a>
                </div>
            </footer>
        </div>
    );
}
