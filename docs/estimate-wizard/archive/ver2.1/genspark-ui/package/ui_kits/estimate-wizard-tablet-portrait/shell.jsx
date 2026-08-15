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

/* ── ヘッダー (Desktop) ────────────────────────────────────────────── */
function TopHeader({ estimateNo, mode = 'new', onCancel, autoSaveState = 'saved', totalPill = null }) {
  const savedText = {
    saving: '保存中...',
    saved:  '自動保存済み',
    dirty:  '未保存の変更',
  }[autoSaveState];
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      height: 'var(--ds-header-h)',
      padding: '0 24px',
      background: 'rgba(8, 13, 26, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--ds-line)',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ds-text-muted)' }}>
        <button onClick={onCancel} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', color: 'var(--ds-text-muted)',
          padding: 6, borderRadius: 8, cursor: 'pointer', fontSize: 12,
          fontFamily: 'var(--ds-font-sans)',
        }}>
          <Icon name="chevron-left" size={14} />
          見積一覧
        </button>
        <span style={{ color: 'var(--ds-text-faint)' }}>/</span>
        <span style={{ color: 'var(--ds-primary-400)', fontWeight: 500 }}>
          {mode === 'edit' ? '見積編集' : '新規見積'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {estimateNo && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 999,
          background: 'var(--ds-bg-panel)', border: '1px solid var(--ds-line)',
          fontSize: 12, color: 'var(--ds-text-muted)',
          fontFamily: 'var(--ds-font-num)',
        }}>
          <Icon name="hash" size={12} />
          <span className="ds-numeric">{estimateNo}</span>
        </div>
      )}

      {/* 合計ミニピル: 中央幅が狭い bp (768-899) で Sticky Total パネルが畳まれた
         時のみ CSS で display:inline-flex になり表示される。それ以外は display:none。
         タップで内訳ドロワー (parent 側で管理) を開く。 */}
      {totalPill}

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: autoSaveState === 'dirty' ? 'var(--ds-amber-400)' : 'var(--ds-green-400)',
      }}>
        {autoSaveState === 'saving' ? (
          <Icon name="loader-2" size={12} style={{ animation: 'ds-spin 1s linear infinite' }} />
        ) : autoSaveState === 'saved' ? (
          <Icon name="check" size={12} />
        ) : (
          <Icon name="circle" size={8} style={{ fill: 'currentColor' }} />
        )}
        <span style={{ letterSpacing: 0.3 }}>{savedText}</span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--ds-line)' }} />

      <button style={{
        width: 36, height: 36, borderRadius: 10, background: 'transparent', border: '1px solid var(--ds-line)',
        color: 'var(--ds-text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
      }}>
        <Icon name="bell" size={16} />
      </button>
      <button style={{
        width: 36, height: 36, borderRadius: 10, background: 'transparent', border: '1px solid var(--ds-line)',
        color: 'var(--ds-text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
      }}>
        <Icon name="help-circle" size={16} />
      </button>
    </header>
  );
}

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

/* ── モバイル用コンパクトステッパー ─────────────────────────────────── */
function CompactStepper({ current, onJump, total = 7 }) {
  const [expand, setExpand] = useStateShell(false);
  const curStep = STEPS.find(s => s.id === current);
  return (
    <>
      <div style={{
        padding: '12px 16px',
        background: 'var(--ds-bg-panel)',
        borderBottom: '1px solid var(--ds-line)',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 'var(--ds-header-h)', zIndex: 20,
      }}>
        <button onClick={() => setExpand(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--ds-bg-elevated)',
          border: '1px solid var(--ds-line-slate)',
          padding: '8px 12px', borderRadius: 10, minHeight: 44, flex: 1,
          color: 'var(--ds-text-primary)', cursor: 'pointer',
          fontFamily: 'var(--ds-font-sans)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--ds-primary-600), var(--ds-primary-700))',
            display: 'grid', placeItems: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700,
          }}>{current}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--ds-text-muted)', fontWeight: 600 }}>STEP {current} / {total}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{curStep && curStep.label}</div>
          </div>
          <Icon name={expand ? 'chevron-up' : 'chevron-down'} size={16} style={{ color: 'var(--ds-text-muted)' }} />
        </button>
      </div>
      {/* Dot progress */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', background: 'var(--ds-bg-panel)', borderBottom: '1px solid var(--ds-line)' }}>
        {STEPS.map(s => (
          <div key={s.id} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: s.id <= current ? 'var(--ds-primary-500)' : 'var(--ds-line)',
            transition: 'all var(--ds-dur-base) var(--ds-ease-out)',
          }} />
        ))}
      </div>
      {expand && (
        <Overlay open={expand} onClose={() => setExpand(false)} title="スクリーンを選択" icon="list" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STEPS.map(s => (
              <SelectButton key={s.id}
                selected={s.id === current}
                icon={s.icon}
                onClick={() => { onJump(s.id); setExpand(false); }}
              >
                <span style={{ fontSize: 10, letterSpacing: 1, color: 'var(--ds-text-muted)', marginRight: 8 }}>STEP {s.id}</span>
                {s.label}
              </SelectButton>
            ))}
          </div>
        </Overlay>
      )}
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

/* ── モバイル下部固定合計バー ─────────────────────────────────────── */
function MobileTotalBar({ subtotals, discount = 0, taxRate = 0.10, onNext, onOpenBreakdown, isLast, onSave }) {
  const subtotal = subtotals.reduce((a, b) => a + b.amount, 0);
  const total = Math.round((subtotal - discount) * (1 + taxRate));
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: 'rgba(8,13,26,0.92)',
      borderTop: '1px solid var(--ds-line-strong)',
      backdropFilter: 'blur(12px)',
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button onClick={onOpenBreakdown} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--ds-text-primary)', flex: 1, minWidth: 0,
        fontFamily: 'var(--ds-font-sans)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--ds-text-muted)', letterSpacing: 1, fontWeight: 600 }}>合計 (税込)</span>
        <span className="ds-price-total" style={{ fontSize: 22, display: 'flex', alignItems: 'center', gap: 6 }}>
          {formatYen(total)} <Icon name="chevron-up" size={14} />
        </span>
      </button>
      <Button variant="primary" size="lg" icon={isLast ? 'save' : undefined} iconRight={!isLast ? 'arrow-right' : undefined} onClick={isLast ? onSave : onNext}>
        {isLast ? '保存' : '次へ'}
      </Button>
    </div>
  );
}

/* ── Bottom nav (Desktop でもフッターに配置) ───────────────────────── */
function BottomNav({ isFirst, isLast, onBack, onNext, extra }) {
  return (
    <div style={{
      display: 'flex', gap: 12, marginTop: 32, padding: '16px 0',
      borderTop: '1px solid var(--ds-line)',
      alignItems: 'center',
    }}>
      <Button variant="ghost" icon="arrow-left" onClick={onBack} disabled={isFirst}>戻る</Button>
      <div style={{ flex: 1 }} />
      {extra}
      {!isLast && (
        <Button variant="primary" iconRight="arrow-right" onClick={onNext}>次へ</Button>
      )}
    </div>
  );
}

/* Global export */
Object.assign(window, {
  Sidebar, TopHeader, Stepper, CompactStepper,
  StickyTotalPanel, MobileTotalBar, BottomNav,
});
