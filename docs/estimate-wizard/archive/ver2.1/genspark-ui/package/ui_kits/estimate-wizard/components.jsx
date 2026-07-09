/* =============================================================================
   Estimate Wizard — Shared Components
   -----------------------------------------------------------------------------
   Ver2.0 §14 §17 の binding を全てここに集約。UI 表面で使う原子部品。
   ============================================================================= */

const { useState, useRef, useEffect, useMemo } = React;

/* ── アイコン: Lucide を span で埋め込む helper ─────────────────────────── */
function Icon({ name, size = 18, style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!window.lucide || !ref.current) return;
    // Lucide の icon 名は kebab-case、window.lucide.icons のキーは PascalCase。
    // 未対応名で lucide.createIcons を呼ぶと React DOM の removeChild が失敗するため、
    // 事前に存在確認して、なければ何もしない（プレースホルダの空 <i> のまま）。
    const key = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    if (!window.lucide.icons?.[key]) return;
    window.lucide.createIcons({ nameAttr: 'data-lucide', icons: window.lucide.icons, attrs: {}, elements: [ref.current] });
  }, [name]);
  return (
    <i ref={ref} data-lucide={name}
       style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0, ...style }} />
  );
}

/* ── Section Title (STEP N / xxx) ────────────────────────────────────── */
function ScreenTitle({ step, title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="ds-overline" style={{ color: 'var(--ds-primary-400)', marginBottom: 8, padding: 0 }}>
        STEP {step} / 7
      </div>
      <h1 className="ds-headline" style={{ margin: 0 }}>{title}</h1>
      {subtitle && <p className="ds-body" style={{ color: 'var(--ds-text-muted)', marginTop: 6, marginBottom: 0 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */
function Card({ title, subtitle, actions, children, style = {}, dense = false }) {
  return (
    <div style={{
      background: 'var(--ds-bg-card)',
      border: '1px solid var(--ds-line)',
      borderRadius: 'var(--ds-radius-xl)',
      padding: dense ? 16 : 20,
      boxShadow: 'var(--ds-shadow-lg), var(--ds-hi-inner)',
      marginBottom: 20,
      ...style,
    }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            {title && <h3 className="ds-title" style={{ margin: 0, fontSize: 16 }}>{title}</h3>}
            {subtitle && <p className="ds-caption" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Field: label + input, with Amber "必須未入力" ハイライト ─────────── */
function Field({ label, required = false, hint, error, value, children, layout = 'stack' }) {
  const isEmpty = required && (value === '' || value === null || value === undefined);
  const highlightColor = isEmpty ? 'var(--ds-amber-400)' : 'var(--ds-text-muted)';
  return (
    <div style={{
      display: layout === 'row' ? 'grid' : 'flex',
      gridTemplateColumns: layout === 'row' ? '140px 1fr' : undefined,
      flexDirection: layout === 'stack' ? 'column' : undefined,
      gap: layout === 'stack' ? 6 : 12,
      alignItems: layout === 'row' ? 'center' : 'stretch',
      marginBottom: 14,
    }}>
      {label && (
        <label className="ds-label" style={{ color: highlightColor, display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {required && <span style={{ color: 'var(--ds-amber-400)', fontWeight: 700 }}>*</span>}
        </label>
      )}
      <div>
        {children}
        {hint && !error && <div className="ds-caption" style={{ marginTop: 4 }}>{hint}</div>}
        {error && <div className="ds-caption" style={{ marginTop: 4, color: 'var(--ds-red-400)' }}>{error}</div>}
      </div>
    </div>
  );
}

/* ── Input ────────────────────────────────────────────────────────────── */
function Input({ value, onChange, placeholder, required, type = 'text', autoFilled = false, ...rest }) {
  const isEmpty = required && !value;
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        minHeight: 44,
        background: 'var(--ds-bg-elevated)',
        border: `1px solid ${isEmpty ? 'var(--ds-amber-tint-40)' : 'var(--ds-line-slate)'}`,
        borderRadius: 'var(--ds-radius-lg)',
        padding: '10px 14px',
        color: 'var(--ds-text-primary)',
        fontSize: 14,
        fontFamily: 'var(--ds-font-sans)',
        outline: 'none',
        transition: 'border-color var(--ds-dur-base) var(--ds-ease-out), box-shadow var(--ds-dur-base) var(--ds-ease-out)',
        boxShadow: isEmpty ? 'var(--ds-glow-amber)' : 'none',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--ds-primary-700)';
        e.target.style.boxShadow = 'var(--ds-glow-primary)';
      }}
      onBlur={e => {
        e.target.style.borderColor = isEmpty ? 'var(--ds-amber-tint-40)' : 'var(--ds-line-slate)';
        e.target.style.boxShadow = isEmpty ? 'var(--ds-glow-amber)' : 'none';
      }}
      {...rest}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, ...rest }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        background: 'var(--ds-bg-elevated)',
        border: '1px solid var(--ds-line-slate)',
        borderRadius: 'var(--ds-radius-lg)',
        padding: '10px 14px',
        color: 'var(--ds-text-primary)',
        fontSize: 14,
        fontFamily: 'var(--ds-font-sans)',
        outline: 'none',
        resize: 'vertical',
        minHeight: 96,
        lineHeight: 1.5,
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--ds-primary-700)'; e.target.style.boxShadow = 'var(--ds-glow-primary)'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--ds-line-slate)'; e.target.style.boxShadow = 'none'; }}
      {...rest}
    />
  );
}

/* ── Button ───────────────────────────────────────────────────────────── */
function Button({ children, variant = 'secondary', size = 'md', icon, iconRight, onClick, disabled, loading, style = {}, full = false, ...rest }) {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, var(--ds-primary-600) 0%, var(--ds-primary-700) 100%)',
      color: '#fff',
      border: '1px solid var(--ds-primary-700)',
      fontWeight: 600,
    },
    secondary: {
      background: 'var(--ds-bg-elevated)',
      color: 'var(--ds-text-primary)',
      border: '1px solid var(--ds-line-slate)',
      fontWeight: 500,
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ds-text-muted)',
      border: '1px solid transparent',
      fontWeight: 500,
    },
    outline: {
      background: 'transparent',
      color: 'var(--ds-primary-300)',
      border: '1px solid var(--ds-primary-tint-60)',
      fontWeight: 500,
    },
    danger: {
      background: 'transparent',
      color: 'var(--ds-red-400)',
      border: '1px solid var(--ds-red-tint-30)',
      fontWeight: 500,
    },
    success: {
      background: 'var(--ds-green-tint-15)',
      color: 'var(--ds-green-400)',
      border: '1px solid rgba(34,197,94,0.35)',
      fontWeight: 600,
    },
    line: {
      background: 'var(--ds-line-brand)',
      color: '#fff',
      border: '1px solid var(--ds-line-brand)',
      fontWeight: 600,
    },
  };
  const sizes = {
    sm: { minHeight: 36, padding: '6px 12px', fontSize: 13, borderRadius: 8 },
    md: { minHeight: 44, padding: '10px 16px', fontSize: 14, borderRadius: 10 },
    lg: { minHeight: 52, padding: '14px 22px', fontSize: 15, borderRadius: 12 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
        fontFamily: 'var(--ds-font-sans)',
        width: full ? '100%' : undefined,
        whiteSpace: 'nowrap',
        ...styles[variant],
        ...sizes[size],
        ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading ? <Icon name="loader-2" size={16} style={{ animation: 'ds-spin 1s linear infinite' }} /> : icon && <Icon name={icon} size={16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  );
}

/* ── SelectButton: Ver2.0 §4 §14 binding.
      これが本ウィザードの中核。プルダウンの代替。
      selected を props で受け取り、塗り＋境界で「今何が選択されているか」を明示。 */
function SelectButton({ selected, onClick, disabled, children, size = 'md', icon, style = {}, subLabel, badge }) {
  const s = size === 'sm'
    ? { minHeight: 40, padding: '8px 12px', fontSize: 13 }
    : size === 'lg'
    ? { minHeight: 64, padding: '14px 18px', fontSize: 15 }
    : { minHeight: 48, padding: '12px 16px', fontSize: 14 };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!!selected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: selected ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
        border: `1px solid ${selected ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
        color: selected ? 'var(--ds-text-primary)' : (disabled ? 'var(--ds-text-faint)' : 'var(--ds-text-muted)'),
        borderRadius: 'var(--ds-radius-lg)',
        fontFamily: 'var(--ds-font-sans)',
        fontWeight: selected ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
        textAlign: 'left',
        position: 'relative',
        boxShadow: selected ? 'inset 0 0 0 1px rgba(59,130,246,0.15)' : 'none',
        ...s,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !selected) e.currentTarget.style.borderColor = 'var(--ds-line-slate-2)'; }}
      onMouseLeave={e => { if (!disabled && !selected) e.currentTarget.style.borderColor = 'var(--ds-line-slate)'; }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ds-primary-500)',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name="check" size={12} style={{ color: '#fff' }} />
        </span>
      )}
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 16} style={{ color: selected ? 'var(--ds-primary-300)' : 'var(--ds-text-muted)' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{children}</div>
        {subLabel && (
          <div style={{ fontSize: 11, color: 'var(--ds-text-subtle)', marginTop: 2, fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.3 }}>{subLabel}</div>
        )}
      </div>
      {badge && (
        <span style={{
          background: selected ? 'var(--ds-primary-tint-10)' : 'transparent',
          color: selected ? 'var(--ds-primary-300)' : 'var(--ds-text-subtle)',
          fontSize: 11, padding: '2px 8px', borderRadius: 999,
          border: `1px solid ${selected ? 'var(--ds-primary-tint-60)' : 'var(--ds-line)'}`,
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ── ToggleButton: 業者 / 掛売り 用の独立トグル ────────────────────── */
function ToggleButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        minHeight: 44, padding: '10px 16px',
        background: active ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
        border: `1px solid ${active ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
        borderRadius: 'var(--ds-radius-lg)',
        color: active ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
        fontFamily: 'var(--ds-font-sans)',
        fontSize: 14, fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
      <span style={{
        marginLeft: 6, padding: '2px 8px', borderRadius: 999,
        background: active ? 'var(--ds-primary-500)' : 'var(--ds-bg-panel)',
        color: active ? '#fff' : 'var(--ds-text-subtle)',
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      }}>{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}

/* ── AmberEmpty: 単純な必須未入力バッジ ─────────────────────────────── */
function AmberBadge({ children = '必須' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--ds-amber-tint-10)',
      color: 'var(--ds-amber-400)',
      border: '1px solid var(--ds-amber-tint-40)',
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
    }}>
      <Icon name="alert-circle" size={10} />{children}
    </span>
  );
}

