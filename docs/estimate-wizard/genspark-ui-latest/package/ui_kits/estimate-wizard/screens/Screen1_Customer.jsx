/* =============================================================================
   Screen 1 — 顧客登録 (Customer Registration)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen1 に厳密準拠。
   必須: 登録方式 + お客様名。他は任意。
   入力順は依頼書 §5 通り (改変不可)。
   ============================================================================= */

function Screen1_Customer({ store, updateStore, onAdvance }) {
  const [regMethod, setRegMethod] = React.useState(store.customer?.regMethod || null); // 'ocr' | 'manual' | 'search'
  const [ocrOpen, setOcrOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [c, setC] = React.useState(store.customer || {});
  const [contractor, setContractor] = React.useState(store.contractor || false);
  const [contractorRate, setContractorRate] = React.useState(store.contractorRate || 10);
  const [creditSale, setCreditSale] = React.useState(store.creditSale || false);
  const [creditClosing, setCreditClosing] = React.useState(store.creditClosing || '');
  const [creditTerms, setCreditTerms] = React.useState(store.creditTerms || '');
  const [toast, setToast] = React.useState(null);

  // Store 設定に応じて LINE QR ボタンを出す (Ver2.0 §5-Screen1 binding)
  const storeHasLineBusiness = window.COMM_STATE?.lineBusinessConfigured === true; // false by default

  function update(patch) {
    const next = { ...c, ...patch };
    // Ver2.0 §5-Screen1 - 名前から自動フリガナ生成 (mock)
    if (patch.name && !next.kana) {
      next.kana = mockKanaFromName(patch.name);
    }
    // Ver2.0 §5-Screen1 - 郵便番号→住所 双方向 (mock)
    if (patch.postal && /^\d{3}-?\d{4}$/.test(patch.postal) && !next.address) {
      next.address = '滋賀県大津市 (自動入力)';
    }
    setC(next);
    updateStore({ customer: next, contractor, contractorRate, creditSale, creditClosing, creditTerms });
  }

  function handlePickExisting(customer) {
    const next = {
      name: customer.name,
      kana: customer.kana,
      phone: customer.phone,
      address: customer.address,
      postal: '520-0001',
      regMethod: 'search',
      existingId: customer.id,
    };
    setC(next);
    setRegMethod('search');
    updateStore({ customer: next });
    setToast({ variant: 'success', message: `${customer.name} を選択 · 車両登録へ進みます` });
    // Ver2.0 §22 auto-advance (既存 committing 操作に前進を同居)
    setTimeout(() => onAdvance && onAdvance(), 1200);
  }

  /* v2.2 大改造 (依頼書 §5-Screen1 補記):
     車検証 OCR は 1 回で「顧客情報 + 車両情報」の両方を埋める。
     Screen 1 内で車両情報のプレビューカードを表示し、オペレーターが確認してから
     ボタンで Screen 2 へ進む (auto-advance は廃止)。 */
  function handleOcrApply() {
    /* 顧客情報 (使用者氏名・住所・電話番号) */
    const nextCustomer = {
      name: '山田 太郎',
      kana: 'ヤマダ タロウ',
      phone: '090-1234-5678',
      postal: '520-0001',
      address: '滋賀県大津市浜大津1-1-1',
      regMethod: 'ocr',
    };
    /* 車両情報 (ナンバー・型式・車体番号・寸法・初年度・車検満了・色) */
    const nextVehicle = {
      plate: '滋賀 330 に 1234',
      maker: 'トヨタ',
      model: '',                     /* 車名は車検証で取得不可、手入力必須 */
      type: 'AZSH20-AEXNB',
      vin: 'AZSH20-1050123',
      firstReg: '令和3年5月',
      regDate: '令和6年1月15日',
      color: 'プレシャスシルバー',
      inspectionDue: '令和8年5月',
      length: 4910,
      width: 1800,
      height: 1465,
      vehicleInputMode: 'ocr',
    };
    setC(nextCustomer);
    setRegMethod('ocr');
    /* customer + vehicle を同時 update — Screen 2 で再入力せず済む */
    updateStore({ customer: nextCustomer, vehicle: nextVehicle, vehicleInputMode: 'ocr' });
    setToast({ variant: 'success', message: '顧客情報と車両情報を自動入力しました。内容を確認してください。' });
    /* auto-advance は廃止。オペレーターが車両プレビューを確認し、明示ボタンで Screen 2 へ */
  }

  const nameRequired = regMethod !== 'search';
  const missingName = !c.name || c.name.trim() === '';

  return (
    <div>
      <ScreenTitle step={1} title="顧客登録" subtitle="お客様の情報を登録します。必須は登録方式とお客様名のみです。" />

      {/* ── 1. 登録方式（押しボタン3種 · 択一） ────────────────────── */}
      <Card title="1. 登録方式" subtitle="お客様の登録方法を選択してください（必須）">
        <ChoiceGrid columns={3} gap={12}>
          <SelectButton
            selected={regMethod === 'ocr'}
            icon="scan-line"
            size="lg"
            onClick={() => { setRegMethod('ocr'); setOcrOpen(true); }}
            subLabel="AI-OCR で車検証を読み取り"
          >車検証OCR</SelectButton>
          <SelectButton
            selected={regMethod === 'manual'}
            icon="pencil"
            size="lg"
            onClick={() => setRegMethod('manual')}
            subLabel="全項目を手入力"
          >手入力</SelectButton>
          <SelectButton
            selected={regMethod === 'search'}
            icon="search"
            size="lg"
            onClick={() => { setRegMethod('search'); setSearchOpen(true); }}
            subLabel="登録済み顧客から選ぶ"
          >既存顧客を検索</SelectButton>
        </ChoiceGrid>
        {missingName && !regMethod && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--ds-amber-tint-10)', border: '1px solid var(--ds-amber-tint-40)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ds-amber-400)' }}>
            <Icon name="alert-circle" size={14} />
            登録方式を選択してください（必須）
          </div>
        )}
      </Card>

      {/* ── 2-6. 顧客情報 (regMethod が決まったら表示) ────────────── */}
      {regMethod && (
        <Card title="2. 顧客情報" subtitle="車検証OCR / 手入力 / 検索結果からの自動入力可。全項目を自由に修正できます。">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <Field label="お客様名 / 会社名" required value={c.name}>
              <Input
                value={c.name}
                onChange={v => update({ name: v })}
                placeholder="山田太郎 / 株式会社〇〇"
                required
              />
            </Field>
            <Field label="フリガナ (自動生成)" value={c.kana}>
              <Input
                value={c.kana}
                onChange={v => update({ kana: v })}
                placeholder="ヤマダタロウ"
              />
            </Field>
            <Field label="郵便番号" hint="入力すると住所を自動補完します" value={c.postal}>
              <Input
                value={c.postal}
                onChange={v => update({ postal: v })}
                placeholder="000-0000"
              />
            </Field>
            <Field label="住所" value={c.address}>
              <Input
                value={c.address}
                onChange={v => update({ address: v })}
                placeholder="都道府県・市区町村・番地"
              />
            </Field>
            <Field label="電話番号" value={c.phone}>
              <Input
                type="tel"
                value={c.phone}
                onChange={v => update({ phone: v })}
                placeholder="090-0000-0000"
              />
            </Field>
            <Field label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                LINE ID
                {storeHasLineBusiness && <span style={{ fontSize: 9, background: 'var(--ds-line-brand)', color: '#fff', padding: '1px 6px', borderRadius: 999, letterSpacing: 0.3 }}>QR対応</span>}
              </span>
            } value={c.lineId}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={c.lineId}
                  onChange={v => update({ lineId: v })}
                  placeholder="line_user_id_here"
                />
                {storeHasLineBusiness && (
                  <Button variant="outline" icon="qr-code" onClick={() => setQrOpen(true)}>QR</Button>
                )}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {/* ── 業者 / 掛売り (独立2ボタン) ─────────────────────────── */}
      {regMethod && (
        <Card title="3. 業者 / 掛売り" subtitle="どちらか一方でも両方でも可。独立して設定できます。">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: contractor || creditSale ? 16 : 0 }}>
            <ToggleButton active={contractor} onClick={() => setContractor(v => !v)} icon="briefcase">業者</ToggleButton>
            <ToggleButton active={creditSale} onClick={() => setCreditSale(v => !v)} icon="credit-card">掛売り</ToggleButton>
          </div>
          {(contractor || creditSale) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, padding: 14, background: 'var(--ds-bg-elevated)', borderRadius: 12, border: '1px solid var(--ds-line)' }}>
              {contractor && (
                <Field label="値引率" hint="業者向けの標準値引率 (%)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input type="number" value={contractorRate} onChange={v => setContractorRate(Number(v))} placeholder="10" />
                    <span style={{ color: 'var(--ds-text-muted)', fontSize: 14 }}>%</span>
                  </div>
                </Field>
              )}
              {creditSale && (
                <>
                  <Field label="締め日" hint="掛売りの月次締め日">
                    <Input value={creditClosing} onChange={setCreditClosing} placeholder="例: 月末締め / 20日締め" />
                  </Field>
                  <Field label="支払条件">
                    <Input value={creditTerms} onChange={setCreditTerms} placeholder="例: 翌月末払い / 30日" />
                  </Field>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── 4. 車両情報プレビュー (OCR 適用後のみ表示) ────────────
          binding (v2.2 §5-Screen1): 車検証 OCR で車両側も自動入力されるため、
          Screen 1 内で内容を確認できるようにする。 */}
      {regMethod === 'ocr' && store.vehicle?.plate && (
        <Card
          title="4. 車両情報プレビュー"
          subtitle="車検証 OCR から自動入力しました。Screen 2 で詳細編集できます。"
          actions={
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'var(--ds-green-tint-10)',
              border: '1px solid rgba(34,197,94,0.35)',
              fontSize: 11, fontWeight: 600, color: 'var(--ds-green-400)',
              letterSpacing: 0.4,
            }}>
              <Icon name="check-circle-2" size={12} /> OCR 適用済
            </span>
          }
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}>
            {[
              ['ナンバー', store.vehicle.plate],
              ['メーカー', store.vehicle.maker],
              ['車名', store.vehicle.model, true /* required, may be empty */],
              ['型式', store.vehicle.type],
              ['車体番号', store.vehicle.vin],
              ['初年度登録', store.vehicle.firstReg],
              ['車検満了', store.vehicle.inspectionDue],
              ['ボディカラー', store.vehicle.color],
              ['寸法 (mm)', store.vehicle.length ? `${store.vehicle.length} × ${store.vehicle.width} × ${store.vehicle.height}` : null],
            ].map(([k, v, mayBeEmpty]) => (
              <div key={k}>
                <div className="ds-label" style={{ marginBottom: 4 }}>{k}</div>
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--ds-bg-elevated)',
                  border: `1px solid ${!v && mayBeEmpty ? 'var(--ds-amber-tint-40)' : 'var(--ds-line)'}`,
                  borderRadius: 10, fontSize: 13,
                  color: v ? 'var(--ds-text-primary)' : 'var(--ds-amber-400)',
                  minHeight: 36, display: 'flex', alignItems: 'center',
                }}>
                  {v || (mayBeEmpty ? '要入力 (車検証取得不可)' : '—')}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 14, padding: 12,
            background: 'var(--ds-primary-tint-10)',
            border: '1px solid var(--ds-primary-tint-60)',
            borderRadius: 10,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            fontSize: 12, color: 'var(--ds-text-muted)',
          }}>
            <Icon name="info" size={14} style={{ color: 'var(--ds-primary-400)', marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--ds-text-body)' }}>車名 (モデル名)</strong> は車検証に記載されないため、
              オペレーターが Screen 2 で手入力してください。ボディサイズも Screen 2 で確定します。
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" icon="rotate-ccw" onClick={() => setOcrOpen(true)}>OCR やり直し</Button>
            <Button variant="primary" iconRight="arrow-right" onClick={() => onAdvance && onAdvance()}>
              車両情報を編集 → Screen 2 へ
            </Button>
          </div>
        </Card>
      )}

      {/* Toast */}
      <Toast open={!!toast} onClose={() => setToast(null)} message={toast?.message} variant={toast?.variant} />

      {/* Overlays */}
      <CustomerSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onPick={handlePickExisting} />
      <OCROverlay open={ocrOpen} onClose={() => setOcrOpen(false)} onApply={handleOcrApply} target="車検証" />
      <QROverlay open={qrOpen} onClose={() => setQrOpen(false)} onApply={id => update({ lineId: id })} />
    </div>
  );
}

/* Mock 用のフリガナ生成 (本番は Kuromoji 等で実装) */
function mockKanaFromName(name) {
  const map = { '山田': 'ヤマダ', '太郎': 'タロウ', '花子': 'ハナコ', '田中': 'タナカ', '佐藤': 'サトウ', '鈴木': 'スズキ', '株式会社': '' };
  let r = name;
  Object.entries(map).forEach(([k, v]) => { r = r.split(k).join(v); });
  return r === name ? '' : r.trim();
}

window.Screen1_Customer = Screen1_Customer;
