export default function Logo({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="9" width="18" height="18" rx="4" className="fill-slate-300 dark:fill-slate-600" />
      <rect x="10" y="5" width="18" height="18" rx="4" className="fill-indigo-600" />
      <path
        d="M15 14L19.5 14M19.5 14L17.5 12M19.5 14L17.5 16"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
