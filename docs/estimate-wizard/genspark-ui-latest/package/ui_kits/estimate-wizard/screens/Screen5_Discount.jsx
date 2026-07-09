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

      {/* クーポン */}
      <Card title="クーポン" subtitle="店舗で登録済みのクーポンから選択します（併用可）">
        <ChoiceGrid columns={2} gap={10}>
          {window.COUPONS.map(c => (
            <SelectButton key={c.id} selected={coupons.includes(c.id)} onClick={() => toggleCoupon(c.id)} subLabel={`− ${formatYen(c.amount)}`} icon="ticket">
              {c.name}
            </SelectButton>
          ))}
        </ChoiceGrid>
        {coupons.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--ds-primary-tint-10)', border: '1px solid var(--ds-primary-tint-60)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ds-primary-300)' }}>クーポン合計 ({coupons.length} 件)</span>
            <span className="ds-numeric" style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>
              − {formatYen(coupons.reduce((a, id) => a + (window.COUPONS.find(c => c.id === id)?.amount || 0), 0))}
            </span>
          </div>
        )}
      </Card>

      {/* 値引き (金額 or %) */}
      <Card title="値引き" subtitle="金額 (¥) と パーセンテージ (%) は どちらか一方のみ選択できます">
        <ChoiceGrid columns={3} gap={10}>
          <SelectButton selected={discMode === 'none'} onClick={() => pickMode('none')}      icon="x">値引き無し</SelectButton>
          <SelectButton selected={discMode === 'amount'}  onClick={() => pickMode('amount')} icon="minus">金額で指定</SelectButton>
          <SelectButton selected={discMode === 'percent'} onClick={() => pickMode('percent')} icon="percent">% で指定</SelectButton>
        </ChoiceGrid>

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
