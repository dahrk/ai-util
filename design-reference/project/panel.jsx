// FloatingPanel — the AI Text Actions panel. All states in one component.
// Props:
//   state: 'picker' | 'streaming' | 'result' | 'error' | 'empty'
//   theme: 'light' | 'dark'
//   accent: css color
//   width: px
//   layout: 'list' | 'grid' | 'row'   (action picker variant)
//   showProvider: bool
//   action: 'summarize' | 'edit' | 'elaborate' | 'research' | null
//   selection: string
//   nonEditable: bool   (changes Replace -> Copy result)
//   streamSpeed: ms-per-token (default 18)
//   variant: optional flag — 'long-selection' | 'fallback' | 'refusal' (for edge-case artboards)
//   interactive: bool — when false, hold the state shown (for static artboards)
//   onDismiss / onReset
//
// The panel is a self-contained interactive prototype: clicking an action triggers
// real streaming; Accept/Copy/Retry/Back/Dismiss all work.

const SAMPLE_SELECTION =
  "The early returns from our Q3 campaign show a 24% lift in engagement, but the " +
  "cost-per-acquisition is up 18% compared to Q2. Worth examining which segments " +
  "drove the disparity before we double down on the channels that performed best.";

const LONG_SELECTION =
  SAMPLE_SELECTION + " " +
  "Across paid social, the bulk of the engagement came from short-form video, but the " +
  "audience skewed younger than our usual buyer profile, so checkout conversion lagged. " +
  "Display retargeting carried the cost overhead — the new creative variants underperformed " +
  "and we kept them live too long. Recommend pausing the bottom-quartile display segments by " +
  "Friday and shifting that budget to the two video creatives that broke through. " +
  "Also worth a closer look at how list-quality on the email warm-up affected CPA. " +
  "I'll have a fuller breakdown by segment in the Monday review.";

const ACTIONS = [
  { id: 'summarize', label: 'Summarize',  hint: 'Condense to 2–3 sentences', shortcut: '1', Icon: IconSummarize },
  { id: 'edit',      label: 'Edit',       hint: 'Tighten for clarity',       shortcut: '2', Icon: IconEdit },
  { id: 'elaborate', label: 'Elaborate',  hint: 'Add detail and context',    shortcut: '3', Icon: IconElaborate },
  { id: 'research',  label: 'Research',   hint: 'Factual context',           shortcut: '4', Icon: IconResearch },
];

const RESULTS = {
  summarize: "Q3 engagement rose 24% but cost-per-acquisition is up 18%. Before scaling spend, identify which audience segments caused the CPA inflation.",
  edit: "Q3 campaign engagement climbed 24%, though cost-per-acquisition rose 18% over Q2. Before doubling down on top-performing channels, we should pinpoint which segments drove the cost disparity.",
  elaborate: "The Q3 campaign delivered a 24% lift in engagement — a real signal that the new creative is resonating — but cost-per-acquisition climbed 18% versus Q2, which is more than we typically tolerate from a single quarter. The gap suggests we're paying for reach rather than intent: the audience widened faster than qualification improved. Before increasing budget on the channels that performed best, we should slice CPA by segment, isolate the cohorts driving the cost increase, and decide whether to suppress them or rework the funnel that follows the click.",
  research: "Cost-per-acquisition (CPA) typically rises when audience targeting broadens or when creative fatigue sets in late in a campaign cycle. Industry benchmarks for paid social CPA increased roughly 12–20% year-over-year in 2025, so an 18% jump is at the high end but not anomalous. Engagement-to-conversion ratios are most useful when broken down by acquisition channel — display and social often inflate engagement without contributing matched conversions. A common diagnostic is to compare top-of-funnel CPM and CTR against bottom-of-funnel CVR per segment.",
};

const ACTION_LABELS_PROG = {
  summarize: 'Summarizing',
  edit: 'Editing',
  elaborate: 'Elaborating',
  research: 'Researching',
};

