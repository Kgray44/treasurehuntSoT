import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number };
const icon = (paths: React.ReactNode) =>
  function Icon({ size = 24, ...props }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        {paths}
      </svg>
    );
  };
export const Anchor = icon(
  <>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v14M7 11h10M3 14c0 4 4 7 9 7s9-3 9-7M3 14l3 1M21 14l-3 1" />
  </>,
);
export const Crown = icon(<path d="m3 6 4 5 5-8 5 8 4-5-3 13H6L3 6ZM7 22h10" />);
export const Plus = icon(<path d="M12 5v14M5 12h14" />);
export const Compass = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2ZM12 1v3M12 20v3" />
  </>,
);
export const UserRound = icon(
  <>
    <circle cx="12" cy="7" r="4" />
    <path d="M4 22c0-7 3-10 8-10s8 3 8 10Z" />
  </>,
);
export const Timer = icon(
  <>
    <circle cx="12" cy="14" r="8" />
    <path d="M12 10v5h3M9 2h6M12 2v4M18 5l2 2" />
  </>,
);
export const BookOpen = icon(<path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v16" />);
export const Check = icon(<path d="m5 12 4 4L19 6" />);
export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const Circle = icon(<circle cx="12" cy="12" r="9" />);
export const Send = icon(<path d="m22 2-7 20-4-9L2 9l20-7ZM22 2 11 13" />);
export const MessagesSquare = icon(
  <>
    <path d="M4 3h14v12H8l-4 4V3Z" />
    <path d="M18 7h4v15l-5-3h-5v-4" />
  </>,
);
export const ArrowDown = icon(<path d="M12 3v18m-6-6 6 6 6-6" />);
