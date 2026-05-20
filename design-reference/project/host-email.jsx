// Email-draft host app — a fake macOS Mail / writing app shown behind the panel
// in "in context" artboards. Light or dark, with optional selected text highlight
// and panel-tail arrow indicator pointing at the selection.

function EmailHost({
  theme = 'light',
  width = 760, height = 520,
  selected = true,           // is there a selection highlighted?
  selectionRange = 'middle', // 'middle' | 'long'
  showPanel = false,         // overlay the floating panel
  panelProps = {},
  variant = 'normal',        // 'normal' | 'non-editable' (read-only doc)
  scale = 1,
}) {
  const dark = theme === 'dark';
  const bg = dark ? '#1c1c1e' : '#f3efe9';
  const paper = dark ? '#2a2a2d' : '#fdfcf9';
  const fgC = dark ? 'rgba(255,255,255,0.92)' : 'rgba(20,18,15,0.92)';
  const fgC2 = dark ? 'rgba(255,255,255,0.55)' : 'rgba(20,18,15,0.55)';
  const fgC3 = dark ? 'rgba(255,255,255,0.32)' : 'rgba(20,18,15,0.35)';
  const sidebar = dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.025)';
  const border = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const selBg = dark ? 'rgba(245,160,79,0.35)' : 'rgba(245,160,79,0.45)';

  return (
    <div style={{
      width, height,
      borderRadius: 11,
      overflow: 'hidden',
      position: 'relative',
      background: bg,
      boxShadow: dark
        ? '0 30px 60px -16px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(0,0,0,0.6)'
        : '0 30px 60px -18px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08)',
      transform: scale === 1 ? 'none' : `scale(${scale})`,
      transformOrigin: 'top left',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      color: fgC,
    }}>
      {/* Title bar */}
      <div style={{
        height: 38,
        background: dark ? 'rgba(40,40,42,0.9)' : 'rgba(244,239,233,0.92)',
        borderBottom: `0.5px solid ${border}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 14,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f56', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ffbd2e', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)' }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: '#27c93f', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 500, color: fgC2 }}>
          {variant === 'non-editable' ? 'q3-recap.md — Preview' : 'Draft — to Priya Anand'}
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ display: 'flex', height: 'calc(100% - 38px)' }}>
        {/* Sidebar */}
        <div style={{
          width: 160, background: sidebar, borderRight: `0.5px solid ${border}`,
          padding: '12px 8px', fontSize: 11.5, color: fgC2,
          display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          <div style={{ padding: '4px 8px', fontSize: 10, color: fgC3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mailboxes</div>
          {['Inbox', 'Drafts', 'Sent', 'Flagged', 'Archive'].map((n, i) => (
            <div key={n} style={{
              padding: '5px 8px', borderRadius: 5,
              background: n === 'Drafts' ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
              display: 'flex', justifyContent: 'space-between',
              fontWeight: n === 'Drafts' ? 500 : 400,
              color: n === 'Drafts' ? fgC : fgC2,
            }}>
              <span>{n}</span>
              <span style={{ color: fgC3, fontSize: 10.5 }}>{[12, 3, 0, 1, 0][i]}</span>
            </div>
          ))}
        </div>

        {/* Compose area */}
        <div style={{ flex: 1, padding: '18px 28px 24px', overflow: 'hidden', position: 'relative' }}>
          {variant !== 'non-editable' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: `0.5px solid ${border}` }}>
                <span style={{ fontSize: 11, color: fgC3, width: 44 }}>To</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>Priya Anand</span>
                <span style={{ fontSize: 11.5, color: fgC2 }}>&lt;priya@formica.co&gt;</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `0.5px solid ${border}` }}>
                <span style={{ fontSize: 11, color: fgC3, width: 44 }}>Subject</span>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>Q3 campaign — read before we scale</span>
              </div>
            </>
          )}
          {variant === 'non-editable' && (
            <div style={{ paddingBottom: 12, borderBottom: `0.5px solid ${border}`, marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Q3 Campaign Recap</div>
              <div style={{ fontSize: 11.5, color: fgC3, marginTop: 4 }}>Read-only · shared by Mara T.</div>
            </div>
          )}
          <div style={{
            paddingTop: 16, fontSize: 13.5, lineHeight: 1.62, color: fgC,
            fontFamily: '"New York", "Iowan Old Style", Georgia, serif',
          }}>
            <p style={{ margin: '0 0 12px' }}>Hi Priya,</p>
            <p style={{ margin: '0 0 12px' }}>
              Pulling together early numbers ahead of the Monday review. Two things to flag before we
              decide on Q4 budget.
            </p>
            <p style={{ margin: '0 0 12px' }}>
              {selected ? (
                <>
                  The early returns from our Q3 campaign show{' '}
                  <span style={{ background: selBg, padding: '1px 1px', borderRadius: 1, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
                    a 24% lift in engagement, but the cost-per-acquisition is up 18% compared to Q2.
                    Worth examining which segments drove the disparity before we double down on the
                    channels that performed best.
                  </span>
                </>
              ) : (
                'The early returns from our Q3 campaign show a 24% lift in engagement, but the cost-per-acquisition is up 18% compared to Q2. Worth examining which segments drove the disparity before we double down on the channels that performed best.'
              )}
            </p>
            <p style={{ margin: '0 0 12px' }}>
              I'll have a fuller breakdown by acquisition channel by EOD Friday — let me know if you want
              the segments sliced any particular way before then.
            </p>
            <p style={{ margin: '0 0 6px' }}>Thanks,<br />Mara</p>
          </div>

          {/* The floating panel overlay */}
          {showPanel && (
            <div style={{
              position: 'absolute',
              left: 240, top: 220,
              zIndex: 20,
              filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.18))',
            }}>
              <FloatingPanel {...panelProps} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EmailHost });
