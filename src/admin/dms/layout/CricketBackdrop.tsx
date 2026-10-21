import "../css/components/CricketBackdrop.css";

// Decorative cricket scene behind every admin screen: faint ground lines,
// a drifting bat and ball, and a looping delivery that bowls the stumps.
const CricketBackdrop = () => (
    <div className="cv-backdrop" aria-hidden="true">
        {/* Ground: boundary, 30-yard circle and the pitch with its creases */}
        <svg className="cv-bd-field" viewBox="0 0 400 400" fill="none" stroke="currentColor">
            <ellipse cx="200" cy="200" rx="190" ry="180" strokeWidth="2" />
            <ellipse cx="200" cy="200" rx="112" ry="104" strokeWidth="1.5" strokeDasharray="6 8" />
            <rect x="188" y="160" width="24" height="80" rx="2" strokeWidth="1.5" />
            <line x1="180" y1="170" x2="220" y2="170" strokeWidth="1.5" />
            <line x1="180" y1="230" x2="220" y2="230" strokeWidth="1.5" />
        </svg>

        <svg className="cv-bd-float cv-bd-bat" viewBox="0 0 40 160" fill="currentColor">
            <rect x="16" y="0" width="8" height="46" rx="3" />
            <path d="M8 46h24v98q0 14-12 14T8 144z" />
        </svg>

        <svg className="cv-bd-float cv-bd-float-ball" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="currentColor" />
            <path d="M7 3.5q3 8.5 0 17M17 3.5q-3 8.5 0 17" stroke="#fff" strokeWidth="1.2" fill="none" strokeDasharray="1.6 1.4" />
        </svg>

        {/* The delivery: the outer box carries it across, the inner one
            drops it, bounces it and lifts it into the stumps. */}
        <div className="cv-bd-delivery-x">
            <div className="cv-bd-delivery-y">
                <svg className="cv-bd-ball" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="11" fill="var(--brand-crimson)" />
                    <path d="M7 3.5q3 8.5 0 17M17 3.5q-3 8.5 0 17" stroke="#fff" strokeWidth="1.2" fill="none" strokeDasharray="1.6 1.4" />
                </svg>
            </div>
        </div>

        <svg className="cv-bd-stumps" viewBox="0 0 60 100" fill="currentColor">
            <rect className="cv-bd-stump" x="10" y="14" width="6" height="86" rx="2" />
            <rect className="cv-bd-stump cv-bd-stump-mid" x="27" y="14" width="6" height="86" rx="2" />
            <rect className="cv-bd-stump" x="44" y="14" width="6" height="86" rx="2" />
            <rect className="cv-bd-bail cv-bd-bail-l" x="9" y="8" width="23" height="4" rx="2" />
            <rect className="cv-bd-bail cv-bd-bail-r" x="28" y="8" width="23" height="4" rx="2" />
        </svg>
        <span className="cv-bd-impact" />
    </div>
);

export default CricketBackdrop;
