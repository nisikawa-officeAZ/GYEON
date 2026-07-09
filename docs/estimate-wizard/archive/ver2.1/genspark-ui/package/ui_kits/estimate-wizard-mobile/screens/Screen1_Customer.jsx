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

  function handleOcrApply() {
    const next = {
      name: '山田 太郎',
      kana: 'ヤマダ タロウ',
      phone: '090-1234-5678',
      postal: '520-0001',
      address: '滋賀県大津市浜大津1-1-1',
      regMethod: 'ocr',
    };
    setC(next);
    setRegMethod('ocr');
    updateStore({ customer: next });
    setToast({ variant: 'success', message: 'OCR 適用完了 · 車両登録へ進みます' });
    setTimeout(() => onAdvance && onAdvance(), 1200);
  }

  const nameRequired = regMethod !== 'search';
  const missingName = !c.name || c.name.trim() === '';

  return (
    <div>
      <ScreenTitle step={1} title="顧客登録" subtitle="お客様の情報を登録します。必須は登録方式とお客様名のみです。" />

      {/* ── 1. 登録方式 (Mobile: 車検証OCR がプライマリ、iOS/Android の
              ネイティブカメラを起動して撮影 → OCR 結果を BottomSheet でレビュー) ─── */}
      <Card title="1. 登録方式" subtitle="お客様の登録方法を選択してください（必須）">
        {/* 車検証OCR: ネイティブカメラボタン (フル幅、目立たせる) */}
        <div style={{ marginBottom: 10 }}>
          <NativeCameraButton
            variant={regMethod === 'ocr' ? 'primary' : 'secondary'}
            size="lg"
            icon="scan-line"
            full
            onCapture={file => {
              /* 実運用: file を AI-OCR API に送信。Mock ではファイル受領後にレビュー sheet を開く。 */
              setRegMethod('ocr');
              setOcrOpen(true);
            }}
          >
            📷 車検証をカメラで撮影 (AI-OCR)
          </NativeCameraButton>
        </div>
        {/* 手入力 + 既存顧客検索 (2 列) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SelectButton
            selected={regMethod === 'manual'}
            icon="pencil"
            size="lg"
            onClick={() => setRegMethod('manual')}
            subLabel="全項目を入力"
          >手入力</SelectButton>
          <SelectButton
            selected={regMethod === 'search'}
            icon="search"
            size="lg"
            onClick={() => { setRegMethod('search'); setSearchOpen(true); }}
            subLabel="登録済みから選ぶ"
          >既存顧客を検索</SelectButton>
        </div>
        {missingName && !regMethod && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--ds-amber-tint-10)', border: '1px solid var(--ds-amber-tint-40)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ds-amber-400)' }}>
            <Icon name="alert-circle" size={14} />
            登録方式を選択してください（必須）
          </div>
        )}
      </Card>

      {/* ── 2-6. 顧客情報 (Mobile 依頼書§8 準拠: 短いフィールドは 2 列、長い名前・住所は 1 列) ─── */}
      {regMethod && (
        <Card title="2. 顧客情報" subtitle="全項目は自由に修正できます">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* お客様名 (単独 1 列 — 一番重要な必須項目、幅を有効活用) */}
            <Field label="お客様名 / 会社名" required value={c.name}>
              <Input
                value={c.name}
                onChange={v => update({ name: v })}
                placeholder="山田太郎 / 株式会社〇〇"
                required
              />
            </Field>

            {/* フリガナ (単独 1 列 — 自動生成なので目立たせる) */}
            <Field label="フリガナ (自動生成)" value={c.kana}>
              <Input
                value={c.kana}
                onChange={v => update({ kana: v })}
                placeholder="ヤマダタロウ"
              />
            </Field>

            {/* 郵便番号 + 電話番号 (2 列 — どちらも短い数字系) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="郵便番号" hint="住所を自動補完" value={c.postal}>
                <Input
                  value={c.postal}
                  onChange={v => update({ postal: v })}
                  placeholder="000-0000"
                  inputMode="numeric"
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
            </div>

            {/* 住所 (単独 1 列 — 文字数が多いため) */}
            <Field label="住所" value={c.address}>
              <Input
                value={c.address}
                onChange={v => update({ address: v })}
                placeholder="都道府県・市区町村・番地"
              />
            </Field>

            {/* LINE ID (単独 1 列、QR ボタン付き) */}
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
                  <NativeCameraButton
                    variant="outline"
                    icon="qr-code"
                    size="md"
                    onCapture={() => setQrOpen(true)}
                    style={{ flexShrink: 0 }}
                  >QR</NativeCameraButton>
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

      {/* Toast */}
      <Toast open={!!toast} onClose={() => setToast(null)} message={toast?.message} variant={toast?.variant} />

      {/* Overlays */}
      <CustomerSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onPick={handlePickExisting} />
      <OCRReviewSheet open={ocrOpen} onClose={() => setOcrOpen(false)} onApply={handleOcrApply} target="車検証" />
      <QRScanSheet open={qrOpen} onClose={() => setQrOpen(false)} onApply={id => update({ lineId: id })} />
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
