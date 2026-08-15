/* =============================================================================
   Screen 2 — 車両登録 (Vehicle Registration)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen2 準拠。
   必須: ナンバープレート・メーカー・車名 (車名は車検証から取得不可のため常に手入力必須)。
   ボディサイズ: 3M推定→7ボタンハイライト→APU 最終決定。自動確定しない。
   ============================================================================= */

function Screen2_Vehicle({ store, updateStore }) {
  const [inputMode, setInputMode] = React.useState(store.vehicleInputMode || null); // 'ocr' | 'manual'
  const [ocrOpen, setOcrOpen] = React.useState(false);
  const [v, setV] = React.useState(store.vehicle || {});
  // ボディサイズ: OCR や 3M計算で推奨されるが、常にオペレーターが最終決定
  const [suggestedSize, setSuggestedSize] = React.useState(store.suggestedSize || null);
  const [confirmedSize, setConfirmedSize] = React.useState(store.confirmedSize || null);

  function update(patch) {
    const next = { ...v, ...patch };
    setV(next);
    updateStore({ vehicle: next });
  }

  function handleOcrApply() {
    const next = {
      plate: '滋賀 330 に 1234',
      maker: 'トヨタ',
      model: 'クラウン',
      type: 'AZSH20-AEXNB',
      vin: 'AZSH20-1050123',
      firstReg: '令和3年5月',
      regDate: '令和6年1月15日',
      color: 'プレシャスシルバー',
      inspectionDue: '令和8年5月',
      length: 4910,
      width: 1800,
      height: 1465,
    };
    setV(next);
    setInputMode('ocr');
    // 3M計算 → M サイズを推奨としてハイライト (自動確定はしない: Ver2.0 §5-Screen2 binding)
    setSuggestedSize('M');
    updateStore({ vehicle: next, suggestedSize: 'M' });
  }

  const missingRequired = !v.plate || !v.maker || !v.model;

  return (
    <div>
      <ScreenTitle step={2} title="車両登録" subtitle="車両情報を登録し、ボディサイズを確定します。" />

      {/* ── 入力方式 ─────────────────────────────────────────── */}
      <Card title="1. 入力方式" subtitle="車検証 OCR で自動入力するか、手入力するかを選択します">
        <ChoiceGrid columns={2} gap={12}>
          <SelectButton
            selected={inputMode === 'ocr'}
            icon="scan-line"
            size="lg"
            onClick={() => { setInputMode('ocr'); setOcrOpen(true); }}
            subLabel="AI-OCR で自動読み取り"
          >車検証OCR</SelectButton>
          <SelectButton
            selected={inputMode === 'manual'}
            icon="pencil"
            size="lg"
            onClick={() => setInputMode('manual')}
            subLabel="全項目を手入力"
          >手入力</SelectButton>
        </ChoiceGrid>
      </Card>

      {inputMode && (
        <>
          {/* ── 車両情報 ───────────────────────────────────── */}
          <Card title="2. 車両情報" subtitle="車名は車検証から取得できないため、常に手入力が必要です">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              <Field label="ナンバープレート" required value={v.plate}>
                <Input value={v.plate} onChange={x => update({ plate: x })} placeholder="滋賀 330 に 1234" required />
              </Field>
              <Field label="メーカー" required hint="車検証では「社名」と表記" value={v.maker}>
                <Input value={v.maker} onChange={x => update({ maker: x })} placeholder="トヨタ / ポルシェ / ニッサン" required />
              </Field>
              <Field label="車名" required hint="車検証から取得不可 — 常に手入力必須" value={v.model}>
                <Input value={v.model} onChange={x => update({ model: x })} placeholder="クラウン / 5シリーズ / GT-R" required />
              </Field>
              <Field label="型式" value={v.type}>
                <Input value={v.type} onChange={x => update({ type: x })} placeholder="AZSH20-AEXNB" />
              </Field>
              <Field label="車体番号" value={v.vin}>
                <Input value={v.vin} onChange={x => update({ vin: x })} placeholder="AZSH20-1050123" />
              </Field>
              <Field label="初年度登録年月" value={v.firstReg}>
                <Input value={v.firstReg} onChange={x => update({ firstReg: x })} placeholder="令和3年5月" />
              </Field>
              <Field label="登録年月日" value={v.regDate}>
                <Input value={v.regDate} onChange={x => update({ regDate: x })} placeholder="令和6年1月15日" />
              </Field>
              <Field label="ボディカラー" value={v.color}>
                <Input value={v.color} onChange={x => update({ color: x })} placeholder="プレシャスシルバー" />
              </Field>
              <Field label="車検満了年月日" value={v.inspectionDue}>
                <Input value={v.inspectionDue} onChange={x => update({ inspectionDue: x })} placeholder="令和8年5月" />
              </Field>
              <Field label="車両寸法 (長さ × 幅 × 高さ mm)" hint="OCRで自動取得。3M計算に使用します">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Input type="number" value={v.length} onChange={x => update({ length: Number(x) })} placeholder="4910" />
                  <Input type="number" value={v.width} onChange={x => update({ width: Number(x) })} placeholder="1800" />
                  <Input type="number" value={v.height} onChange={x => update({ height: Number(x) })} placeholder="1465" />
                </div>
              </Field>
            </div>
          </Card>

          {/* ── ボディサイズ (Ver2.0 §5-Screen2 - 7 ボタン + 3M推定) ── */}
          <Card
            title="3. ボディサイズ確定"
            subtitle="OCR / 手入力の寸法から自動計算した推奨サイズをハイライトします。最終決定はオペレーターが行います。"
          >
            {suggestedSize && (
              <div style={{ padding: 12, background: 'var(--ds-primary-tint-10)', border: '1px solid var(--ds-primary-tint-60)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ds-primary-300)' }}>
                <Icon name="sparkles" size={16} />
                <span>3M計算による推奨: <strong style={{ color: '#fff' }}>{suggestedSize} サイズ</strong> — オペレーターが最終確認してください</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
              {window.BODY_SIZES.map(s => (
                <BodySizeButton key={s.id}
                  size={s}
                  selected={confirmedSize === s.id}
                  suggested={suggestedSize === s.id && confirmedSize !== s.id}
                  onClick={() => {
                    setConfirmedSize(s.id);
                    updateStore({ confirmedSize: s.id });
                  }}
                />
              ))}
            </div>
            {confirmedSize && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--ds-green-tint-10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ds-green-400)' }}>
                <Icon name="check-circle-2" size={16} />
                <span>ボディサイズを <strong style={{ color: '#fff' }}>{confirmedSize}</strong> に確定しました</span>
              </div>
            )}
          </Card>
        </>
      )}

      <OCRSlidePanel open={ocrOpen} onClose={() => setOcrOpen(false)} onApply={handleOcrApply} target="車検証" />
    </div>
  );
}