// Extensible error registry. Add a new entry to expose a new error state —
// FloatingPanel reads everything (header title, body, footer CTAs) from here.
const ERROR_KINDS = {
  'both-failed': {
    headerTitle: "Couldn't complete",
    title: "We couldn't reach either provider.",
    Icon: IconWarn,
    tone: 'red',
    log: [
      ['Fireworks', 'timed out after 12s'],
      ['OpenRouter', '503 Service Unavailable'],
    ],
    hint: 'Check your connection or API keys in Settings. Your selection is still captured — retry to try again.',
    primary: { label: 'Retry', icon: 'retry', action: 'retry' },
    secondary: { label: 'Dismiss', action: 'dismiss' },
  },
  'rate-limit': {
    headerTitle: "Usage limit hit",
    title: "You've reached today's free quota.",
    Icon: IconWarn,
    tone: 'amber',
    log: [
      ['Fireworks', '429 Too Many Requests — daily token cap'],
      ['Resets in', '3h 41m'],
    ],
    meta: { kind: 'progress', label: 'Used today', used: 100, total: 100 },
    hint: 'Connect a paid key, or wait until your quota resets. OpenRouter is still available as a fallback.',
    primary: { label: 'Upgrade plan', icon: 'sparkle', action: 'upgrade' },
    secondary: { label: 'Use fallback', action: 'fallback' },
  },
  'invalid-key': {
    headerTitle: "Authentication failed",
    title: "Your Fireworks key looks invalid.",
    Icon: IconKey,
    tone: 'amber',
    log: [
      ['Fireworks', '401 Unauthorized'],
      ['Key', 'fw_••••3a9c'],
    ],
    hint: 'Paste a fresh key in Settings → Models. Until then, OpenRouter will keep working.',
    primary: { label: 'Open Settings', icon: 'cog', action: 'settings' },
    secondary: { label: 'Dismiss', action: 'dismiss' },
  },
  'no-connection': {
    headerTitle: "You're offline",
    title: 'No network connection.',
    Icon: IconWarn,
    tone: 'red',
    log: [
      ['Network', 'No route to host'],
      ['Last seen', 'Wi-Fi — 2m ago'],
    ],
    hint: 'Reconnect to Wi-Fi or Ethernet, then retry. Your selection is preserved.',
    primary: { label: 'Retry', icon: 'retry', action: 'retry' },
    secondary: { label: 'Dismiss', action: 'dismiss' },
  },
  'context-overflow': {
    headerTitle: "Selection too long",
    title: 'Your selection exceeds the model context.',
    Icon: IconWarn,
    tone: 'amber',
    log: [
      ['Selection', '14,820 tokens'],
      ['Llama 3.1 70B limit', '8,192 tokens'],
    ],
    hint: 'Pick a longer-context model or shorten the selection. We can also summarize in chunks.',
    primary: { label: 'Summarize in chunks', icon: 'sparkle', action: 'chunk' },
    secondary: { label: 'Switch model', action: 'switch-model' },
  },
};

// Tokenize a result string into "tokens" (roughly word-sized) for streaming.
function tokenize(s) {
  const out = [];
  let buf = '';
  for (const ch of s) {
    buf += ch;
    if (/[ \n.,;:!?\-—]/.test(ch)) { out.push(buf); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}

function useStream(action, speed, runId) {
  const [text, setText] = React.useState('');
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    setText(''); setDone(false);
    if (!action) return;
    const tokens = tokenize(RESULTS[action] || '');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setText(tokens.slice(0, i).join(''));
      if (i >= tokens.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [action, speed, runId]);
  return { text, done };
}

// --- shared style helpers --------------------------------------------------

function panelChrome(theme) {
  const dark = theme === 'dark';
  return {
    background: dark
      ? 'linear-gradient(180deg, rgba(46,46,52,0.78), rgba(30,30,34,0.78))'
      : 'linear-gradient(180deg, rgba(252,252,253,0.82), rgba(240,240,243,0.78))',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: dark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.10)',
    boxShadow: dark
      ? '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -10px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(0,0,0,0.6)'
      : '0 1px 0 0 rgba(255,255,255,0.85) inset, 0 24px 60px -12px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.05)',
    borderRadius: 14,
    color: dark ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.86)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
    fontSize: 13,
    letterSpacing: '-0.005em',
    overflow: 'hidden',
  };
}

