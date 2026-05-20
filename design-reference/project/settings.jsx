// Settings window — full macOS-style preferences pane.
// Onboarding/First-run — 3 steps (Accessibility permission, API keys, Hotkey).

const SETTINGS_TABS = [
{ id: 'general', label: 'General', Icon: IconCog },
{ id: 'hotkey', label: 'Hotkey', Icon: IconKeyboard },
{ id: 'models', label: 'Models', Icon: IconSparkle },
{ id: 'actions', label: 'Actions', Icon: IconEdit }];


function MacWindow({ title, width = 640, height = 460, theme = 'light', children, sidebar }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      width, height, borderRadius: 11, overflow: 'hidden', position: 'relative',
      background: dark ? '#1f1f22' : '#ececef',
      boxShadow: dark ?
      '0 24px 60px -12px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(0,0,0,0.5)' :
      '0 24px 60px -16px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.07)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      color: dark ? 'rgba(255,255,255,0.94)' : 'rgba(0,0,0,0.86)'
    }}>
      <div style={{
        height: 38,
        background: dark ? 'rgba(40,40,42,0.92)' : 'rgba(245,245,247,0.92)',
        borderBottom: `0.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', position: 'relative'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f56' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ffbd2e' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#27c93f' }} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
          {title}
        </div>
      </div>
      <div style={{ display: 'flex', height: 'calc(100% - 38px)' }}>
        {sidebar &&
        <div style={{
          width: 180,
          background: dark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
          borderRight: `0.5px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          padding: '12px 10px'
        }}>{sidebar}</div>
        }
        <div style={{ flex: 1, overflow: 'auto', background: dark ? '#252528' : '#fafafc' }}>
          {children}
        </div>
      </div>
    </div>);

}

function Field({ label, children, hint, theme }) {
  const dark = theme === 'dark';
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)',
        marginBottom: 6, letterSpacing: '-0.005em'
      }}>{label}</div>
      {children}
      {hint &&
      <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)', marginTop: 6, lineHeight: 1.45 }}>
          {hint}
        </div>
      }
    </div>);

}

function MacInput({ value, mono, theme, placeholder, full, suffix }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: dark ? 'rgba(0,0,0,0.25)' : '#fff',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
      borderRadius: 6,
      padding: '5px 8px',
      fontSize: 12.5,
      fontFamily: mono ? '-apple-system, "SF Mono", Menlo, monospace' : 'inherit',
      width: full ? '100%' : 'auto',
      minHeight: 24
    }}>
      <span style={{ flex: 1, color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}>
        {value || <span style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>{placeholder}</span>}
      </span>
      {suffix}
    </div>);

}

function MacSelect({ value, theme, full }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
      background: dark ? 'rgba(255,255,255,0.06)' : '#fff',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
      boxShadow: dark ? 'none' : '0 1px 0 rgba(0,0,0,0.04)',
      borderRadius: 6,
      padding: '5px 8px 5px 10px',
      fontSize: 12.5,
      width: full ? '100%' : 'auto',
      minWidth: 180,
      cursor: 'pointer'
    }}>
      <span>{value}</span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginLeft: 8, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
        <svg width="8" height="4" viewBox="0 0 8 4"><path d="M0 3l4-3 4 3" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
        <svg width="8" height="4" viewBox="0 0 8 4"><path d="M0 1l4 3 4-3" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
      </span>
    </div>);

}

function MacToggle({ on, theme, accent = '#34c759' }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      width: 32, height: 19, borderRadius: 10,
      background: on ? accent : dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      position: 'relative',
      transition: 'background 120ms',
      cursor: 'pointer',
      flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: 1.5, left: on ? 14.5 : 1.5,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 120ms',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }} />
    </div>);

}