/* ── Modal / Overlay ───────────────────────────────────────────────────── */
function Overlay({ open, onClose, title, subtitle, icon, children, size = 'md', actions }) {
  if (!open) return null;
  const widths = { sm: 420, md: 560, lg: 720, xl: 900 };
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--ds-bg-overlay)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'ds-fade-in var(--ds-dur-base) var(--ds-ease-out)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-line-strong)',
          borderRadius: 'var(--ds-radius-2xl)',
          padding: 24,
          maxWidth: widths[size],
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--ds-shadow-xl), var(--ds-hi-inner)',
          animation: 'ds-scale-in var(--ds-dur-base) var(--ds-ease-out)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          {icon && (
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--ds-primary-tint-10)',
              display: 'grid', placeItems: 'center',
              color: 'var(--ds-primary-300)', flexShrink: 0,
            }}>
              <Icon name={icon} size={20} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            {title && <h2 className="ds-title" style={{ margin: 0 }}>{title}</h2>}
            {subtitle && <p className="ds-caption" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'transparent', border: '1px solid var(--ds-line)',
            color: 'var(--ds-text-muted)', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
        {actions && (
          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Toast: 短い通知（auto-advance 用） ─────────────────────────────── */
function Toast({ open, onClose, message, variant = 'info' }) {
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => onClose && onClose(), 1500);
      return () => clearTimeout(t);
    }
  }, [open, onClose]);
  if (!open) return null;
  const colors = {
    info: { bg: 'var(--ds-primary-tint-10)', bd: 'var(--ds-primary-tint-60)', tx: 'var(--ds-primary-300)', ic: 'info' },
    success: { bg: 'var(--ds-green-tint-15)', bd: 'rgba(34,197,94,0.35)', tx: 'var(--ds-green-400)', ic: 'check-circle-2' },
    warn: { bg: 'var(--ds-amber-tint-10)', bd: 'var(--ds-amber-tint-40)', tx: 'var(--ds-amber-400)', ic: 'alert-triangle' },
  };
  const c = colors[variant];
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: c.bg, border: `1px solid ${c.bd}`,
      borderRadius: 999, padding: '10px 18px',
      color: c.tx, fontSize: 13, fontWeight: 500,
      zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: 'var(--ds-shadow-lg)',
      backdropFilter: 'blur(8px)',
      animation: 'ds-slide-up 0.2s var(--ds-ease-out)',
    }}>
      <Icon name={c.ic} size={16} />
      {message}
    </div>
  );
}

