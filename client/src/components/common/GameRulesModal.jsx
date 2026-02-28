import { useState, useEffect } from 'react';

/**
 * Reusable "How to Play" rules modal for casino games.
 *
 * Props:
 *   gameKey   - unique localStorage key, e.g. "slots", "blackjack"
 *   title     - modal heading, e.g. "How to Play Slots"
 *   rules     - array of rule strings
 *   payouts   - array of { label, value } for payout table
 *   children  - optional extra JSX (placed after payouts)
 */
export default function GameRulesModal({ gameKey, title, rules = [], payouts = [], children }) {
  const storageKey = `betking_rules_seen_${gameKey}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      setOpen(true);
    }
  }, [storageKey]);

  const close = () => {
    setOpen(false);
    localStorage.setItem(storageKey, '1');
  };

  return (
    <>
      {/* Floating "?" help button */}
      <button onClick={() => setOpen(true)} style={styles.helpBtn} title="How to Play">
        ?
      </button>

      {open && (
        <div style={styles.overlay} onClick={close}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={styles.header}>
              <h2 style={styles.title}>{title}</h2>
              <button onClick={close} style={styles.closeX}>&times;</button>
            </div>

            <div style={styles.body}>
              {/* Rules */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Rules</h3>
                <ul style={styles.rulesList}>
                  {rules.map((r, i) => (
                    <li key={i} style={styles.ruleItem}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Payouts */}
              {payouts.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Payouts</h3>
                  <div style={styles.payoutTable}>
                    {payouts.map((p, i) => (
                      <div key={i} style={{
                        ...styles.payoutRow,
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                      }}>
                        <span style={styles.payoutLabel}>{p.label}</span>
                        <span style={styles.payoutValue}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {children}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
              <button onClick={close} style={styles.gotItBtn}>Got it, let's play!</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  helpBtn: {
    position: 'fixed',
    bottom: 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ffd700, #b8860b)',
    color: '#000',
    border: 'none',
    fontSize: '1.4rem',
    fontWeight: 900,
    cursor: 'pointer',
    zIndex: 900,
    boxShadow: '0 4px 16px rgba(255,215,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    animation: 'grm-fadeIn 0.25s ease-out',
  },
  modal: {
    background: '#1a2c38',
    borderRadius: 16,
    maxWidth: 520,
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(255,215,0,0.25)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(135deg, rgba(255,215,0,0.08), transparent)',
  },
  title: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #ffd700, #f0c040)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  closeX: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '1.6rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 4px',
  },
  body: {
    padding: '1rem 1.25rem',
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    marginBottom: '1.15rem',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#ffd700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '0.5rem',
    marginTop: 0,
  },
  rulesList: {
    margin: 0,
    paddingLeft: '1.2rem',
    listStyle: 'none',
  },
  ruleItem: {
    fontSize: '0.82rem',
    color: '#ccc',
    lineHeight: 1.6,
    position: 'relative',
    paddingLeft: '0.3rem',
    marginBottom: '0.25rem',
  },
  payoutTable: {
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  payoutRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.45rem 0.75rem',
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: '0.8rem',
    color: '#ccc',
    fontWeight: 600,
  },
  payoutValue: {
    fontSize: '0.8rem',
    color: '#ffd700',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  footer: {
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'center',
  },
  gotItBtn: {
    background: 'linear-gradient(135deg, #00e701, #00a801)',
    color: '#000',
    border: 'none',
    padding: '0.65rem 2rem',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.3px',
  },
};