function Kbd({ children, theme }) {
  const dark = theme === 'dark';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, height: 22, padding: '0 6px',
      borderRadius: 5,
      background: dark ? 'rgba(255,255,255,0.08)' : '#fff',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}`,
      boxShadow: dark ? 'none' : '0 1px 0 rgba(0,0,0,0.05)',
      fontSize: 12, fontWeight: 500,
      color: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
      letterSpacing: 0
    }}>{children}</span>);

}

// ---------- Settings ----------

function SettingsWindow({ theme = 'light', width = 720, height = 520, accent = '#f5a04f', tab: initialTab = 'general' }) {
  const [tab, setTab] = React.useState(initialTab);
  const dark = theme === 'dark';
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';

  const Sidebar =
  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontSize: 10, color: muted, padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        Preferences
      </div>
      {SETTINGS_TABS.map((t) => {
      const Ic = t.Icon;
      const active = t.id === tab;
      return (
        <div key={t.id}
        onClick={() => setTab(t.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', borderRadius: 6,
          fontSize: 12.5, fontWeight: active ? 500 : 400,
          background: active ? dark ? 'rgba(245,160,79,0.18)' : 'rgba(245,160,79,0.15)' : 'transparent',
          color: active ? dark ? '#fff' : '#000' : dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
          cursor: 'pointer'
        }}>
            <span style={{ color: active ? accent : muted, display: 'inline-flex' }}><Ic size={13} /></span>
            <span>{t.label}</span>
          </div>);

    })}
    </div>;


  return (
    <MacWindow title="AI Text Actions — Settings" width={width} height={height} theme={theme} sidebar={Sidebar}>
      <div style={{ padding: '22px 26px' }}>
        {tab === 'general' && <GeneralTab theme={theme} accent={accent} />}
        {tab === 'hotkey' && <HotkeyTab theme={theme} accent={accent} />}
        {tab === 'models' && <ModelsTab theme={theme} accent={accent} />}
        {tab === 'actions' && <ActionsTab theme={theme} accent={accent} />}
      </div>
    </MacWindow>);

}

function GeneralTab({ theme, accent }) {
  return (
    <div>
      <Field label="Launch" theme={theme}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MacToggle on theme={theme} />
          <span style={{ fontSize: 12.5 }}>Start at login</span>
        </div>
      </Field>
      <Field label="Menu bar" theme={theme}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <MacToggle on theme={theme} />
          <span style={{ fontSize: 12.5 }}>Show menu bar icon</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MacToggle theme={theme} />
          <span style={{ fontSize: 12.5 }}>Show dock icon</span>
        </div>
      </Field>
      <Field label="Appearance" theme={theme}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['System', 'Light', 'Dark'].map((m) =>
          <div key={m} style={{
            padding: '5px 12px', borderRadius: 6,
            border: `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}`,
            background: m === 'System' ? theme === 'dark' ? 'rgba(245,160,79,0.16)' : 'rgba(245,160,79,0.14)' : theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fff',
            fontSize: 12.5, fontWeight: m === 'System' ? 500 : 400,
            cursor: 'pointer'
          }}>{m}</div>
          )}
        </div>
      </Field>
      <Field label="Permissions" theme={theme} hint="Required for selection capture and paste-back. Manage in System Settings → Privacy & Security.">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 7,
          background: theme === 'dark' ? 'rgba(52,199,89,0.10)' : 'rgba(52,199,89,0.10)',
          border: `0.5px solid ${theme === 'dark' ? 'rgba(52,199,89,0.3)' : 'rgba(52,199,89,0.35)'}`
        }}>
          <span style={{ color: '#34c759', display: 'inline-flex' }}><IconShield size={14} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Accessibility — Granted</div>
            <div style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', marginTop: 1 }}>
              Last verified 2 days ago
            </div>
          </div>
          <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', cursor: 'pointer', textDecoration: 'underline' }}>
            Open System Settings
          </div>
        </div>
      </Field>
    </div>);

}

function HotkeyTab({ theme, accent }) {
  return (
    <div>
      <Field label="Global hotkey" theme={theme} hint="Press to capture the current selection and open the action picker.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Kbd theme={theme}>⌘</Kbd>
          <Kbd theme={theme}>⇧</Kbd>
          <Kbd theme={theme}>Space</Kbd>
          <div style={{ marginLeft: 12, fontSize: 11.5, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', textDecoration: 'underline' }}>
            Record new shortcut
          </div>
        </div>
      </Field>
      <Field label="Behavior" theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MacToggle on theme={theme} />
            <span style={{ fontSize: 12.5 }}>Open at cursor position</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MacToggle on theme={theme} />
            <span style={{ fontSize: 12.5 }}>Press hotkey again to dismiss</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MacToggle theme={theme} />
            <span style={{ fontSize: 12.5 }}>Auto-trigger on text selection (PopClip-style)</span>
          </div>
        </div>
      </Field>
      <Field label="Action shortcuts" theme={theme} hint="Press a number 1–4 inside the action picker to run that action immediately.">
        <div style={{
          border: `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 7, overflow: 'hidden'
        }}>
          {[
          { n: '1', a: 'Summarize', alt: 'S' },
          { n: '2', a: 'Edit', alt: 'E' },
          { n: '3', a: 'Elaborate', alt: 'L' },
          { n: '4', a: 'Research', alt: 'R' }].
          map((r, i, arr) =>
          <div key={r.n} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', fontSize: 12.5,
            borderBottom: i === arr.length - 1 ? 'none' : `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
            background: i % 2 === 0 ? theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.012)' : 'transparent'
          }}>
              <span style={{ flex: 1 }}>{r.a}</span>
              <Kbd theme={theme}>{r.n}</Kbd>
              <span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 11 }}>or</span>
              <Kbd theme={theme}>{r.alt}</Kbd>
            </div>
          )}
        </div>
      </Field>
    </div>);

}

function ModelsTab({ theme, accent }) {
  return (
    <div>
      <Field label="Primary provider" theme={theme} hint="Used first. Set an API key to enable.">
        <div style={{
          padding: '12px',
          borderRadius: 8,
          border: `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          background: theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.012)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: '#ff4d24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>F</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Fireworks</span>
            <span style={{
              fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
              background: 'rgba(52,199,89,0.18)', color: '#1f9d4e', fontWeight: 600
            }}>Connected</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 12px', alignItems: 'center' }}>
            <div style={{ fontSize: 11.5, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>API key</div>
            <MacInput value="fw_••••••••••••••••3a9c" mono theme={theme} full
            suffix={<span style={{ fontSize: 11, color: '#1f9d4e', marginLeft: 8 }}>✓ valid</span>} />
            <div style={{ fontSize: 11.5, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>Model</div>
            <MacSelect value="accounts/fireworks/models/llama-v3p1-70b" theme={theme} full />
          </div>
        </div>
      </Field>
      <Field label="Fallback provider" theme={theme} hint="Used automatically if the primary times out or errors.">
        <div style={{
          padding: '12px',
          borderRadius: 8,
          border: `0.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          background: theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.012)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: '#6c4cf1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>O</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>OpenRouter</span>
            <span style={{
              fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
              background: 'rgba(52,199,89,0.18)', color: '#1f9d4e', fontWeight: 600
            }}>Connected</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 12px', alignItems: 'center' }}>
            <div style={{ fontSize: 11.5, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>API key</div>
            <MacInput value="sk-or-••••••••••••••••42f1" mono theme={theme} full />
            <div style={{ fontSize: 11.5, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>Model</div>
            <MacSelect value="anthropic/claude-3.5-haiku" theme={theme} full />
          </div>
        </div>
      </Field>
      <Field label="Timeouts" theme={theme}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5 }}>Fail over after</span>
          <MacSelect value="12 seconds" theme={theme} />
        </div>
      </Field>
    </div>);

}

const DEFAULT_PROMPTS = {
  summarize: "Condense the selected text to 2–3 sentences. Preserve key facts, numbers, and named entities. Match the original tone. Return only the rewritten text — no preface.",
  edit: "Rewrite the selected text for clarity and concision. Preserve the author's voice and meaning. Do not add new information. Return only the rewritten text — no preface.",
  elaborate: "Expand the selected text with more detail, examples, and supporting context. Match the original tone. Do not change the central claim. Return only the rewritten text — no preface.",
  research: "Provide 3–5 sentences of factual, neutral context about the topic in the selected text. Cite specifics where possible. If you are not confident, say so. Return plain prose — no preface.",
};

function ActionsTab({ theme, accent }) {
  const dark = theme === 'dark';
  const rows = [
    { id: 'summarize', label: 'Summarize', Icon: IconSummarize, on: true, hint: 'Condenses to 2–3 sentences, preserves key facts.' },
    { id: 'edit',      label: 'Edit',      Icon: IconEdit,      on: true, hint: 'Rewrites for clarity, preserves voice and meaning.' },
    { id: 'elaborate', label: 'Elaborate', Icon: IconElaborate, on: true, hint: 'Expands with detail, examples, context.' },
    { id: 'research',  label: 'Research',  Icon: IconResearch,  on: true, hint: 'Provides 3–5 sentences of factual context.' },
  ];

  const [expanded, setExpanded] = React.useState('edit'); // one open by default
  // Per-action prompt state; null = at default
  const [prompts, setPrompts] = React.useState({
    edit: "Rewrite the selected text for clarity in my voice — direct, conversational, no jargon. Keep every sentence under 20 words. Preserve all facts and numbers. Return only the rewritten text.",
  });

  const promptOf = (id) => prompts[id] ?? DEFAULT_PROMPTS[id];
  const isCustom = (id) => prompts[id] !== undefined && prompts[id] !== DEFAULT_PROMPTS[id];
  const restore = (id) => setPrompts((p) => { const n = { ...p }; delete n[id]; return n; });
  const editPrompt = (id, v) => setPrompts((p) => ({ ...p, [id]: v }));

  return (
    <div>
      <Field label="Enabled actions" theme={theme} hint="Drag to reorder. Click a row to view and edit its prompt.">
        <div style={{
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 8, overflow: 'hidden',
          background: dark ? 'rgba(255,255,255,0.02)' : '#fff',
        }}>
          {rows.map((r, i) => {
            const Ic = r.Icon;
            const isOpen = expanded === r.id;
            const customized = isCustom(r.id);
            return (
              <div key={r.id} style={{
                borderBottom: i === rows.length - 1 ? 'none' : `0.5px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                background: isOpen ? (dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)') : 'transparent',
              }}>
                {/* Row header */}
                <div
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px',
                    cursor: 'pointer',
                  }}>
                  <span style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', cursor: 'grab', display: 'inline-flex' }}
                    onClick={(e) => e.stopPropagation()}>
                    <svg width="8" height="14" viewBox="0 0 8 14"><g fill="currentColor">
                      <circle cx="2" cy="3" r="1" /><circle cx="6" cy="3" r="1" />
                      <circle cx="2" cy="7" r="1" /><circle cx="6" cy="7" r="1" />
                      <circle cx="2" cy="11" r="1" /><circle cx="6" cy="11" r="1" />
                    </g></svg>
                  </span>
                  <span style={{
                    width: 22, height: 22, borderRadius: 5,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ic size={13} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label}</span>
                      {customized && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          padding: '1px 5px', borderRadius: 3,
                          background: `color-mix(in oklab, ${accent} 22%, transparent)`,
                          color: dark ? '#ffb87a' : '#9c5a17',
                          border: `0.5px solid color-mix(in oklab, ${accent} 35%, transparent)`,
                        }}>Customized</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 1 }}>{r.hint}</div>
                  </div>
                  <span style={{
                    color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    display: 'inline-flex',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 140ms ease',
                  }}>
                    <IconCaret size={11} />
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MacToggle on={r.on} theme={theme} />
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <PromptEditor
                    theme={theme}
                    accent={accent}
                    value={promptOf(r.id)}
                    customized={customized}
                    onChange={(v) => editPrompt(r.id, v)}
                    onRestore={() => restore(r.id)}
                    defaultValue={DEFAULT_PROMPTS[r.id]}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <div style={{
        padding: '14px 16px',
        borderRadius: 8, border: `0.5px dashed ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
        fontSize: 12, color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
        textAlign: 'center',
      }}>
        Custom user-defined actions — coming in v1.1
      </div>
    </div>
  );
}

function PromptEditor({ theme, accent, value, defaultValue, customized, onChange, onRestore }) {
  const dark = theme === 'dark';
  const muted = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const taRef = React.useRef(null);
  // Auto-grow the textarea to fit its content
  React.useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(64, el.scrollHeight)}px`;
  }, [value]);
  return (
    <div style={{ padding: '4px 14px 14px 48px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: muted,
        }}>Prompt</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10.5, color: customized ? (dark ? '#ffb87a' : '#9c5a17') : muted,
            display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500,
          }}>
            <IconDot size={5} color={customized ? accent : (dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)')} />
            {customized ? 'Modified' : 'Default'}
          </span>
          <button
            type="button"
            onClick={onRestore}
            disabled={!customized}
            style={{
              appearance: 'none', border: 'none', background: 'transparent',
              padding: 0, margin: 0, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 500,
              color: customized ? (dark ? '#ffb87a' : '#9c5a17') : (dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'),
              cursor: customized ? 'pointer' : 'default',
              textDecoration: customized ? 'underline' : 'none',
              textDecorationColor: customized ? `color-mix(in oklab, ${accent} 50%, transparent)` : 'transparent',
              textUnderlineOffset: 3,
            }}>
            <IconRetry size={10} /> Restore default
          </button>
        </div>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: 64,
          resize: 'none',
          padding: '10px 12px',
          background: dark ? 'rgba(0,0,0,0.28)' : '#fcfcfd',
          color: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.86)',
          border: `0.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.55,
          fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: `inset 0 1px 0 0 ${dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.025)'}`,
        }}
        onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px color-mix(in oklab, ${accent} 35%, transparent)`}
        onBlur={(e) => e.target.style.boxShadow = `inset 0 1px 0 0 ${dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.025)'}`}
      />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 6,
      }}>
        <div style={{ fontSize: 10.5, color: muted }}>
          Variables: <code style={{
            fontFamily: '-apple-system, "SF Mono", Menlo, monospace', fontSize: 10.5,
            padding: '1px 5px', borderRadius: 3,
            background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            color: dark ? '#ffb87a' : '#9c5a17',
          }}>{'{{selection}}'}</code> appended automatically
        </div>
        {customized && (
          <details style={{ fontSize: 10.5, color: muted }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>View default</summary>
            <div style={{
              marginTop: 6, padding: '8px 10px',
              background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `0.5px dashed ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 5,
              fontSize: 11, lineHeight: 1.5,
              color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
              maxWidth: 340,
            }}>{defaultValue}</div>
          </details>
        )}
      </div>
    </div>
  );
}

// ---------- Onboarding ----------

function OnboardingWindow({ theme = 'light', step = 1, width = 540, height = 460, accent = '#f5a04f' }) {
  const dark = theme === 'dark';
  return (
    <MacWindow title="" width={width} height={height} theme={theme}>
      <div style={{
        height: '100%',
        background: dark ?
        'radial-gradient(120% 80% at 50% 0%, rgba(245,160,79,0.12), transparent 60%), #1d1d20' :
        'radial-gradient(120% 80% at 50% 0%, rgba(245,160,79,0.12), transparent 60%), #fafafc',
        padding: '28px 36px 20px',
        display: 'flex', flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Steps */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {[1, 2, 3, 4].map((n) =>
          <div key={n} style={{
            width: n === step ? 22 : 6, height: 6, borderRadius: 3,
            background: n === step ? accent :
            n < step ? dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' :
            dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            transition: 'all 200ms'
          }} />
          )}
        </div>

        <div style={{ flex: 1 }}>
          {step === 1 && <OnboardPermission theme={theme} accent={accent} />}
          {step === 2 && <OnboardKeys theme={theme} accent={accent} />}
          {step === 3 && <OnboardModel theme={theme} accent={accent} />}
          {step === 4 && <OnboardHotkey theme={theme} accent={accent} />}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 14, borderTop: `0.5px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          marginTop: 8
        }}>
          <div style={{ fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }}>
            Step {step} of 4
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 &&
            <div style={{
              padding: '6px 14px', borderRadius: 6,
              background: dark ? 'rgba(255,255,255,0.06)' : '#fff',
              border: `0.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              fontSize: 12.5, cursor: 'pointer'
            }}>Back</div>
            }
            <div style={{
              padding: '6px 16px', borderRadius: 6,
              background: accent, color: '#fff',
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset'
            }}>
              {step === 4 ? 'Finish' : 'Continue'}
            </div>
          </div>
        </div>
      </div>
    </MacWindow>);

}

function OnboardPermission({ theme, accent }) {
  const dark = theme === 'dark';
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  return (
    <div data-comment-anchor="5147445fb9-div-544-5">
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'linear-gradient(180deg, #ffc58a, #f5a04f)',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 8px 18px -6px rgba(245,160,79,0.6)'
      }}>
        <IconShield size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 600, textAlign: 'center', letterSpacing: '-0.01em' }}>
        One permission and you're set
      </h2>
      <p style={{ margin: '0 0 18px', textAlign: 'center', fontSize: 12.5, color: muted, lineHeight: 1.5, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
        macOS needs Accessibility access so we can read your selection
        and paste back the result. That's the only permission we ask for.
      </p>

      {/* Single permission card */}
      <div style={{
        padding: '14px 14px',
        borderRadius: 10,
        background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
        border: `0.5px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: dark ? 'none' : '0 1px 2px 0 rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          <IconShield size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Accessibility</span>
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
              textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3,
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
              border: `0.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}>Required</span>
          </div>
          <div style={{ fontSize: 11.5, color: muted, marginTop: 2, lineHeight: 1.4 }}>
            Read the active text selection and paste back the result.
          </div>
        </div>
        <div style={{
          padding: '6px 14px',
          borderRadius: 6,
          background: accent,
          color: '#fff',
          fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 1px 2px 0 rgba(0,0,0,0.12)',
          flexShrink: 0,
        }}>
          Grant access
        </div>
      </div>

      {/* Subtle reassurance footer — privacy facts as a single sentence */}
      <div style={{
        marginTop: 14, padding: '10px 12px',
        borderRadius: 7,
        background: dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)',
        border: `0.5px dashed ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        fontSize: 11, color: muted, lineHeight: 1.5,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ color: accent, marginTop: 1, flexShrink: 0 }}><IconCheck size={11} /></span>
        <span>
          Your selection is only read when you press the hotkey, sent only to the
          provider you chose, and never stored by us.
        </span>
      </div>
    </div>);

}

function OnboardKeys({ theme, accent }) {
  const dark = theme === 'dark';
  return (
    <div data-comment-anchor="5147445fb9-div-544-5">
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'linear-gradient(180deg, #ffc58a, #f5a04f)',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 8px 18px -6px rgba(245,160,79,0.6)'
      }}>
        <IconKey size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 600, textAlign: 'center', letterSpacing: '-0.01em' }}>
        Connect a provider
      </h2>
      <p style={{ margin: '0 0 16px', textAlign: 'center', fontSize: 12.5, color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', lineHeight: 1.5 }}>
        Fireworks is required. OpenRouter is optional and used as a fallback.
      </p>
      <Field label="Fireworks API key" theme={theme}>
        <MacInput value="" placeholder="fw_..." mono theme={theme} full />
      </Field>
      <Field label="OpenRouter API key" theme={theme} hint="Optional. Used if Fireworks is unreachable.">
        <MacInput value="" placeholder="sk-or-..." mono theme={theme} full />
      </Field>
    </div>);

}