/* ── ErrorBar (§9) ─────────────────────────────────────────────────────── */
function ErrorBar({ message, onClose }) {
  if (!message) return null;
  return (
    <div style={{
      background: 'var(--ds-red-tint-10)',
      border: '1px solid var(--ds-red-tint-30)',
      borderRadius: 12,
      padding: '12px 16px',
      color: 'var(--ds-red-400)',
      fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 16,
    }}>
      <Icon name="alert-triangle" size={16} />
      <div style={{ flex: 1 }}>{message}</div>
      {onClose && (
        <button onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: 4 }}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

/* ── Divider ──────────────────────────────────────────────────────────── */
function Divider({ label }) {
  if (label) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--ds-line)' }} />
        <span className="ds-overline" style={{ padding: 0, color: 'var(--ds-text-subtle)' }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--ds-line)' }} />
      </div>
    );
  }
  return <div style={{ height: 1, background: 'var(--ds-line)', margin: '16px 0' }} />;
}

/* ── Grouped Grid — SelectButton をラップする */
function ChoiceGrid({ columns = 3, children, gap = 10 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap,
    }}>
      {children}
    </div>
  );
}

/* ── Money formatter ─────────────────────────────────────────────────── */
function formatYen(n) {
  if (n === null || n === undefined || isNaN(n)) return '¥0';
  return '¥' + Number(n).toLocaleString('ja-JP');
}

