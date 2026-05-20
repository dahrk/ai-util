// Composition layer — assembles FloatingPanel / EmailHost / Settings / Onboarding
// into a DesignCanvas. Sections:
//   1. Floating panel — all 6 states, dark
//   2. Floating panel — light variants
//   3. In context — over an email draft
//   4. Onboarding & permissions
//   5. Settings window
//   6. Edge cases
//   7. Action picker variants (list / grid / row)
//
// One Tweaks panel up top controls accent / panel width / streaming speed /
// provider pill / showing the keyboard hint footer.

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "#f5a04f",
  "panelWidth": 380,
  "streamSpeed": 22,
  "showProvider": true,
  "actionLayout": "list"
} /*EDITMODE-END*/;

const ACCENT_OPTIONS = [
'#f5a04f', // amber (default)
'#0a84ff', // mac blue
'#bf5af2', // violet
'#30d158', // mint
'#ff453a' // red
];

function ArtboardCaption({ children, dark }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 12, left: 14,
      fontSize: 10.5, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.42)',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
      letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 600,
      pointerEvents: 'none'
    }}>{children}</div>);

}

// Each artboard is its own self-contained scene. We give it a soft desktop-y bg
// so the panel's vibrancy reads correctly.
function Stage({ theme = 'dark', children, label, padTop = 40, padBottom = 40, padX = 40 }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: dark ?
      'radial-gradient(120% 90% at 30% 10%, #3a2f4f 0%, #1a1a22 60%, #0e0e14 100%)' :
      'radial-gradient(120% 90% at 30% 10%, #fff4e3 0%, #f1ecdf 50%, #e2dccd 100%)',
      padding: `${padTop}px ${padX}px ${padBottom}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {children}
      {label && <ArtboardCaption dark={dark}>{label}</ArtboardCaption>}
    </div>);

}

// A simplified, dimmed "desktop wallpaper" backdrop that doesn't dominate
function DesktopBg({ theme }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: dark ?
      'linear-gradient(135deg, #1c1b2e 0%, #2d2540 40%, #3a2a4f 80%, #4a3060 100%)' :
      'linear-gradient(135deg, #f5ecd9 0%, #ead8c2 50%, #d9c1a3 100%)'
    }}>
      {/* subtle aurora */}
      <div style={{
        position: 'absolute', inset: 0,
        background: dark ?
        'radial-gradient(60% 40% at 20% 30%, rgba(245,160,79,0.25), transparent), radial-gradient(50% 35% at 80% 70%, rgba(108,76,241,0.22), transparent)' :
        'radial-gradient(60% 40% at 20% 30%, rgba(245,160,79,0.18), transparent), radial-gradient(50% 35% at 80% 70%, rgba(108,76,241,0.10), transparent)'
      }} />
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────

function PanelStatesSection({ tweaks, theme }) {
  const common = {
    theme,
    accent: tweaks.accent,
    width: tweaks.panelWidth,
    layout: tweaks.actionLayout,
    showProvider: tweaks.showProvider,
    streamSpeed: tweaks.streamSpeed
  };
  const W = tweaks.panelWidth + 80;
  return (
    <DCSection id={`panel-${theme}`} title={`Floating panel — ${theme}`} subtitle="All states. Pick an action; the panel runs the prototype end-to-end.">
      <DCArtboard id={`${theme}-picker`} label="01 · Action picker" width={W} height={420}>
        <Stage theme={theme}>
          <FloatingPanel {...common} state="picker" />
        </Stage>
      </DCArtboard>
      <DCArtboard id={`${theme}-streaming`} label="02 · Streaming" width={W} height={420}>
        <Stage theme={theme}>
          <AutoStreaming common={common} action="edit" hold="streaming" />
        </Stage>
      </DCArtboard>
      <DCArtboard id={`${theme}-result`} label="03 · Result" width={W} height={520}>
        <Stage theme={theme}>
          <AutoStreaming common={common} action="elaborate" hold="result" />
        </Stage>
      </DCArtboard>
      <DCArtboard id={`${theme}-error`} label="04 · Error" width={W} height={420}>
        <Stage theme={theme}>
          <FloatingPanel {...common} state="error" />
        </Stage>
      </DCArtboard>
      <DCArtboard id={`${theme}-empty`} label="05 · Empty selection" width={W} height={360}>
        <Stage theme={theme}>
          <FloatingPanel {...common} state="empty" />
        </Stage>
      </DCArtboard>
    </DCSection>);

}

// Hold the panel in a target state long enough for canvas viewing.
// `hold` is the desired *final* state. If 'streaming', we let it stream then
// rewind back. If 'result', we let it complete and stay.
function AutoStreaming({ common, action, hold }) {
  // For 'streaming' we want a continuous stream loop; use a remount key on cycle.
  const [cycle, setCycle] = React.useState(0);
  React.useEffect(() => {
    if (hold !== 'streaming') return;
    const t = setInterval(() => setCycle((n) => n + 1), 6500);
    return () => clearInterval(t);
  }, [hold]);
  return (
    <FloatingPanel
      key={cycle}
      {...common}
      state={hold === 'streaming' ? 'streaming' : 'streaming'}
      action={action}
      streamSpeed={hold === 'streaming' ? 35 : common.streamSpeed} />);


}

function InContextSection({ tweaks, theme }) {
  const panelCommon = {
    theme: 'dark',
    accent: tweaks.accent,
    width: 360,
    layout: tweaks.actionLayout,
    showProvider: tweaks.showProvider,
    streamSpeed: tweaks.streamSpeed
  };
  return (
    <DCSection id="in-context" title="In context" subtitle="The panel floating over an email draft — picker, then result.">
      <DCArtboard id="ctx-picker" label="Over draft · picker" width={840} height={580}>
        <ContextStage theme="light">
          <EmailHost theme="light" showPanel panelProps={{ ...panelCommon, theme: 'light', state: 'picker' }} />
        </ContextStage>
      </DCArtboard>
      <DCArtboard id="ctx-result" label="Over draft · result" width={840} height={580}>
        <ContextStage theme="light">
          <EmailHost theme="light" showPanel panelProps={{ ...panelCommon, theme: 'light', state: 'result', action: 'edit' }} />
        </ContextStage>
      </DCArtboard>
      <DCArtboard id="ctx-dark" label="Over draft · dark" width={840} height={580}>
        <ContextStage theme="dark">
          <EmailHost theme="dark" showPanel panelProps={{ ...panelCommon, theme: 'dark', state: 'streaming', action: 'summarize' }} />
        </ContextStage>
      </DCArtboard>
    </DCSection>);

}

function ContextStage({ theme, children }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: dark ?
      'linear-gradient(135deg, #1c1b2e 0%, #2d2540 50%, #4a3060 100%)' :
      'linear-gradient(135deg, #f5ecd9 0%, #ead8c2 50%, #d9c1a3 100%)',
      padding: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative'
    }}>{children}</div>);

}

function OnboardingSection({ tweaks }) {
  return (
    <DCSection id="onboarding" title="First-run" subtitle="Four steps before the panel works.">
      <DCArtboard id="ob-1" label="Step 1 · Accessibility" width={600} height={580}>
        <OnboardStage><OnboardingWindow step={1} accent={tweaks.accent} height={520} /></OnboardStage>
      </DCArtboard>
      <DCArtboard id="ob-2" label="Step 2 · API keys" width={600} height={580}>
        <OnboardStage><OnboardingWindow step={2} accent={tweaks.accent} height={520} /></OnboardStage>
      </DCArtboard>
      <DCArtboard id="ob-3" label="Step 3 · Default model" width={600} height={580}>
        <OnboardStage><OnboardingWindow step={3} accent={tweaks.accent} height={520} /></OnboardStage>
      </DCArtboard>
      <DCArtboard id="ob-4" label="Step 4 · Hotkey" width={600} height={580}>
        <OnboardStage data-comment-anchor="1b67477bf4-div-215-5"><OnboardingWindow step={4} accent={tweaks.accent} height={520} /></OnboardStage>
      </DCArtboard>
    </DCSection>);

}

function OnboardStage({ children }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #f5ecd9 0%, #ead8c2 50%, #d9c1a3 100%)',
      padding: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>{children}</div>);

}

function SettingsSection({ tweaks }) {
  return (
    <DCSection id="settings" title="Settings" subtitle="Separate window — General, Hotkey, Models, Actions.">
      <DCArtboard id="set-general" label="General" width={780} height={580}>
        <SettingsStage><SettingsWindow tab="general" accent={tweaks.accent} /></SettingsStage>
      </DCArtboard>
      <DCArtboard id="set-hotkey" label="Hotkey" width={780} height={580}>
        <SettingsStage><SettingsWindow tab="hotkey" accent={tweaks.accent} /></SettingsStage>
      </DCArtboard>
      <DCArtboard id="set-models" label="Models" width={780} height={580}>
        <SettingsStage><SettingsWindow tab="models" accent={tweaks.accent} /></SettingsStage>
      </DCArtboard>
      <DCArtboard id="set-actions" label="Actions" width={780} height={720}>
        <SettingsStage><SettingsWindow tab="actions" accent={tweaks.accent} height={660} /></SettingsStage>
      </DCArtboard>
      <DCArtboard id="set-dark" label="Models · dark" width={780} height={580}>
        <SettingsStage dark><SettingsWindow theme="dark" tab="models" accent={tweaks.accent} /></SettingsStage>
      </DCArtboard>
    </DCSection>);

}

function SettingsStage({ children, dark }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: dark ?
      'linear-gradient(135deg, #1c1b2e 0%, #2d2540 50%, #4a3060 100%)' :
      'linear-gradient(135deg, #f5ecd9 0%, #ead8c2 50%, #d9c1a3 100%)',
      padding: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>{children}</div>);

}

function EdgeCasesSection({ tweaks }) {
  const common = {
    accent: tweaks.accent, width: tweaks.panelWidth, layout: tweaks.actionLayout,
    showProvider: tweaks.showProvider, streamSpeed: tweaks.streamSpeed
  };
  const W = tweaks.panelWidth + 80;
  return (
    <DCSection id="edge" title="Edge cases" subtitle="Behaviors worth designing explicitly.">
      <DCArtboard id="edge-long" label="Very long selection" width={W} height={420}>
        <Stage theme="dark">
          <FloatingPanel {...common} theme="dark" state="picker" variant="long-selection" />
        </Stage>
      </DCArtboard>
      <DCArtboard id="edge-noned" label="Non-editable source" width={W} height={520}>
        <Stage theme="dark">
          <FloatingPanel {...common} theme="dark" state="result" action="summarize" nonEditable />
        </Stage>
      </DCArtboard>
      <DCArtboard id="edge-fallback" label="Provider fallback" width={W} height={420}>
        <Stage theme="dark">
          <AutoFallback common={common} />
        </Stage>
      </DCArtboard>
      <DCArtboard id="edge-refusal" label="Model refusal" width={W} height={520}>
        <Stage theme="dark" data-comment-anchor="b70c2e6591-div-48-5">
          <FloatingPanel {...common} theme="dark" state="result" action="edit" variant="refusal" />
        </Stage>
      </DCArtboard>
      <DCArtboard id="edge-noned-light" label="Non-editable · light" width={W} height={520}>
        <Stage theme="light">
          <FloatingPanel {...common} theme="light" state="result" action="research" nonEditable />
        </Stage>
      </DCArtboard>
    </DCSection>);

}

function AutoFallback({ common }) {
  const [cycle, setCycle] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setCycle((n) => n + 1), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <FloatingPanel
      key={cycle}
      {...common}
      theme="dark"
      state="streaming"
      action="elaborate"
      variant="fallback"
      streamSpeed={40} />);


}

function LayoutVariantsSection({ tweaks }) {
  const common = {
    theme: 'dark', accent: tweaks.accent, width: tweaks.panelWidth,
    showProvider: tweaks.showProvider, streamSpeed: tweaks.streamSpeed
  };
  const W = tweaks.panelWidth + 80;
  return (
    <DCSection id="variants" title="Action picker — layout options" subtitle="Three takes on the entry surface. Try the Tweak to set the global one.">
      <DCArtboard id="var-list" label="A · Vertical list (default)" width={W} height={420}>
        <Stage theme="dark"><FloatingPanel {...common} state="picker" layout="list" /></Stage>
      </DCArtboard>
      <DCArtboard id="var-grid" label="B · 2×2 grid" width={W} height={420}>
        <Stage theme="dark"><FloatingPanel {...common} state="picker" layout="grid" /></Stage>
      </DCArtboard>
      <DCArtboard id="var-row" label="C · Compact row" width={W} height={360}>
        <Stage theme="dark"><FloatingPanel {...common} state="picker" layout="row" /></Stage>
      </DCArtboard>
    </DCSection>);

}

// ─────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────

function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULT_TWEAKS);

  return (
    <>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Aesthetic" />
        <TweakColor label="Accent" value={tweaks.accent}
        options={ACCENT_OPTIONS}
        onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Panel" />
        <TweakSlider label="Width" value={tweaks.panelWidth}
        min={320} max={460} step={4} unit="px"
        onChange={(v) => setTweak('panelWidth', v)} />
        <TweakRadio label="Action layout" value={tweaks.actionLayout}
        options={[
        { label: 'List', value: 'list' },
        { label: 'Grid', value: 'grid' },
        { label: 'Row', value: 'row' }]
        }
        onChange={(v) => setTweak('actionLayout', v)} />
        <TweakToggle label="Provider pill" value={tweaks.showProvider}
        onChange={(v) => setTweak('showProvider', v)} />
        <TweakSection label="Streaming" />
        <TweakSlider label="Token delay" value={tweaks.streamSpeed}
        min={8} max={80} step={2} unit="ms"
        onChange={(v) => setTweak('streamSpeed', v)} />
      </TweaksPanel>

      <DesignCanvas>
        <PanelStatesSection tweaks={tweaks} theme="dark" />
        <PanelStatesSection tweaks={tweaks} theme="light" />
        <InContextSection tweaks={tweaks} />
        <LayoutVariantsSection tweaks={tweaks} />
        <OnboardingSection tweaks={tweaks} />
        <SettingsSection tweaks={tweaks} />
        <EdgeCasesSection tweaks={tweaks} />
      </DesignCanvas>
    </>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);