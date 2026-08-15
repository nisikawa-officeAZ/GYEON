/* =============================================================================
   Estimate Wizard — Shell
   -----------------------------------------------------------------------------
   サイドバー・上部ヘッダー・7 ノード ステッパー・Sticky Total Panel。
   Ver2.0 §6 §9 §10 §11 §12 の binding をすべて表面化する。
   ============================================================================= */

const { useState: useStateShell, useEffect: useEffectShell, useMemo: useMemoShell } = React;

/* ── ステップ定義 (Ver2.0 §5 固定順) ───────────────────────────────── */
const STEPS = [
  { id: 1, key: 'customer',  label: '顧客登録',       short: '顧客', icon: 'user' },
  { id: 2, key: 'vehicle',   label: '車両登録',       short: '車両', icon: 'car' },
  { id: 3, key: 'category',  label: '作業内容選択',   short: '作業', icon: 'sparkles' },
  { id: 4, key: 'estimate',  label: '見積',           short: '見積', icon: 'receipt' },
  { id: 5, key: 'discount',  label: '値引き / クーポン', short: '値引', icon: 'tag' },
  { id: 6, key: 'notes',     label: '備考',           short: '備考', icon: 'notepad-text' },
  { id: 7, key: 'review',    label: '確認',           short: '確認', icon: 'check-circle-2' },
];
window.STEPS = STEPS;

/* ── サイドバー (Desktop のみ) ─────────────────────────────────────── */
function Sidebar({ onNavHome }) {
  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 'var(--ds-sidebar-w)',
      background: 'linear-gradient(180deg, #0b1428 0%, #080d1a 100%)',
      borderRight: '1px solid var(--ds-line)',
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 20px', borderBottom: '1px solid var(--ds-line)', marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
          background: '#000', border: '1px solid var(--ds-line)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
          <img src="../../assets/gyeon-detailer-logo.png" alt="GYEON" style={{ width: 30, height: 30, objectFit: 'contain' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: '#fff' }}>
            GYEON<sup style={{ fontSize: 8, marginLeft: 2 }}>®</sup>
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.2, color: 'var(--ds-text-subtle)' }}>
            DETAILER AGENT
          </div>
        </div>
      </div>

      <div className="ds-overline" style={{ padding: '0 8px 8px' }}>MAIN MENU</div>

      {[
        { icon: 'home',         label: 'ダッシュボード', en: 'HOME' },
        { icon: 'file-text',    label: '見積もり一覧',   en: 'ESTIMATES', active: true },
        { icon: 'briefcase',    label: '作業管理',       en: 'WORK' },
        { icon: 'users',        label: '顧客管理',       en: 'CUSTOMERS' },
        { icon: 'car',          label: '車両管理',       en: 'VEHICLES' },
        { icon: 'calendar',     label: '予約管理',       en: 'RESERVATIONS' },
        { icon: 'message-circle', label: 'LINE',         en: 'MESSAGING' },
        { icon: 'shopping-bag', label: '商品注文',       en: 'ORDERS' },
        { icon: 'settings',     label: '設定',           en: 'SETTINGS' },
      ].map((it) => (
        <button key={it.label}
          onClick={it.label === 'ダッシュボード' ? onNavHome : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 12px', minHeight: 44,
            background: it.active ? 'var(--ds-primary-tint-10)' : 'transparent',
            border: `1px solid ${it.active ? 'var(--ds-primary-tint-60)' : 'transparent'}`,
            borderRadius: 10,
            color: it.active ? 'var(--ds-primary-300)' : 'var(--ds-text-body)',
            cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--ds-font-sans)',
            fontSize: 13, fontWeight: it.active ? 600 : 500,
            transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
          }}
          onMouseEnter={e => { if (!it.active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          onMouseLeave={e => { if (!it.active) e.currentTarget.style.background = 'transparent'; }}
        >
          <Icon name={it.icon} size={16} />
          <span style={{ flex: 1 }}>{it.label}</span>
          <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--ds-text-faint)', fontWeight: 700 }}>{it.en}</span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--ds-line)', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--ds-green-400)', letterSpacing: 0.5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ds-green-500)', boxShadow: '0 0 8px var(--ds-green-500)' }} />
          SYSTEM ONLINE · v2.6
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
          }}>NW</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ds-text-primary)' }}>Nishikawa</div>
            <div style={{ fontSize: 10, color: 'var(--ds-text-subtle)', letterSpacing: 0.3 }}>ADMIN · GYEON STORE</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── TopHeader (Mobile 最適化) ───────────────────────────────────────
   高さ 56px、ハンバーガー + タイトル + 合計ピル で完結。
   iOS/Android のネイティブ Nav Bar に近い高さと構成。
   safe-area-inset-top を尊重してノッチ / ダイナミックアイランド回避。 */
