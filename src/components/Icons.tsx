// Small inline icons so we don't pull in an icon library.
type P = { size?: number; className?: string };

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const CheckIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path className="draw" d="M5 12.5l4.2 4.2L19 7" pathLength={1} />
  </svg>
);

export const UploadIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 15V4" />
    <path d="M7.5 8.5L12 4l4.5 4.5" />
    <path d="M5 15v3.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V15" />
  </svg>
);

export const FileIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M14 3H7.5A1.5 1.5 0 006 4.5v15A1.5 1.5 0 007.5 21h9a1.5 1.5 0 001.5-1.5V7z" />
    <path d="M14 3v4h4" />
    <path d="M9 13h6M9 16.5h4" />
  </svg>
);

export const AlertIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

export const ArrowLeftIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const Spinner = ({ size = 18 }: { size?: number }) => (
  <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
);

export const UsersIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5" />
  </svg>
);

export const ShieldIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" />
    <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
  </svg>
);

export const IdCardIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <circle cx="8.5" cy="11" r="2.2" />
    <path d="M5.5 16a3.2 3.2 0 016 0M14 10h4.5M14 13.5h3" />
  </svg>
);

export const PlusIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