/* ── Screen1 検索モーダル (Ver2.0 §5-Screen1-検索) ─────────────────── */
function CustomerSearchModal({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return window.MOCK_CUSTOMERS;
    const k = q.trim().toLowerCase();
    return window.MOCK_CUSTOMERS.filter(c =>
      (c.name + c.kana + c.phone + c.address + c.plate).toLowerCase().includes(k)
    );
  }, [q]);
  return (
    <Overlay open={open} onClose={onClose} title="既存顧客を検索" subtitle="名前 / フリガナ / 電話 / 住所 / ナンバー下4桁" icon="search" size="lg">
      <Input value={q} onChange={setQ} placeholder="検索キーワードを入力..." />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 13 }}>
            該当する顧客が見つかりません
          </div>
        )}
        {filtered.map(c => (
          <button key={c.id}
            onClick={() => { onPick && onPick(c); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', minHeight: 60,
              background: 'var(--ds-bg-elevated)',
              border: '1px solid var(--ds-line-slate)',
              borderRadius: 12, cursor: 'pointer',
              textAlign: 'left', color: 'var(--ds-text-primary)',
              transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ds-primary-tint-60)'; e.currentTarget.style.background = 'var(--ds-primary-tint-10)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ds-line-slate)'; e.currentTarget.style.background = 'var(--ds-bg-elevated)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ds-primary-tint-10)', display: 'grid', placeItems: 'center', color: 'var(--ds-primary-300)' }}>
              <Icon name="user" size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ds-text-subtle)', marginTop: 2 }}>{c.kana} · {c.phone}</div>
              <div style={{ fontSize: 11, color: 'var(--ds-text-subtle)', marginTop: 2 }}>{c.plate}</div>
            </div>
            <Icon name="chevron-right" size={16} style={{ color: 'var(--ds-text-muted)' }} />
          </button>
        ))}
      </div>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OCR Overlay (v2.2 大改造)
   ------------------------------------------------------------------
   binding: 3 入力方式に対応 (依頼書 §5-Screen1 補記):
   - 📷 カメラで撮影  : <input capture="environment" accept="image/*">
   - 🖼 ファイル選択  : <input accept="image/*"> (カメラなし)
   - 📄 PDF を選ぶ    : <input accept="application/pdf">
   ドラッグ&ドロップも許容 (dragover/drop で受け取り)。
   選択されたファイルは onFile(file, source) で呼び出し元に返し、
   実運用では AI-OCR API に送信。ここでは 1.5 秒後に review フェーズへ。
   ══════════════════════════════════════════════════════════════════ */