function TopHeader({ estimateNo, mode = 'new', onCancel, autoSaveState = 'saved', totalPill = null, onOpenMenu }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      height: 'calc(var(--ds-header-h) + env(safe-area-inset-top, 0px))',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      background: 'rgba(8, 13, 26, 0.92)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--ds-line)',
    }}>
      <div style={{
        height: 'var(--ds-header-h)',
        padding: '0 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* ハンバーガーメニュー (左) */}
        <button onClick={onOpenMenu} aria-label="メニュー" style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'transparent', border: 'none',
          color: 'var(--ds-text-primary)', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <Icon name="menu" size={22} />
        </button>

        {/* タイトル (中央、コンパクト) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ds-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mode === 'edit' ? '見積編集' : '新規見積'}
          </div>
          {estimateNo && (
            <div style={{
              fontSize: 10, color: 'var(--ds-text-subtle)',
              fontFamily: 'var(--ds-font-num)', letterSpacing: 0.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              #{estimateNo}
              {autoSaveState === 'saved' && <span style={{ color: 'var(--ds-green-400)', marginLeft: 6 }}>✓ 自動保存</span>}
              {autoSaveState === 'saving' && <span style={{ color: 'var(--ds-primary-400)', marginLeft: 6 }}>保存中...</span>}
              {autoSaveState === 'dirty' && <span style={{ color: 'var(--ds-amber-400)', marginLeft: 6 }}>未保存</span>}
            </div>
          )}
        </div>

        {/* 合計ミニピル (右) */}
        {totalPill}
      </div>
    </header>
  );
}

/* ── HamburgerMenu ─────────────────────────────────────────────
   TopHeader のハンバーガーボタンから呼ばれるボトムシート型メニュー。
   デスクトップのサイドバーと同等の遷移先を提供。 */
function HamburgerMenu({ open, onClose, onNavHome }) {
  const items = [
    { icon: 'home',         label: 'ダッシュボード', onClick: onNavHome },
    { icon: 'file-text',    label: '見積もり一覧',   active: true },
    { icon: 'briefcase',    label: '作業管理' },
    { icon: 'users',        label: '顧客管理' },
    { icon: 'car',          label: '車両管理' },
    { icon: 'calendar',     label: '予約管理' },
    { icon: 'message-circle', label: 'LINE' },
    { icon: 'shopping-bag', label: '商品注文' },
    { icon: 'settings',     label: '設定' },
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title="メニュー" icon="menu">
      {/* GYEON ブランド (ヘッダー的な役割) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 4px 16px',
        borderBottom: '1px solid var(--ds-line)', marginBottom: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
          background: '#000', border: '1px solid var(--ds-line)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <img src="../../assets/gyeon-detailer-logo.png" alt="GYEON" style={{ width: 30, height: 30, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.4, color: '#fff' }}>
            GYEON<sup style={{ fontSize: 8, marginLeft: 2 }}>®</sup>
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.2, color: 'var(--ds-text-subtle)' }}>
            DETAILER AGENT
          </div>
        </div>
      </div>

      {/* メニュー項目 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(it => (
          <button key={it.label} onClick={() => { it.onClick && it.onClick(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 12px', minHeight: 52,
              background: it.active ? 'var(--ds-primary-tint-10)' : 'transparent',
              border: `1px solid ${it.active ? 'var(--ds-primary-tint-60)' : 'transparent'}`,
              borderRadius: 12,
              color: it.active ? 'var(--ds-primary-300)' : 'var(--ds-text-body)',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--ds-font-sans)',
              fontSize: 15, fontWeight: it.active ? 600 : 500,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon name={it.icon} size={20} />
            <span style={{ flex: 1 }}>{it.label}</span>
            <Icon name="chevron-right" size={16} style={{ color: 'var(--ds-text-faint)' }} />
          </button>
        ))}
      </div>

      {/* ユーザー情報 */}
      <div style={{
        marginTop: 16, padding: '12px', borderTop: '1px solid var(--ds-line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff',
        }}>NW</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ds-text-primary)' }}>Nishikawa</div>
          <div style={{ fontSize: 11, color: 'var(--ds-text-subtle)' }}>ADMIN · GYEON STORE</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ds-green-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ds-green-500)' }} />
          v2.6
        </div>
      </div>
    </BottomSheet>
  );
}