const fg = (t) => t === 'dark' ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.86)';
const fg2 = (t) => t === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.52)';
const fg3 = (t) => t === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
const hover = (t) => t === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
const divider = (t) => t === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
const surface = (t) => t === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';

// --- sub components --------------------------------------------------------

function ShortcutChip({ children, theme, accent, active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 4, fontSize: 10.5, fontWeight: 500,
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
      color: active ? '#fff' : fg2(theme),
      background: active ? accent : (theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
      border: active ? 'none' : `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
      letterSpacing: 0,
    }}>{children}</span>
  );
}

function ProviderPill({ provider = 'fireworks', theme, status = 'idle' }) {
  const labels = { fireworks: 'Fireworks', openrouter: 'OpenRouter' };
  const dotColor = status === 'error' ? '#ff5e5e' : status === 'switching' ? '#f5a04f' : '#34c759';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, color: fg3(theme), fontWeight: 500,
      fontVariant: 'tabular-nums',
    }}>
      <IconDot size={6} color={dotColor} />
      <span>{labels[provider]}</span>
    </span>
  );
}

function SelectionPreview({ text, theme, truncated, totalChars }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 8,
      background: surface(theme),
      border: `0.5px solid ${divider(theme)}`,
      fontSize: 12, lineHeight: 1.42,
      color: fg2(theme),
      maxHeight: 56,
      overflow: 'hidden',
      position: 'relative',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
    }}>
      <span style={{
        display: 'inline-block', width: 3, height: 12,
        background: '#f5a04f', borderRadius: 1.5,
        verticalAlign: 'middle', marginRight: 8, marginTop: -2,
        opacity: 0.5,
      }} />
      {text}
      {truncated && (
        <div style={{ marginTop: 6, fontSize: 10.5, color: fg3(theme), fontWeight: 500 }}>
          …and {totalChars.toLocaleString()} more characters
        </div>
      )}
    </div>
  );
}

function ActionRow({ a, idx, theme, accent, focused, onClick, onHover }) {
  const Ic = a.Icon;
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        background: focused ? (theme === 'dark' ? 'rgba(245,160,79,0.16)' : 'rgba(245,160,79,0.14)') : 'transparent',
        color: fg(theme),
        transition: 'background 80ms ease',
      }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: focused
          ? accent
          : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
        color: focused ? '#fff' : fg(theme),
        border: focused ? 'none' : `0.5px solid ${divider(theme)}`,
        flexShrink: 0,
      }}>
        <Ic size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{a.label}</div>
        <div style={{ fontSize: 11, color: fg3(theme), marginTop: 2, lineHeight: 1.2 }}>{a.hint}</div>
      </div>
      <ShortcutChip theme={theme} accent={accent} active={focused}>{a.shortcut}</ShortcutChip>
    </div>
  );
}

function ActionGrid({ theme, accent, focused, onPick, onHoverIdx }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {ACTIONS.map((a, i) => {
        const Ic = a.Icon;
        const isFocus = focused === i;
        return (
          <div key={a.id}
            onClick={() => onPick(a.id)}
            onMouseEnter={() => onHoverIdx(i)}
            style={{
              padding: '12px 12px',
              borderRadius: 8,
              background: isFocus ? (theme === 'dark' ? 'rgba(245,160,79,0.14)' : 'rgba(245,160,79,0.12)') : surface(theme),
              border: `0.5px solid ${isFocus ? accent : divider(theme)}`,
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 6,
              position: 'relative',
            }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isFocus ? accent : 'transparent',
              color: isFocus ? '#fff' : fg(theme),
            }}>
              <Ic size={14} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.label}</div>
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <ShortcutChip theme={theme} accent={accent} active={isFocus}>{a.shortcut}</ShortcutChip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionRowCompact({ theme, accent, focused, onPick, onHoverIdx }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {ACTIONS.map((a, i) => {
        const Ic = a.Icon;
        const isFocus = focused === i;
        return (
          <div key={a.id}
            onClick={() => onPick(a.id)}
            onMouseEnter={() => onHoverIdx(i)}
            style={{
              flex: 1, padding: '10px 8px',
              borderRadius: 7,
              background: isFocus ? (theme === 'dark' ? 'rgba(245,160,79,0.14)' : 'rgba(245,160,79,0.12)') : surface(theme),
              border: `0.5px solid ${isFocus ? accent : divider(theme)}`,
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <div style={{ color: isFocus ? accent : fg(theme), marginTop: 2 }}>
              <Ic size={15} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 500 }}>{a.label}</div>
            <div style={{ marginTop: 2 }}>
              <ShortcutChip theme={theme} accent={accent} active={isFocus}>{a.shortcut}</ShortcutChip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Bottom action bar buttons
function PanelButton({ children, theme, primary, accent, onClick, dim, icon }) {
  const [h, setH] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        appearance: 'none', border: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: primary ? '6px 12px' : '6px 9px',
        borderRadius: 6,
        fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        color: primary ? '#fff' : (dim ? fg3(theme) : fg(theme)),
        background: primary
          ? (h ? `color-mix(in oklab, ${accent} 88%, black)` : accent)
          : (h ? hover(theme) : 'transparent'),
        boxShadow: primary
          ? `0 1px 0 0 rgba(255,255,255,0.18) inset, 0 1px 2px 0 rgba(0,0,0,0.15)`
          : 'none',
        transition: 'background 80ms ease',
      }}>
      {icon}{children}
    </button>
  );
}

// --- main panel -----------------------------------------------------------

function FloatingPanel({
  state: initialState = 'picker',
  theme = 'dark',
  accent = '#f5a04f',
  width = 380,
  layout = 'list',
  showProvider = true,
  action: initialAction = null,
  selection = SAMPLE_SELECTION,
  nonEditable = false,
  streamSpeed = 22,
  variant = null,
  errorKind = 'both-failed',
  interactive = true,
  forcedProvider = null,         // for static error/fallback artboards
  forcedProviderStatus = 'idle',
  onAccepted,
  onDismissed,
}) {
  const [state, setState] = React.useState(initialState);
  const [action, setAction] = React.useState(initialAction);
  const [focused, setFocused] = React.useState(0);
  const [runId, setRunId] = React.useState(0);
  const [provider, setProvider] = React.useState(forcedProvider || 'fireworks');
  const [providerStatus, setProviderStatus] = React.useState(forcedProviderStatus);
  const [showOriginal, setShowOriginal] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Sync external prop changes (for tweak switches)
  React.useEffect(() => { setState(initialState); }, [initialState]);
  React.useEffect(() => { setAction(initialAction); }, [initialAction]);

  const { text: streamText, done: streamDone } = useStream(
    state === 'streaming' || state === 'result' ? action : null,
    streamSpeed,
    runId
  );

  // Auto-advance from streaming -> result when stream completes
  React.useEffect(() => {
    if (state === 'streaming' && streamDone) {
      const t = setTimeout(() => setState('result'), 250);
      return () => clearTimeout(t);
    }
  }, [state, streamDone]);

  // Fallback simulation: if variant === 'fallback' and we hit streaming, switch provider midway
  React.useEffect(() => {
    if (variant === 'fallback' && state === 'streaming') {
      setProvider('fireworks'); setProviderStatus('switching');
      const t1 = setTimeout(() => { setProvider('openrouter'); setProviderStatus('idle'); }, 900);
      return () => clearTimeout(t1);
    }
  }, [variant, state, runId]);

  const pickAction = (id) => {
    if (!interactive) return;
    setAction(id);
    setState('streaming');
    setRunId((n) => n + 1);
    setAccepted(false); setCopied(false);
  };

  // Keyboard handling within the panel
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!interactive) return;
    const el = ref.current; if (!el) return;
    const onKey = (e) => {
      if (state === 'picker') {
        if (e.key === 'ArrowDown') { setFocused((f) => (f + 1) % ACTIONS.length); e.preventDefault(); }
        if (e.key === 'ArrowUp') { setFocused((f) => (f - 1 + ACTIONS.length) % ACTIONS.length); e.preventDefault(); }
        if (e.key === 'Enter') pickAction(ACTIONS[focused].id);
        if (/^[1-4]$/.test(e.key)) pickAction(ACTIONS[parseInt(e.key, 10) - 1].id);
      }
      if (e.key === 'Escape') { onDismissed && onDismissed(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [state, focused, interactive]);

  const isLong = variant === 'long-selection';
  const isRefusal = variant === 'refusal';
  const usedSelection = isLong ? LONG_SELECTION : selection;

  // ---- render ----
  return (
    <div ref={ref} tabIndex={-1} style={{ ...panelChrome(theme), width, outline: 'none' }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px 9px',
        borderBottom: `0.5px solid ${divider(theme)}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {state === 'picker' || state === 'empty' ? (
            <>
              <IconSparkle size={12} />
              <span style={{ fontSize: 11.5, color: fg2(theme), fontWeight: 500, letterSpacing: '0.01em' }}>
                AI Actions
              </span>
            </>
          ) : state === 'error' ? (
            <>
              {(() => {
                const cfg = ERROR_KINDS[errorKind] || ERROR_KINDS['both-failed'];
                const Ic = cfg.Icon || IconWarn;
                const toneColor = cfg.tone === 'amber' ? '#f5a04f' : '#ff5e5e';
                return (
                  <>
                    <span style={{ color: toneColor, display: 'inline-flex' }}><Ic size={12} /></span>
                    <span style={{ fontSize: 11.5, color: fg2(theme), fontWeight: 500 }}>{cfg.headerTitle}</span>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <span style={{ color: fg3(theme), cursor: 'pointer' }} onClick={() => interactive && setState('picker')}>
                <IconBack size={11} />
              </span>
              <span style={{ fontSize: 11.5, color: fg2(theme), fontWeight: 500 }}>
                {ACTION_LABELS_PROG[action]}{state === 'streaming' ? '…' : ''}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showProvider && <ProviderPill provider={provider} status={providerStatus} theme={theme} />}
          <span style={{ color: fg3(theme), cursor: 'pointer', display: 'inline-flex' }}>
            <IconCog size={12} />
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 12px' }}>
        {state === 'empty' && (
          <EmptyBody theme={theme} accent={accent} onDismiss={onDismissed} />
        )}

        {state === 'picker' && (
          <>
            <SelectionPreview
              text={usedSelection}
              truncated={isLong}
              totalChars={LONG_SELECTION.length - 240}
              theme={theme}
            />
            <div style={{ height: 10 }} />
            {layout === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ACTIONS.map((a, i) => (
                  <ActionRow key={a.id} a={a} idx={i} theme={theme} accent={accent}
                    focused={focused === i}
                    onClick={() => pickAction(a.id)}
                    onHover={() => setFocused(i)} />
                ))}
              </div>
            )}
            {layout === 'grid' && (
              <ActionGrid theme={theme} accent={accent} focused={focused}
                onPick={pickAction} onHoverIdx={setFocused} />
            )}
            {layout === 'row' && (
              <ActionRowCompact theme={theme} accent={accent} focused={focused}
                onPick={pickAction} onHoverIdx={setFocused} />
            )}
          </>
        )}

        {(state === 'streaming' || state === 'result') && (
          <StreamBody
            theme={theme} accent={accent}
            text={state === 'streaming' ? streamText : (RESULTS[action] || streamText)}
            streaming={state === 'streaming'}
            selection={usedSelection}
            showOriginal={showOriginal}
            setShowOriginal={setShowOriginal}
            isRefusal={isRefusal}
            providerStatus={providerStatus}
            provider={provider}
          />
        )}

        {state === 'error' && (
          <ErrorBody theme={theme} accent={accent} kind={errorKind} />
        )}
      </div>

      {/* Footer / action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        borderTop: `0.5px solid ${divider(theme)}`,
        background: theme === 'dark' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.015)',
        gap: 6,
      }}>
        {state === 'picker' && (
          <>
            <div style={{ fontSize: 10.5, color: fg3(theme), display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
              <IconKeyboard size={11} /> <span>Type 1–4 or ↑↓ Enter</span>
            </div>
            <PanelButton theme={theme} dim onClick={onDismissed}>Esc</PanelButton>
          </>
        )}
        {state === 'empty' && (
          <>
            <div style={{ flex: 1 }} />
            <PanelButton theme={theme} dim onClick={onDismissed}>Dismiss</PanelButton>
          </>
        )}
        {state === 'streaming' && (
          <>
            <div style={{ fontSize: 11, color: fg3(theme), paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Spinner color={fg3(theme)} />
              <span>{providerStatus === 'switching'
                ? 'Switching to OpenRouter…'
                : `Generating with ${provider === 'fireworks' ? 'Fireworks' : 'OpenRouter'}…`}</span>
            </div>
            <PanelButton theme={theme} dim onClick={() => interactive && setState('picker')}>Cancel</PanelButton>
          </>
        )}
        {state === 'result' && (
          <>
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <PanelButton theme={theme} dim icon={<IconBack size={11} />} onClick={() => interactive && setState('picker')}>
                Back
              </PanelButton>
              <PanelButton theme={theme} dim icon={copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
                onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
                {copied ? 'Copied' : 'Copy'}
              </PanelButton>
              <PanelButton theme={theme} dim icon={<IconRetry size={11} />}
                onClick={() => { setRunId((n) => n + 1); setState('streaming'); }}>
                Retry
              </PanelButton>
            </div>
            <PanelButton primary accent={accent} theme={theme}
              icon={accepted ? <IconCheck size={11} /> : null}
              onClick={() => { setAccepted(true); onAccepted && onAccepted(); }}>
              {accepted
                ? (nonEditable ? 'Copied' : 'Replaced')
                : (nonEditable ? 'Copy result' : 'Replace selection')}
            </PanelButton>
          </>
        )}
        {state === 'error' && (() => {
          const cfg = ERROR_KINDS[errorKind] || ERROR_KINDS['both-failed'];
          const iconFor = (name) => {
            if (name === 'retry') return <IconRetry size={11} />;
            if (name === 'cog') return <IconCog size={11} />;
            if (name === 'sparkle') return <IconSparkle size={11} />;
            return null;
          };
          const doAction = (act) => {
            if (act === 'retry') { setRunId((n) => n + 1); setState('streaming'); return; }
            if (act === 'dismiss') { onDismissed && onDismissed(); return; }
            if (act === 'settings') { /* would open settings window */ return; }
            if (act === 'upgrade') { /* would open upgrade flow */ return; }
            if (act === 'fallback') { setProvider('openrouter'); setRunId((n) => n + 1); setState('streaming'); return; }
            if (act === 'chunk') { setRunId((n) => n + 1); setState('streaming'); return; }
            if (act === 'switch-model') { /* would open model picker */ return; }
          };
          return (
            <>
              <PanelButton theme={theme} dim onClick={() => doAction(cfg.secondary.action)}>
                {cfg.secondary.label}
              </PanelButton>
              <PanelButton primary accent={accent} theme={theme}
                icon={iconFor(cfg.primary.icon)}
                onClick={() => doAction(cfg.primary.action)}>
                {cfg.primary.label}
              </PanelButton>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function EmptyBody({ theme }) {
  return (
    <div style={{ padding: '16px 4px 12px', textAlign: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: surface(theme),
        margin: '0 auto 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fg3(theme),
      }}>
        <IconSummarize size={16} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: fg(theme), marginBottom: 4 }}>
        Select some text first
      </div>
      <div style={{ fontSize: 11.5, color: fg3(theme), lineHeight: 1.45 }}>
        Highlight a passage in any app, then press <ShortcutChip theme={theme}>⌘⇧Space</ShortcutChip> again.
      </div>
    </div>
  );
}

function StreamBody({ theme, accent, text, streaming, selection, showOriginal, setShowOriginal, isRefusal, providerStatus }) {
  return (
    <div>
      {/* original toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <button onClick={() => setShowOriginal((v) => !v)}
          style={{
            appearance: 'none', border: 'none', background: 'transparent', padding: 0,
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            color: fg3(theme), fontSize: 10.5, fontFamily: 'inherit', fontWeight: 500,
          }}>
          <span style={{ display: 'inline-block', transform: showOriginal ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}>
            <IconCaret size={9} />
          </span>
          {showOriginal ? 'Hide original' : 'Show original'}
        </button>
        {isRefusal && (
          <span style={{
            fontSize: 10, fontWeight: 500, color: '#d49b3e',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 6px', borderRadius: 4,
            background: theme === 'dark' ? 'rgba(245,160,79,0.12)' : 'rgba(245,160,79,0.14)',
            border: `0.5px solid ${theme === 'dark' ? 'rgba(245,160,79,0.3)' : 'rgba(245,160,79,0.35)'}`,
          }}>
            <IconWarn size={9} /> Model declined
          </span>
        )}
      </div>
      {showOriginal && (
        <div style={{ marginBottom: 10 }}>
          <SelectionPreview text={selection} theme={theme} />
        </div>
      )}
      <div style={{
        fontSize: 13.5, lineHeight: 1.55,
        color: fg(theme),
        maxHeight: 260,
        overflowY: 'auto',
        paddingRight: 4,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isRefusal
          ? <span style={{ color: fg2(theme) }}>I can't help rewrite that passage as requested. Try a different action or selection.</span>
          : text}
        {streaming && <Caret accent={accent} />}
      </div>
    </div>
  );
}

function ErrorBody({ theme }) {
  return (
    <div style={{ padding: '4px 0 4px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: fg(theme), marginBottom: 8 }}>
        We couldn't reach either provider.
      </div>
      <div style={{
        background: surface(theme),
        border: `0.5px solid ${divider(theme)}`,
        borderRadius: 7,
        padding: '10px 12px',
        fontSize: 12, lineHeight: 1.6,
        color: fg2(theme),
        fontFamily: '-apple-system, "SF Mono", Menlo, monospace',
      }}>
        <div><span style={{ color: '#ff5e5e' }}>●</span> Fireworks — timed out after 12s</div>
        <div><span style={{ color: '#ff5e5e' }}>●</span> OpenRouter — 503 Service Unavailable</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: fg3(theme), lineHeight: 1.5 }}>
        Check your connection or API keys in Settings. Your selection is still captured —
        retry to try again.
      </div>
    </div>
  );
}

function Caret({ accent }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 2, height: '1em',
      background: accent,
      verticalAlign: 'text-bottom',
      marginLeft: 1.5,
      borderRadius: 1,
      animation: 'aiCaretBlink 1s steps(2) infinite',
    }} />
  );
}

function Spinner({ color }) {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10,
      border: `1.2px solid ${color}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'aiSpin 0.7s linear infinite',
    }} />
  );
}

Object.assign(window, { FloatingPanel, SAMPLE_SELECTION, LONG_SELECTION, ACTIONS, RESULTS });
