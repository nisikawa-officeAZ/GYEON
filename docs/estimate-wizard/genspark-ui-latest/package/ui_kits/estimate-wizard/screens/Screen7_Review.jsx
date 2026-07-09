/* =============================================================================
   Screen 7 — 確認 (Review)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen7 準拠。
   - 全内容を表示
   - 修正 / キャンセル / 保存 / PDF / LINE / 予約カレンダー / 請求書 / 納品書 / 納品請求書
   - キャンセル以外は自動保存 (Ver2.0 binding)
   - LINE 表記出し分け: Business API 設定済 → 「LINE送信」/ 未設定 → 「LINE文章コピー」
   - WhatsApp / Instagram / X は今回未実装 (API 登録時に自動追加できる拡張設計)
   ============================================================================= */

function Screen7_Review({ store, onJump, onSave }) {
  const [toast, setToast] = React.useState(null);

  const lineBusiness = window.COMM_STATE?.lineBusinessConfigured;
  const lineLabel = lineBusiness ? 'LINE 送信' : 'LINE 文章コピー';
  const lineIcon = lineBusiness ? 'send' : 'copy';

  const subtotal = (store.__lineItems || []).reduce((a, r) => a + r.qty * r.unit, 0);
  const couponTotal = (store.coupons || []).reduce((a, id) => a + (window.COUPONS.find(c => c.id === id)?.amount || 0), 0);
  const discountAmt = store.discMode === 'amount' ? (store.discAmount || 0)
                    : store.discMode === 'percent' ? Math.round(subtotal * (store.discPercent || 0) / 100)
                    : 0;
  const totalDiscount = couponTotal + discountAmt;
  const afterDisc = Math.max(0, subtotal - totalDiscount);
  const tax = Math.round(afterDisc * 0.1);
  const total = afterDisc + tax;

  const c = store.customer || {};
  const v = store.vehicle || {};

  return (
    <div>
      <ScreenTitle step={7} title="確認" subtitle="内容を確認して見積を確定します。キャンセル以外は自動保存されます。" />

      {/* サマリー */}
      <Card title="サマリー" actions={<Button variant="ghost" size="sm" icon="pencil" onClick={() => onJump(1)}>顧客・車両を修正</Button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <SummaryBlock icon="user" label="顧客" onEdit={() => onJump(1)}>
            <SummaryRow k="お客様名" v={c.name || '—'} />
            <SummaryRow k="フリガナ" v={c.kana || '—'} />
            <SummaryRow k="電話" v={c.phone || '—'} />
            <SummaryRow k="住所" v={c.address || '—'} />
          </SummaryBlock>
          <SummaryBlock icon="car" label="車両" onEdit={() => onJump(2)}>
            <SummaryRow k="ナンバー" v={v.plate || '—'} />
            <SummaryRow k="メーカー / 車名" v={`${v.maker || '—'} / ${v.model || '—'}`} />
            <SummaryRow k="ボディサイズ" v={store.confirmedSize || '—'} />
            <SummaryRow k="車体色" v={v.color || '—'} />
          </SummaryBlock>
        </div>
      </Card>

      {/* 明細 */}
      <Card title="見積明細" actions={<Button variant="ghost" size="sm" icon="pencil" onClick={() => onJump(4)}>明細を修正</Button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(store.__lineItems || []).length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 13 }}>明細がありません</div>
          )}
          {(store.__lineItems || []).map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 12, padding: '10px 14px', background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{r.label}</span>
              <span className="ds-numeric" style={{ textAlign: 'right', color: 'var(--ds-text-muted)' }}>×{r.qty}</span>
              <span className="ds-numeric" style={{ textAlign: 'right', fontWeight: 600 }}>{formatYen(r.qty * r.unit)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: 16, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line-strong)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SummaryLine label="小計" value={formatYen(subtotal)} />
          {couponTotal > 0 && <SummaryLine label={`クーポン (${(store.coupons || []).length}件)`} value={`− ${formatYen(couponTotal)}`} accent="amber" />}
          {discountAmt > 0 && <SummaryLine label={`値引き (${store.discMode === 'percent' ? `${store.discPercent}%` : '金額'})`} value={`− ${formatYen(discountAmt)}`} accent="amber" />}
          <SummaryLine label="消費税 (10%)" value={formatYen(tax)} />
          <div style={{ height: 1, background: 'var(--ds-line-strong)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="ds-title" style={{ fontSize: 18 }}>合計 (税込)</span>
            <span className="ds-price-total" style={{ fontSize: 32 }}>{formatYen(total)}</span>
          </div>
        </div>
      </Card>

      {/* 備考 */}
      {(store.notesCustomer || store.notesInternal) && (
        <Card title="備考・メモ" actions={<Button variant="ghost" size="sm" icon="pencil" onClick={() => onJump(6)}>備考を修正</Button>}>
          {store.notesCustomer && (
            <div style={{ marginBottom: 12 }}>
              <div className="ds-label" style={{ marginBottom: 6 }}>備考 (顧客向け)</div>
              <div style={{ padding: 12, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{store.notesCustomer}</div>
            </div>
          )}
          {store.notesInternal && (
            <div>
              <div className="ds-label" style={{ marginBottom: 6 }}>メモ (社内用)</div>
              <div style={{ padding: 12, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--ds-text-muted)' }}>{store.notesInternal}</div>
            </div>
          )}
        </Card>
      )}

      {/* 確定アクション */}
      <Card title="確定アクション" subtitle="キャンセル以外は自動保存されます">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Button variant="primary" size="lg" icon="save" onClick={() => { onSave && onSave(); setToast({ variant: 'success', message: '見積を保存しました' }); }}>保存</Button>
          <Button variant="secondary" size="lg" icon="file-text" onClick={() => setToast({ variant: 'info', message: 'PDF を生成中...' })}>PDF 出力</Button>
          <Button variant="secondary" size="lg" icon="pencil" onClick={() => onJump(1)}>修正</Button>
          <Button variant="danger" size="lg" icon="x">キャンセル</Button>
        </div>

        <Divider label="通信 (Screen7 に集約)" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Button variant="line" size="lg" icon={lineIcon} onClick={() => setToast({ variant: 'success', message: lineBusiness ? 'LINE 送信しました' : '見積文章をクリップボードにコピーしました' })}>
            {lineLabel}
          </Button>
          {/* 未実装: 拡張プレースホルダ (Ver2.0 §5-Screen7 - API 登録時に自動追加) */}
          <FutureCommButton icon="message-square" label="WhatsApp" />
          {/* Lucide には instagram/twitter が無いので、意味の近いアイコンで代替。
              本番のブランド SVG に差し替える予定。 */}
          <FutureCommButton icon="camera" label="Instagram" />
          <FutureCommButton icon="hash" label="X (Twitter)" />
        </div>

        <Divider label="モジュール遷移 (自動保存後)" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Button variant="secondary" size="lg" icon="calendar" onClick={() => setToast({ variant: 'info', message: '予約カレンダーへ遷移します...' })}>予約カレンダー</Button>
          <Button variant="secondary" size="lg" icon="receipt" onClick={() => setToast({ variant: 'info', message: '請求書モジュールへ遷移します...' })}>請求書</Button>
          <Button variant="secondary" size="lg" icon="truck" onClick={() => setToast({ variant: 'info', message: '納品書モジュールへ遷移します...' })}>納品書</Button>
          <Button variant="secondary" size="lg" icon="package-check" onClick={() => setToast({ variant: 'info', message: '納品請求書モジュールへ遷移します...' })}>納品請求書</Button>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: 'var(--ds-text-muted)' }}>
          <Icon name="info" size={14} style={{ color: 'var(--ds-primary-400)', marginTop: 2 }} />
          <div>
            保証書（コーティング / PPF）は<strong style={{ color: 'var(--ds-text-body)' }}>施工完了後にのみ表示</strong>されます。見積段階では非表示です。<br />
            WhatsApp / Instagram / X は各 API が店舗設定で登録されると<strong style={{ color: 'var(--ds-text-body)' }}>この画面に自動追加</strong>されます。
          </div>
        </div>
      </Card>

      <Toast open={!!toast} onClose={() => setToast(null)} message={toast?.message} variant={toast?.variant} />
    </div>
  );
}

function SummaryBlock({ icon, label, children, onEdit }) {
  return (
    <div style={{ padding: 16, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ds-primary-tint-10)', display: 'grid', placeItems: 'center', color: 'var(--ds-primary-300)' }}>
          <Icon name={icon} size={16} />
        </div>
        <span className="ds-overline" style={{ padding: 0 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}
function SummaryRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--ds-text-muted)' }}>{k}</span>
      <span style={{ color: 'var(--ds-text-primary)', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  );
}
function SummaryLine({ label, value, accent }) {
  const c = accent === 'amber' ? 'var(--ds-amber-400)' : 'var(--ds-text-muted)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: c }}>
      <span>{label}</span><span className="ds-numeric" style={{ color: accent === 'amber' ? 'var(--ds-amber-400)' : 'var(--ds-text-body)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
function FutureCommButton({ icon, label }) {
  return (
    <button disabled style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 52, padding: '14px 22px',
      background: 'transparent',
      border: '1px dashed var(--ds-line-strong)',
      borderRadius: 12,
      color: 'var(--ds-text-faint)',
      fontSize: 13, fontWeight: 500,
      cursor: 'not-allowed', fontFamily: 'var(--ds-font-sans)',
      position: 'relative',
    }}>
      <Icon name={icon} size={16} />
      {label}
      <span style={{ position: 'absolute', top: -8, right: 8, fontSize: 9, letterSpacing: 0.5, padding: '2px 6px', background: 'var(--ds-bg-panel)', border: '1px solid var(--ds-line)', color: 'var(--ds-text-subtle)', borderRadius: 999 }}>未実装</span>
    </button>
  );
}

window.Screen7_Review = Screen7_Review;
