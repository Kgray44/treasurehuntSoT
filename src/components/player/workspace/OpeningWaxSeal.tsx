export function OpeningWaxSeal() {
  return (
    <div className="opening-wax-seal" data-opening-actor="wax-seal" aria-hidden="true">
      <svg viewBox="0 0 152 152" role="presentation">
        <defs>
          <radialGradient id="opening-wax" cx="38%" cy="30%" r="72%">
            <stop offset="0" stopColor="#cf6658" />
            <stop offset="0.42" stopColor="#a63d37" />
            <stop offset="1" stopColor="#5f191d" />
          </radialGradient>
          <filter id="opening-wax-shadow" x="-40%" y="-40%" width="180%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#2a1010" floodOpacity=".62" />
          </filter>
          <clipPath id="wax-fragment-a">
            <path d="M8 15H77L72 53 57 70 7 62Z" />
          </clipPath>
          <clipPath id="wax-fragment-b">
            <path d="M77 8h67l2 57-43 6-31-18Z" />
          </clipPath>
          <clipPath id="wax-fragment-c">
            <path d="M7 62l50 8 15 19-17 28-45-8Z" />
          </clipPath>
          <clipPath id="wax-fragment-d">
            <path d="M57 70l15-17 31 18-8 25-23-7Z" />
          </clipPath>
          <clipPath id="wax-fragment-e">
            <path d="M103 71l43-6-1 47-50-16Z" />
          </clipPath>
          <clipPath id="wax-fragment-f">
            <path d="M10 109l45 8 17-28 11 55-57-5Z" />
          </clipPath>
          <clipPath id="wax-fragment-g">
            <path d="M72 89l23 7 50 16-13 30-49 2Z" />
          </clipPath>
        </defs>
        {[
          ["a", "wax-fragment-a"],
          ["b", "wax-fragment-b"],
          ["c", "wax-fragment-c"],
          ["d", "wax-fragment-d"],
          ["e", "wax-fragment-e"],
          ["f", "wax-fragment-f"],
          ["g", "wax-fragment-g"],
        ].map(([fragment, clip]) => (
          <g key={fragment} className={`wax-fragment wax-fragment-${fragment}`} clipPath={`url(#${clip})`}>
            <path
              d="M76 9c15 3 22 0 34 7 12 6 13 14 23 23 9 9 5 22 10 34 5 13 1 22-5 34-6 12-17 14-27 23-10 10-23 6-35 12-13 5-23-2-36-4-12-2-15-14-23-24-8-10-4-22-8-34-4-13 4-21 11-32C35 23 46 24 57 16c7-5 12-5 19-7Z"
              fill="url(#opening-wax)"
              filter="url(#opening-wax-shadow)"
            />
            <path
              d="M76 22c30 0 54 24 54 54s-24 54-54 54-54-24-54-54 24-54 54-54Z"
              fill="none"
              stroke="#dc806a"
              strokeWidth="4"
              opacity=".72"
            />
            <path
              d="M76 31c25 0 45 20 45 45s-20 45-45 45-45-20-45-45 20-45 45-45Z"
              fill="none"
              stroke="#6a1e21"
              strokeWidth="2.5"
              opacity=".8"
            />
            <text x="76" y="96" textAnchor="middle" className="wax-mark">
              F
            </text>
          </g>
        ))}
        <circle className="wax-stress-point" cx="72" cy="54" r="4" />
        <g className="wax-cracks">
          <path d="M73 52c-4 10-2 14-8 20 7 5 3 11 8 17-3 12 8 19 8 31" />
          <path d="M65 72c-12-2-19 4-31 1-7 3-11 8-18 9" />
          <path d="M73 89c10 1 14 7 23 7 9 8 19 7 33 13" />
          <path d="M102 71c6-6 13-7 21-14 5-1 9-4 14-8" />
          <path d="M57 70c-5-8-8-14-8-24-5-5-6-11-8-18" />
        </g>
        <path className="wax-chip" d="M127 119l10 3-3 10-12-4Z" fill="#812725" />
      </svg>
    </div>
  );
}
