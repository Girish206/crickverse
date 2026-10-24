import { useEffect, useState } from "react";
import "./SplashScreen.css";

const SEEN_KEY = "cv-splash-seen";
// Matches the CSS timeline: the delivery, the reveal, then the fade out.
const DURATION_MS = 3000;
const REDUCED_DURATION_MS = 1200;

const hasSeen = () => {
    try {
        return sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
        return false;
    }
};

// Launch screen, once per browser session: the backdrop's delivery
// (CricketBackdrop) bowls the stumps, then the logo and name take their
// place. A tap skips it.
const SplashScreen = () => {
    const [visible, setVisible] = useState(() => !hasSeen());

    useEffect(() => {
        if (!visible) return;
        try {
            sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
            // Private mode: it just shows again next time.
        }
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const timer = setTimeout(() => setVisible(false), reduced ? REDUCED_DURATION_MS : DURATION_MS);
        return () => clearTimeout(timer);
    }, [visible]);

    if (!visible) return null;

    return (
        <div className="cv-splash" aria-hidden="true" onClick={() => setVisible(false)}>
            {/* The outer box carries the ball across, the inner one drops it,
                bounces it and lifts it into the stumps. */}
            <div className="cv-splash-ball-x">
                <div className="cv-splash-ball-y">
                    <svg className="cv-splash-ball" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="11" fill="var(--brand-crimson)" />
                        <path d="M7 3.5q3 8.5 0 17M17 3.5q-3 8.5 0 17" stroke="#fff" strokeWidth="1.2" fill="none" strokeDasharray="1.6 1.4" />
                    </svg>
                </div>
            </div>

            <svg className="cv-splash-stumps" viewBox="0 0 60 100">
                <defs>
                    <linearGradient id="cv-splash-stump" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffd23f" />
                        <stop offset="0.45" stopColor="#ff7a1f" />
                        <stop offset="1" stopColor="#d7261e" />
                    </linearGradient>
                </defs>
                <g fill="url(#cv-splash-stump)">
                    <rect className="cv-splash-stump" x="10" y="14" width="6" height="86" rx="2" />
                    <rect className="cv-splash-stump cv-splash-stump-mid" x="27" y="14" width="6" height="86" rx="2" />
                    <rect className="cv-splash-stump" x="44" y="14" width="6" height="86" rx="2" />
                </g>
                <g fill="#ffc400">
                    <rect className="cv-splash-bail cv-splash-bail-l" x="9" y="8" width="23" height="4" rx="2" />
                    <rect className="cv-splash-bail cv-splash-bail-r" x="28" y="8" width="23" height="4" rx="2" />
                </g>
            </svg>
            <span className="cv-splash-impact" />

            <div className="cv-splash-brand">
                <img src="/favicon.svg" alt="" className="cv-splash-logo" />
                <span className="cv-wordmark cv-splash-name">
                    Namma <em>Aaata</em>
                </span>
                <span className="cv-wordmark-kn cv-splash-kn" lang="kn">ನಮ್ಮ ಆಟ</span>
            </div>
        </div>
    );
};

export default SplashScreen;
