/* =============================================================================
   Screen 5 — 値引き / クーポン (Discount / Coupon)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen5 準拠。
   - クーポン: 押しボタン複数選択可 (店舗設定で登録・動的)
   - 値引き: 金額 or % のどちらか一方 (両方不可・binding)
   - % 入力時は現在の小計から円換算して適用
   ============================================================================= */

function Screen5_Discount({ store, updateStore }) {
  const [coupons, setCoupons] = React.useState(store.coupons || []);
  const [discMode, setDiscMode] = React.useState(store.discMode || 'none'); // 'none' | 'amount' | 'percent'
  const [amount, setAmount] = React.useState(store.discAmount || 0);
  const [percent, setPercent] = React.useState(store.discPercent || 0);

  const subtotal = (store.__lineItems || []).reduce((a, r) => a + r.qty * r.unit, 0);
  const percentEquiv = Math.round((subtotal * (percent || 0)) / 100);

  function toggleCoupon(id) {
    const next = coupons.includes(id) ? coupons.filter(x => x !== id) : [...coupons, id];
    setCoupons(next);
    updateStore({ coupons: next });
  }

  function pickMode(m) {
    setDiscMode(m);
    if (m === 'none') { setAmount(0); setPercent(0); updateStore({ discMode: m, discAmount: 0, discPercent: 0 }); }
    else updateStore({ discMode: m });
  }

  return (
    <div>
      <ScreenTitle step={5} title="値引き / クーポン" subtitle="クーポンは複数選択可。値引きは金額または % のどちらか一方のみです。" />

      {/* クーポン (Mobile: 1 列で横長カード、名前+金額を横並びで) */}
      <Card title="クーポン" subtitle="店舗で登録済みのクーポンから選択します（併用可）">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {window.COUPONS.map(c => {
            const selected = coupons.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCoupon(c.id)}
                aria-pressed={selected}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', minHeight: 56,
                  background: selected ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
                  border: `1px solid ${selected ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
                  borderRadius: 12,
                  color: selected ? '#fff' : 'var(--ds-text-primary)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  fontFamily: 'var(--ds-font-sans)',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
                }}
              >
                {/* 左: アイコン */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: selected ? 'rgba(59,130,246,0.20)' : 'var(--ds-bg-panel)',
                  color: selected ? 'var(--ds-primary-200)' : 'var(--ds-text-muted)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Icon name="ticket" size={18} />
                </div>
                {/* 中央: クーポン名 (フル幅活用) */}
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                </div>
                {/* 右: 金額 */}
                <div className="ds-numeric" style={{
                  fontSize: 14, fontWeight: 700,
                  color: selected ? '#fff' : 'var(--ds-amber-400)',
                  flexShrink: 0,
                }}>
                  − {formatYen(c.amount)}
                </div>
                {/* 選択アイコン (右端に) */}
                {selected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--ds-primary-500)',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    <Icon name="check" size={12} style={{ color: '#fff' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {coupons.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--ds-primary-tint-10)', border: '1px solid var(--ds-primary-tint-60)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ds-primary-300)' }}>クーポン合計 ({coupons.length} 件)</span>
            <span className="ds-numeric" style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>
              − {formatYen(coupons.reduce((a, id) => a + (window.COUPONS.find(c => c.id === id)?.amount || 0), 0))}
            </span>
          </div>
        )}
      </Card>

      {/* 値引き (Mobile: 3 択を 1 行横並び、短ラベルで縦割れ回避) */}
      <Card title="値引き" subtitle="金額 (¥) と パーセンテージ (%) は どちらか一方のみ">
        {/* 3 択を横並びで短ラベルに (「値引き無し」→「なし」、「金額で指定」→「¥ 金額」、「% で指定」→「% 割引」) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[
            { id: 'none',    icon: 'x',       label: 'なし' },
            { id: 'amount',  icon: 'minus',   label: '¥ 金額' },
            { id: 'percent', icon: 'percent', label: '% 割引' },
          ].map(opt => {
            const selected = discMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => pickMode(opt.id)}
                aria-pressed={selected}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  minHeight: 72, padding: '10px 6px',
                  background: selected ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
                  border: `1px solid ${selected ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
                  borderRadius: 12,
                  color: selected ? '#fff' : 'var(--ds-text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--ds-font-sans)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon name={opt.icon} size={18} style={{ color: selected ? 'var(--ds-primary-200)' : 'var(--ds-text-muted)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {discMode === 'amount' && (
          <div style={{ marginTop: 16 }}>
            <Field label="値引き金額 (¥)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 320 }}>
                <span style={{ color: 'var(--ds-text-muted)', fontSize: 16 }}>¥</span>
                <Input type="number" value={amount} onChange={v => { setAmount(Number(v)); updateStore({ discAmount: Number(v) }); }} placeholder="0" />
              </div>
            </Field>
          </div>
        )}

        {discMode === 'percent' && (
          <div style={{ marginTop: 16 }}>
            <Field label="値引き %" hint={`現在の小計 ${formatYen(subtotal)} から自動換算します`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 320 }}>
                <Input type="number" value={percent} onChange={v => { setPercent(Number(v)); updateStore({ discPercent: Number(v) }); }} placeholder="10" />
                <span style={{ color: 'var(--ds-text-muted)', fontSize: 16 }}>%</span>
                <span style={{ marginLeft: 12, color: 'var(--ds-primary-300)', fontWeight: 600 }} className="ds-numeric">
                  = − {formatYen(percentEquiv)}
                </span>
              </div>
            </Field>
          </div>
        )}
      </Card>
    </div>
  );
}

window.Screen5_Discount = Screen5_Discount;