/* ── BodySizeButton (独自スタイル) ───────────────────────────────── */
function BodySizeButton({ size, selected, suggested, onClick }) {
  const bg = selected
    ? 'var(--ds-primary-tint-40)'
    : suggested
    ? 'var(--ds-primary-tint-10)'
    : 'var(--ds-bg-elevated)';
  const bd = selected
    ? 'var(--ds-primary-tint-60)'
    : suggested
    ? 'var(--ds-primary-tint-60)'
    : 'var(--ds-line-slate)';
  return (
    <button onClick={onClick} aria-pressed={selected}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '16px 6px', minHeight: 72,
        background: bg, border: `1px solid ${bd}`,
        borderRadius: 12, cursor: 'pointer',
        color: selected ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
        fontFamily: 'var(--ds-font-sans)',
        transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
        position: 'relative',
        boxShadow: suggested && !selected ? '0 0 0 2px var(--ds-primary-tint-10)' : 'none',
      }}>
      {selected && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--ds-primary-500)',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name="check" size={10} style={{ color: '#fff' }} />
        </span>
      )}
      {suggested && !selected && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          fontSize: 8, letterSpacing: 0.5, fontWeight: 700,
          color: 'var(--ds-primary-300)', padding: '1px 5px',
          background: 'var(--ds-primary-tint-10)', borderRadius: 999,
          border: '1px solid var(--ds-primary-tint-60)',
        }}>推奨</span>
      )}
      <div style={{ fontSize: 22, fontWeight: 700, color: selected ? '#fff' : (suggested ? 'var(--ds-primary-300)' : 'var(--ds-text-primary)'), lineHeight: 1 }}>{size.label}</div>
      <div style={{ fontSize: 9, color: 'var(--ds-text-subtle)', textAlign: 'center', lineHeight: 1.3 }}>{size.desc}</div>
    </button>
  );
}

window.Screen2_Vehicle = Screen2_Vehicle;
