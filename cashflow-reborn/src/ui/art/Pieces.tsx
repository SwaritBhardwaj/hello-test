/** Custom SVG game pieces — coin, pawn, deck back. No emoji. */

/**
 * A brass ₹ coin.
 * `empty` renders a hollow, desaturated "slot to be filled" — used by rating
 * meters (e.g. the temptation gauge) where earned coins are solid and the
 * remaining ones are faint outlines.
 */
export function Coin({ size = 22, empty = false }: { size?: number; empty?: boolean }) {
  if (empty) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="empty coin slot" className="inline-block align-middle shrink-0">
        {/* desaturated, low-contrast hollow ring — clearly an unfilled slot */}
        <circle cx="12" cy="12" r="11" fill="oklch(0.62 0.015 80 / 0.10)" stroke="oklch(0.55 0.02 80 / 0.45)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="oklch(0.55 0.02 80 / 0.25)" strokeWidth="0.8" />
        <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700"
          fill="oklch(0.55 0.015 80 / 0.35)" fontFamily="'Fredoka Variable', sans-serif">₹</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="coin" className="inline-block align-middle shrink-0">
      <defs>
        <radialGradient id="coin-face" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="oklch(0.92 0.08 88)" />
          <stop offset="100%" stopColor="oklch(0.74 0.13 80)" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#coin-face)" stroke="oklch(0.62 0.12 78)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="oklch(0.62 0.12 78 / 0.6)" strokeWidth="0.8" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700"
        fill="oklch(0.40 0.10 70)" fontFamily="'Fredoka Variable', sans-serif">₹</text>
    </svg>
  );
}

/** The player pawn / token. */
export function Pawn({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 30" width={size} height={size * 30 / 24} role="img" aria-label="player token" className="block">
      <defs>
        <linearGradient id="pawn-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.66 0.17 22)" />
          <stop offset="100%" stopColor="oklch(0.50 0.17 24)" />
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="28" rx="8" ry="2" fill="oklch(0 0 0 / 0.25)" />
      <circle cx="12" cy="7" r="5" fill="url(#pawn-body)" stroke="oklch(0.42 0.15 24)" strokeWidth="1" />
      <path d="M5 26 C5 17 9 14 12 14 C15 14 19 17 19 26 Z" fill="url(#pawn-body)" stroke="oklch(0.42 0.15 24)" strokeWidth="1" />
      <ellipse cx="10.3" cy="5.5" rx="1.6" ry="2.2" fill="oklch(1 0 0 / 0.35)" />
    </svg>
  );
}

/** A stacked deck back (for the draw pile). */
export function DeckBack({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 52" width={size} height={size * 52 / 40} role="img" aria-label="card deck" className="block">
      <rect x="5" y="7" width="30" height="42" rx="5" fill="oklch(0.42 0.06 62)" />
      <rect x="3" y="4" width="32" height="44" rx="5" fill="oklch(0.50 0.07 64)" />
      <rect x="1.5" y="1.5" width="34" height="46" rx="6" fill="oklch(0.30 0.05 158)" stroke="oklch(0.78 0.12 84)" strokeWidth="1.5" />
      <circle cx="18.5" cy="24.5" r="9" fill="none" stroke="oklch(0.78 0.12 84 / 0.7)" strokeWidth="1.4" />
      <text x="18.5" y="29" textAnchor="middle" fontSize="13" fontWeight="700"
        fill="oklch(0.82 0.11 84)" fontFamily="'Fredoka Variable', sans-serif">₹</text>
    </svg>
  );
}