function OCROverlay({ open, onClose, onApply, target = '車検証' }) {
  const [phase, setPhase] = useState('upload'); // upload | scanning | review
  const [pickedFile, setPickedFile] = useState(null);
  const [pickedSource, setPickedSource] = useState(null); // camera | photo | pdf | drop
  const [isDragging, setIsDragging] = useState(false);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhase('upload');
      setPickedFile(null);
      setPickedSource(null);
      setIsDragging(false);
    }
  }, [open]);

  /* ファイル受領後は scanning → review へ遷移 (実運用ではここで AI-OCR API 呼び出し) */
  function handleFile(file, source) {
    if (!file) return;
    setPickedFile(file);
    setPickedSource(source);
    setPhase('scanning');
    /* Mock: 実運用ではファイルを AI-OCR API に送信。ここでは 1.5 秒後に review へ */
    setTimeout(() => setPhase('review'), 1500);
  }

  function handleInputChange(source) {
    return (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file, source);
      /* 同じファイルを再度選べるように reset */
      e.target.value = '';
    };
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    /* ファイルタイプで source を推定 */
    const source = file.type === 'application/pdf' ? 'pdf' : 'drop';
    handleFile(file, source);
  }

  return (
    <Overlay open={open} onClose={onClose}
      title={`${target} OCR 読み取り`}
      subtitle={phase === 'upload' ? '3 方式から入力方法を選択' : phase === 'scanning' ? 'AI が読み取り中...' : '読み取り結果を確認'}
      icon={phase === 'scanning' ? 'loader-2' : 'scan-line'} size="lg">
      {phase === 'upload' && (
        <div>
          {/* 隠し input 3 個 — ボタンから起動、ラベルの下 (accessibility) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange('camera')}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange('photo')}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange('pdf')}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />

          {/* ドラッグ&ドロップゾーン + 3 ボタン */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'var(--ds-primary-500)' : 'var(--ds-line-slate)'}`,
              borderRadius: 16, padding: '32px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              background: isDragging ? 'var(--ds-primary-tint-10)' : 'var(--ds-bg-elevated)',
              transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--ds-primary-tint-10)',
              display: 'grid', placeItems: 'center', color: 'var(--ds-primary-300)',
            }}>
              <Icon name="upload-cloud" size={28} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {isDragging ? 'ここにドロップしてください' : '入力方法を選んでください'}
              </div>
              <div className="ds-caption" style={{ marginTop: 4 }}>
                {isDragging ? 'JPEG / PNG / PDF' : 'ドラッグ&ドロップも可 · JPEG / PNG / PDF · 最大 10MB'}
              </div>
            </div>

            {/* 3 ボタン (等幅で並列) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10, width: '100%', maxWidth: 480, marginTop: 4,
            }}>
              <Button variant="primary"   icon="camera"      onClick={() => cameraInputRef.current?.click()}>カメラで撮影</Button>
              <Button variant="secondary" icon="image"       onClick={() => photoInputRef.current?.click()}>ファイル選択</Button>
              <Button variant="secondary" icon="file-text"   onClick={() => pdfInputRef.current?.click()}>PDF を選ぶ</Button>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} style={{ color: 'var(--ds-primary-400)', marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--ds-text-muted)', lineHeight: 1.5 }}>
              読み取り後は<strong style={{ color: 'var(--ds-text-body)' }}>顧客情報と車両情報の両方が自動入力</strong>されます。オペレーターは自由に修正可、ボディサイズは自動確定されません (Ver2.2 §5-Screen1)。
            </div>
          </div>
        </div>
      )}
      {phase === 'scanning' && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', animation: 'ds-spin 1.2s linear infinite', color: 'var(--ds-primary-400)' }}>
            <Icon name="loader-2" size={48} />
          </div>
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 500 }}>AI-OCR で読み取り中...</div>
          <div className="ds-caption" style={{ marginTop: 4 }}>通常 3〜5 秒で完了します</div>
          {pickedFile && (
            <div style={{ marginTop: 16, padding: 10, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ds-text-muted)' }}>
              <Icon name={pickedSource === 'pdf' ? 'file-text' : pickedSource === 'camera' ? 'camera' : 'image'} size={14} />
              <span>{pickedFile.name}</span>
              <span style={{ color: 'var(--ds-text-faint)' }}>· {Math.round(pickedFile.size / 1024)} KB</span>
            </div>
          )}
        </div>
      )}
      {phase === 'review' && (
        <div>
          <div style={{ padding: 12, background: 'var(--ds-green-tint-10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, marginBottom: 16, color: 'var(--ds-green-400)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon name="check-circle-2" size={16} />
            読み取り成功 — 全項目を自動入力しました。必要に応じて修正してください。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['ナンバープレート', '滋賀 330 に 1234'],
              ['メーカー (社名)', 'トヨタ'],
              ['型式', 'AZSH20-AEXNB'],
              ['車体番号', 'AZSH20-1050123'],
              ['初年度登録', '令和3年5月'],
              ['ボディカラー', 'プレシャスシルバー'],
              ['長さ (mm)', '4910'],
              ['幅 (mm)', '1800'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="ds-label" style={{ marginBottom: 4 }}>{k}</div>
                <div style={{
                  background: 'var(--ds-bg-elevated)',
                  border: '1px solid var(--ds-line-slate)',
                  borderRadius: 10, padding: '8px 12px',
                  fontSize: 13, color: 'var(--ds-text-primary)',
                }}>{v}</div>
              </div>
            ))}
          </div>
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>キャンセル</Button>
            <Button variant="primary" icon="check" onClick={() => { onApply && onApply(); onClose(); }}>読み取り結果を適用</Button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ── QR Overlay (LINE ID 用) ─────────────────────────────────────────── */
function QROverlay({ open, onClose, onApply }) {
  return (
    <Overlay open={open} onClose={onClose}
      title="LINE QR コード読み取り"
      subtitle="顧客の LINE QR をカメラで読み取ります"
      icon="qr-code" size="sm">
      <div style={{
        border: '2px dashed var(--ds-line-slate)',
        borderRadius: 16, padding: 20,
        background: 'var(--ds-bg-elevated)',
        aspectRatio: '1 / 1', maxHeight: 320,
        display: 'grid', placeItems: 'center', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 40, border: '1px solid var(--ds-primary-tint-60)', borderRadius: 12,
        }} />
        <div style={{ position: 'absolute', top: 40, left: 40, width: 24, height: 24, borderTop: '3px solid var(--ds-primary-400)', borderLeft: '3px solid var(--ds-primary-400)', borderTopLeftRadius: 8 }} />
        <div style={{ position: 'absolute', top: 40, right: 40, width: 24, height: 24, borderTop: '3px solid var(--ds-primary-400)', borderRight: '3px solid var(--ds-primary-400)', borderTopRightRadius: 8 }} />
        <div style={{ position: 'absolute', bottom: 40, left: 40, width: 24, height: 24, borderBottom: '3px solid var(--ds-primary-400)', borderLeft: '3px solid var(--ds-primary-400)', borderBottomLeftRadius: 8 }} />
        <div style={{ position: 'absolute', bottom: 40, right: 40, width: 24, height: 24, borderBottom: '3px solid var(--ds-primary-400)', borderRight: '3px solid var(--ds-primary-400)', borderBottomRightRadius: 8 }} />
        <div style={{ color: 'var(--ds-text-muted)', textAlign: 'center' }}>
          <Icon name="qr-code" size={64} style={{ color: 'var(--ds-primary-400)' }} />
          <div style={{ fontSize: 12, marginTop: 12 }}>カメラを QR コードに向けてください</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button variant="ghost" onClick={onClose}>閉じる</Button>
        <Button variant="primary" onClick={() => { onApply && onApply('yamada_taro_line'); onClose(); }} icon="check">デモ: 読み取り成功</Button>
      </div>
    </Overlay>
  );
}

/* Global helpers to be attached */
Object.assign(window, {
  Icon, ScreenTitle, Card, Field, Input, Textarea, Button,
  SelectButton, ToggleButton, AmberBadge, Overlay, Toast, ErrorBar, Divider,
  ChoiceGrid, formatYen, CustomerSearchModal, OCROverlay, QROverlay,
});