function OnboardModel({ theme, accent }) {
  const dark = theme === 'dark';
  const muted = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const subtle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)';

  const MODELS = [
    {
      id: 'llama-70b',
      name: 'Llama 3.1 70B',
      provider: 'Fireworks',
      providerColor: '#ff4d24',
      providerInitial: 'F',
      tags: ['Fast', 'Recommended'],
      blurb: 'Best balance of speed and quality. ~140 tokens/s.',
    },
    {
      id: 'llama-405b',
      name: 'Llama 3.1 405B',
      provider: 'Fireworks',
      providerColor: '#ff4d24',
      providerInitial: 'F',
      tags: ['Highest quality'],
      blurb: 'More thorough rewrites, but ~3× slower.',
    },
    {
      id: 'claude-haiku',
      name: 'Claude 3.5 Haiku',
      provider: 'OpenRouter',
      providerColor: '#6c4cf1',
      providerInitial: 'O',
      tags: ['Fast'],
      blurb: 'Strong default. Used as fallback if Fireworks fails.',
    },
  ];

  const [selected, setSelected] = React.useState('llama-70b');

  return (
    <div>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'linear-gradient(180deg, #ffc58a, #f5a04f)',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 8px 18px -6px rgba(245,160,79,0.6)',
      }}>
        <IconSparkle size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 600, textAlign: 'center', letterSpacing: '-0.01em' }}>
        Choose a default model
      </h2>
      <p style={{ margin: '0 0 18px', textAlign: 'center', fontSize: 12.5, color: muted, lineHeight: 1.5 }}>
        Used for every action. You can change this anytime in Settings → Models.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODELS.map((m) => {
          const active = m.id === selected;
          return (
            <div key={m.id}
              onClick={() => setSelected(m.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                background: active
                  ? (dark ? 'rgba(245,160,79,0.10)' : 'rgba(245,160,79,0.10)')
                  : (dark ? 'rgba(255,255,255,0.03)' : '#fff'),
                border: `0.5px solid ${active
                  ? `color-mix(in oklab, ${accent} 55%, transparent)`
                  : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')}`,
                boxShadow: active
                  ? `0 0 0 2px color-mix(in oklab, ${accent} 22%, transparent)`
                  : 'none',
                transition: 'all 120ms ease',
              }}>
              {/* Radio */}
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `1.5px solid ${active ? accent : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')}`,
                background: active ? accent : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 1, flexShrink: 0,
                transition: 'all 120ms',
              }}>
                {active && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>

              {/* Provider tag */}
              <span style={{
                width: 22, height: 22, borderRadius: 5,
                background: m.providerColor,
                color: '#fff', fontSize: 10.5, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 0,
                boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}>{m.providerInitial}</span>

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: dark ? 'rgba(255,255,255,0.96)' : 'rgba(0,0,0,0.88)',
                    letterSpacing: '-0.005em',
                  }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: subtle }}>· {m.provider}</span>
                  {m.tags.map((t) => {
                    const isRec = t === 'Recommended';
                    return (
                      <span key={t} style={{
                        fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '1px 5px', borderRadius: 3,
                        background: isRec
                          ? `color-mix(in oklab, ${accent} 22%, transparent)`
                          : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
                        color: isRec
                          ? (dark ? '#ffb87a' : '#9c5a17')
                          : (dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)'),
                        border: isRec
                          ? `0.5px solid color-mix(in oklab, ${accent} 35%, transparent)`
                          : `0.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                      }}>{t}</span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: muted, marginTop: 3, lineHeight: 1.4 }}>{m.blurb}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 14,
        fontSize: 11, color: subtle, textAlign: 'center', lineHeight: 1.4,
      }}>
        Need something else? Pick any model per provider in Settings.
      </div>
    </div>
  );
}

function OnboardHotkey({ theme, accent }) {
  const dark = theme === 'dark';
  return (
    <div>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'linear-gradient(180deg, #ffc58a, #f5a04f)',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 8px 18px -6px rgba(245,160,79,0.6)'
      }}>
        <IconKeyboard size={28} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 600, textAlign: 'center', letterSpacing: '-0.01em' }}>
        Pick your hotkey
      </h2>
      <p style={{ margin: '0 0 22px', textAlign: 'center', fontSize: 12.5, color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', lineHeight: 1.5 }}>
        Press the keys you want. You can change this anytime in Settings.
      </p>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
        padding: '20px 0'
      }}>
        <Kbd theme={theme}>⌘</Kbd>
        <Kbd theme={theme}>⇧</Kbd>
        <Kbd theme={theme}>Space</Kbd>
      </div>
      <p style={{ textAlign: 'center', fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}>
        Default — most users keep this. <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Record different</span>
      </p>
    </div>);

}

Object.assign(window, { SettingsWindow, OnboardingWindow, MacWindow, Kbd });