/* ── Sidebar (Mobile では未使用だが、既存互換のため残す) ────────── */
function _SidebarUnusedInMobile() { return null; }

/* ── Stepper (Ver2.0 §9 §10 — 全ステップ 1タップジャンプ可) ─────────── */
function Stepper({ current, onJump, completeSet }) {
  return (
    <nav style={{
      padding: '20px 24px 12px',
      display: 'flex', alignItems: 'center',
      gap: 0, background: 'transparent',
      overflow: 'hidden',
    }}>
      {STEPS.map((s, idx) => {
        const isActive = s.id === current;
        const isDone = completeSet && completeSet.has(s.id);
        const isLast = idx === STEPS.length - 1;
        return (
          <React.Fragment key={s.id}>
            <button onClick={() => onJump(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: 'none',
              padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
              flex: 1, minWidth: 0, position: 'relative',
              transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
              color: isActive ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
              fontFamily: 'var(--ds-font-sans)',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: isActive
                  ? 'linear-gradient(135deg, var(--ds-primary-600), var(--ds-primary-700))'
                  : isDone
                  ? 'var(--ds-green-tint-15)'
                  : 'var(--ds-bg-elevated)',
                border: isActive
                  ? '1px solid var(--ds-primary-500)'
                  : isDone
                  ? '1px solid rgba(34,197,94,0.35)'
                  : '1px solid var(--ds-line-slate)',
                color: isActive ? '#fff' : isDone ? 'var(--ds-green-400)' : 'var(--ds-text-muted)',
                fontSize: 13, fontWeight: 700,
                boxShadow: isActive ? '0 0 0 3px var(--ds-primary-tint-10)' : 'none',
              }}>
                {isDone && !isActive ? <Icon name="check" size={14} /> : s.id}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: isActive ? 'var(--ds-primary-400)' : 'var(--ds-text-faint)' }}>
                  STEP {s.id}
                </div>
                <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.label}
                </div>
              </div>
            </button>
            {!isLast && (
              <div style={{
                width: 24, height: 1,
                background: 'var(--ds-line)',
                flexShrink: 0,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ── MobileStepper (依頼書 §8 準拠) ─────────────────────────────────
   「3 / 7 作業内容」+ ドット進捗 + タップでボトムシート展開。
   iOS/Android のネイティブっぽい minimal な表現。 */
function CompactStepper({ current, onJump, total = 7 }) {
  const [expand, setExpand] = useStateShell(false);
  const curStep = STEPS.find(s => s.id === current);
  return (
    <>
      {/* ヘッダー直下、ドット進捗 + タップでシート展開 */}
      <button
        onClick={() => setExpand(true)}
        aria-label="ステップを選択"
        style={{
          position: 'sticky', top: 'calc(var(--ds-header-h) + env(safe-area-inset-top, 0px))', zIndex: 20,
          width: '100%',
          padding: '10px 16px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--ds-line)',
          border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          display: 'flex', flexDirection: 'column', gap: 8,
          cursor: 'pointer',
          fontFamily: 'var(--ds-font-sans)',
          color: 'var(--ds-text-primary)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* 上段: 「3 / 7 作業内容」*/}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
            color: 'var(--ds-primary-400)',
            padding: '3px 8px',
            background: 'var(--ds-primary-tint-10)',
            border: '1px solid var(--ds-primary-tint-60)',
            borderRadius: 999,
            fontFamily: 'var(--ds-font-num)',
          }}>
            {current} / {total}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {curStep && curStep.label}
          </span>
          <Icon name="chevron-down" size={16} style={{ color: 'var(--ds-text-muted)' }} />
        </div>
        {/* 下段: ドット進捗 (7 個のドットで) */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {STEPS.map(s => {
            const state = s.id < current ? 'done' : s.id === current ? 'current' : 'pending';
            return (
              <div key={s.id} style={{
                flex: 1, height: 4, borderRadius: 999,
                background: state === 'done'
                  ? 'var(--ds-primary-500)'
                  : state === 'current'
                  ? 'var(--ds-primary-400)'
                  : 'var(--ds-line-strong)',
                boxShadow: state === 'current' ? '0 0 8px rgba(79,142,247,0.5)' : 'none',
                transition: 'all var(--ds-dur-base) var(--ds-ease-out)',
              }} />
            );
          })}
        </div>
      </button>

      {/* シート展開: 全 7 ステップを縦リストで表示、タップでジャンプ */}
      <BottomSheet
        open={expand}
        onClose={() => setExpand(false)}
        title="ステップを選択"
        subtitle="任意のステップに 1 タップでジャンプ"
        icon="list"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map(s => {
            const isActive = s.id === current;
            const isDone = s.id < current;
            return (
              <button key={s.id}
                onClick={() => { onJump(s.id); setExpand(false); }}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', minHeight: 60,
                  background: isActive ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
                  border: `1px solid ${isActive ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
                  borderRadius: 12,
                  color: isActive ? '#fff' : 'var(--ds-text-primary)',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--ds-font-sans)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* ステップ番号 or チェック */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isActive
                    ? 'linear-gradient(135deg, var(--ds-primary-600), var(--ds-primary-700))'
                    : isDone
                    ? 'var(--ds-green-tint-15)'
                    : 'var(--ds-bg-panel)',
                  border: `1px solid ${isActive ? 'var(--ds-primary-500)' : isDone ? 'rgba(34,197,94,0.35)' : 'var(--ds-line)'}`,
                  color: isActive ? '#fff' : isDone ? 'var(--ds-green-400)' : 'var(--ds-text-muted)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {isDone ? <Icon name="check" size={14} /> : s.id}
                </div>
                {/* ラベル */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: isActive ? 'var(--ds-primary-200)' : 'var(--ds-text-subtle)', textTransform: 'uppercase' }}>
                    STEP {s.id}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: isActive ? 600 : 500 }}>
                    {s.label}
                  </div>
                </div>
                <Icon name={s.icon} size={18} style={{ color: isActive ? 'var(--ds-primary-200)' : 'var(--ds-text-muted)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}

/* ── Sticky Total Panel (Ver2.0 §12) ───────────────────────────────── */
function StickyTotalPanel({ subtotals, discount = 0, taxRate = 0.10, onSave, onNext, onBack, isFirst, isLast, primaryLabel }) {
  const subtotal = subtotals.reduce((a, b) => a + b.amount, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * taxRate);
  const total = afterDiscount + tax;
  return (
    /* 追従・上端揃えは外側の .wz-total-slot が担当（grid 直接子で sticky 発動）。
       このパネル自体は純粋なカードとして描画に専念する。 */
    <aside style={{
      width: '100%',
      background: 'var(--ds-bg-card)',
      border: '1px solid var(--ds-line)',
      borderRadius: 'var(--ds-radius-xl)',
      boxShadow: 'var(--ds-shadow-lg), var(--ds-hi-inner)',
      padding: 20,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',   /* 内側スクロールは overflowY で明示的に制御 */
      minHeight: 0,
    }}>
      <div className="ds-overline" style={{ marginBottom: 12, padding: 0, color: 'var(--ds-primary-400)' }}>お見積合計</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {subtotals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ds-text-faint)', fontSize: 12, padding: '20px 0' }}>
            <Icon name="inbox" size={24} />
            <div style={{ marginTop: 8 }}>まだ項目がありません</div>
          </div>
        ) : subtotals.map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            fontSize: 12, color: 'var(--ds-text-muted)',
            padding: '4px 0',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginRight: 6 }}>{r.label}</span>
            <span className="ds-numeric" style={{ color: 'var(--ds-text-body)', flexShrink: 0 }}>{formatYen(r.amount)}</span>
          </div>
        ))}
      </div>

      <div style={{ margin: '16px 0 12px', height: 1, background: 'var(--ds-line)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ds-text-muted)' }}>
          <span>小計</span><span className="ds-numeric" style={{ color: 'var(--ds-text-body)' }}>{formatYen(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ds-amber-400)' }}>
            <span>値引き</span><span className="ds-numeric">−{formatYen(discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ds-text-muted)' }}>
          <span>消費税 ({Math.round(taxRate * 100)}%)</span>
          <span className="ds-numeric" style={{ color: 'var(--ds-text-body)' }}>{formatYen(tax)}</span>
        </div>
      </div>

      <div style={{ margin: '12px 0', height: 1, background: 'var(--ds-line-strong)' }} />

      {/* 200px 幅パネルに 7 桁金額 (例: ¥1,040,490) を確実に収めるため縦積み。
          ラベルは overline 極小、金額は大きく単独行で最大インパクト。 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="ds-overline" style={{ padding: 0, color: 'var(--ds-text-body)' }}>合計 (税込)</span>
        <span className="ds-price-total" style={{
          fontSize: 26,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{formatYen(total)}</span>
      </div>

      {/* 「次へ / 戻る / 保存」は Ver2.0 §11 準拠で下部固定ナビ (BottomNav) が正本。
         Sticky Total パネルは金額表示に専念する。
         (以前は重複してこの位置に「次へ」「戻る」があったが、ユーザー指摘により削除) */}
    </aside>
  );
}

/* ── MobileTotalBar (依頼書 §8 準拠・Mobile 版で完結) ─────────────
   下部固定バーに [戻る] [合計金額] [次へ/保存] を配置。
   合計金額タップで内訳ボトムシートが開く。
   safe-area-inset-bottom を考慮してホームインジケーターを避ける。 */
function MobileTotalBar({ subtotals, discount = 0, taxRate = 0.10, onNext, onBack, onOpenBreakdown, isFirst, isLast, onSave }) {
  const subtotal = subtotals.reduce((a, b) => a + b.amount, 0);
  const total = Math.round((subtotal - discount) * (1 + taxRate));
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: 'rgba(8, 13, 26, 0.94)',
      borderTop: '1px solid var(--ds-line-strong)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {/* 戻る (isFirst の時は非表示) */}
      {!isFirst && (
        <button onClick={onBack} aria-label="戻る" style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--ds-bg-elevated)',
          border: '1px solid var(--ds-line-slate)',
          color: 'var(--ds-text-primary)',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer', flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <Icon name="arrow-left" size={20} />
        </button>
      )}

      {/* 合計 (タップで内訳シート) */}
      <button onClick={onOpenBreakdown} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
        background: 'transparent', border: 'none',
        padding: '4px 8px', cursor: 'pointer',
        color: 'var(--ds-text-primary)', flex: 1, minWidth: 0,
        fontFamily: 'var(--ds-font-sans)',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <span style={{ fontSize: 9, color: 'var(--ds-text-muted)', letterSpacing: 1, fontWeight: 700 }}>合計 (税込)</span>
        <span style={{
          fontFamily: 'var(--ds-font-num)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 20, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 6,
          letterSpacing: -0.01,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {formatYen(total)}
          <Icon name="chevron-up" size={12} style={{ color: 'var(--ds-text-muted)' }} />
        </span>
      </button>

      {/* 次へ / 保存 (最終ステップは保存) */}
      <Button
        variant="primary"
        size="lg"
        icon={isLast ? 'save' : undefined}
        iconRight={!isLast ? 'arrow-right' : undefined}
        onClick={isLast ? onSave : onNext}
        style={{ minWidth: 100 }}
      >
        {isLast ? '保存' : '次へ'}
      </Button>
    </div>
  );
}

/* ── BottomNav (Mobile では使わない・互換用の no-op) ──────────────── */
function BottomNav() { return null; }

/* Global export (Mobile: adds HamburgerMenu; Sidebar/StickyTotalPanel/Stepper は互換用に残す) */
Object.assign(window, {
  Sidebar, TopHeader, Stepper, CompactStepper,
  StickyTotalPanel, MobileTotalBar, BottomNav,
  HamburgerMenu,
});
