// Crisp 16px SVG icons. All use currentColor + stroke-width 1.5.
const Icon = ({ d, size = 16, children, fill }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill || "none"}
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const IconSummarize = (p) => (
  <Icon {...p}>
    <path d="M3 4h10" /><path d="M3 7.5h10" /><path d="M3 11h6" />
    <circle cx="12.2" cy="11" r="1.6" fill="currentColor" stroke="none" opacity="0.85" />
  </Icon>
);
const IconEdit = (p) => (
  <Icon {...p}>
    <path d="M2.5 13.5l1-3 7-7a1.5 1.5 0 0 1 2.1 2.1l-7 7-3 1z" />
    <path d="M9.5 4l2.5 2.5" />
  </Icon>
);
const IconElaborate = (p) => (
  <Icon {...p}>
    <path d="M2 4h12" /><path d="M2 8h12" /><path d="M2 12h8" />
    <path d="M13 11.5l1.5 1.5 -1.5 1.5" />
  </Icon>
);
const IconResearch = (p) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.3 10.3l3.2 3.2" />
    <path d="M5 7h4 M7 5v4" opacity="0.7" />
  </Icon>
);
const IconCog = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.4 3.4l1.4 1.4 M11.2 11.2l1.4 1.4 M3.4 12.6l1.4-1.4 M11.2 4.8l1.4-1.4" />
  </Icon>
);
const IconBack = (p) => <Icon {...p} d="M10 3L5 8l5 5" />;
const IconCopy = (p) => (
  <Icon {...p}>
    <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
    <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" />
  </Icon>
);
const IconRetry = (p) => (
  <Icon {...p}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.5 2v3h-3" />
  </Icon>
);
const IconCheck = (p) => <Icon {...p} d="M3.5 8.5l3 3 6-7" />;
const IconX = (p) => <Icon {...p} d="M3.5 3.5l9 9 M12.5 3.5l-9 9" />;
const IconWarn = (p) => (
  <Icon {...p}>
    <path d="M8 2l6.2 11H1.8L8 2z" />
    <path d="M8 6.5v3" /><circle cx="8" cy="11.4" r="0.5" fill="currentColor" stroke="none" />
  </Icon>
);
const IconShield = (p) => (
  <Icon {...p}>
    <path d="M8 1.5l5.5 2v4.5c0 3.5-2.5 5.5-5.5 6.5-3-1-5.5-3-5.5-6.5V3.5L8 1.5z" />
    <path d="M5.5 8l2 2 3-3.5" />
  </Icon>
);
const IconKey = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="11" r="2.5" />
    <path d="M6.8 9.2L13.5 2.5 M11 5l2 2 M9.5 6.5l1.5 1.5" />
  </Icon>
);
const IconKeyboard = (p) => (
  <Icon {...p}>
    <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
    <path d="M4 7h.01 M7 7h.01 M10 7h.01 M13 7h.01 M5 9.5h6" />
  </Icon>
);
const IconSparkle = (p) => (
  <Icon {...p}>
    <path d="M8 1.5l1.4 4 4 1.4-4 1.4L8 12.3 6.6 8.3 2.6 6.9l4-1.4L8 1.5z" />
  </Icon>
);
const IconDot = ({ size = 8, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={color} /></svg>
);
const IconCaret = (p) => <Icon {...p} d="M5 3l5 5-5 5" />;

Object.assign(window, {
  IconSummarize, IconEdit, IconElaborate, IconResearch,
  IconCog, IconBack, IconCopy, IconRetry, IconCheck, IconX,
  IconWarn, IconShield, IconKey, IconKeyboard, IconSparkle, IconDot, IconCaret,
});
