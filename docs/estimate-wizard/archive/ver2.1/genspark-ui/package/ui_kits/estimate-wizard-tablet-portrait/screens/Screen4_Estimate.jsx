/* =============================================================================
   Screen 4 — 見積 (Estimate Editor)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen4 準拠。ここが最も複雑。
   - プルダウン一切禁止。全選択は押しボタン。
   - コーティング: レイヤー構造 (単/2/3層) を先に決めてから選択 (未選択層はグレーアウト)
   - PPF: Screen4 内で「フル施工/部分施工」分岐
   - 店舗オプション: 動的 (店舗が名称・追加・削除・価格を自由変更) を前提のレイアウト
   - PPF+コーティング: 減額補正
   - 左サイド縦タブでカテゴリ切替 (Ver2.0 §6)
   ============================================================================= */

function Screen4_Estimate({ store, updateStore, dealerRank = 'certified' }) {
  const cats = store.cats || [];
  // Screen3 で選択されたカテゴリのみ表示
  const activeCategories = window.CATEGORIES.filter(c => cats.includes(c.id));
  const [activeTab, setActiveTab] = React.useState(activeCategories[0]?.id || 'coating');

  React.useEffect(() => {
    if (activeCategories.length > 0 && !cats.includes(activeTab)) {
      setActiveTab(activeCategories[0].id);
    }
  }, [cats]);

  if (activeCategories.length === 0) {
    return (
      <div>
        <ScreenTitle step={4} title="見積" />
        <Card>
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Icon name="inbox" size={48} style={{ color: 'var(--ds-text-faint)' }} />
            <h3 className="ds-title" style={{ marginTop: 16 }}>カテゴリが選択されていません</h3>
            <p className="ds-body" style={{ color: 'var(--ds-text-muted)', marginTop: 8 }}>
              STEP 3 「作業内容選択」で施工カテゴリを選んでください。
            </p>
          </div>
        </Card>
      </div>
    );
  }


  return (
    <div>
      <ScreenTitle step={4} title="見積" subtitle={`${activeCategories.length} 件のカテゴリを編集中。上のタブで切替できます。`} />

      {/* Tablet portrait/adaptive: 上部セグメンテッドコントロールでカテゴリ切替
          (Ver2.0 §7 のオプション「上部横タブ」を採用)。
          6+ カテゴリで幅が足りない場合は横スクロールで対応。 */}
      <div style={{
        background: 'var(--ds-bg-card)',
        border: '1px solid var(--ds-line)',
        borderRadius: 'var(--ds-radius-xl)',
        padding: 8,
        marginBottom: 20,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        position: 'sticky', top: 'var(--ds-sticky-top)',
        zIndex: 10,
      }}>
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          size="lg"
          full={false}
          options={activeCategories.map(c => ({
            value: c.id,
            label: c.label,
            icon: c.icon,
            badge: store.categoryDone?.[c.id] ? '✓' : null,
          }))}
        />
      </div>

      <div>
        {activeTab === 'coating' && <CoatingSection store={store} updateStore={updateStore} dealerRank={dealerRank} />}
        {activeTab === 'ppf' && <PPFSection store={store} updateStore={updateStore} />}
        {activeTab === 'window' && <WindowFilmSection store={store} updateStore={updateStore} />}
        {activeTab === 'maintenance' && <SimpleMenuSection title="ボディ定期メンテナンス" menuKey="maintenance" items={window.MAINTENANCE_MENUS} store={store} updateStore={updateStore} />}
        {activeTab === 'carwash' && <SimpleMenuSection title="洗車" menuKey="carwash" items={window.CARWASH_MENUS} store={store} updateStore={updateStore} />}
        {activeTab === 'roomclean' && <SimpleMenuSection title="ルームクリーニング" menuKey="roomclean" items={window.ROOMCLEAN_MENUS} store={store} updateStore={updateStore} />}
        {activeTab === 'other' && <OtherSection store={store} updateStore={updateStore} />}

        {/* 店舗オプション (全カテゴリ共通・動的) */}
        <StoreOptionsSection store={store} updateStore={updateStore} />

        {/* 明細プレビュー */}
        <LineItemsPreview store={store} updateStore={updateStore} />
      </div>
    </div>
  );
}

/* ── コーティング レイヤー選択 ─────────────────────────────────── */
function CoatingSection({ store, updateStore, dealerRank }) {
  const c = store.coating || {};
  const [layer, setLayer] = React.useState(c.layer || 'single'); // 'single' | '2layer' | '3layer'
  const [base, setBase] = React.useState(c.base || null);
  const [layer2Sel, setLayer2Sel] = React.useState(c.layer2 || null);
  const [layer3Sel, setLayer3Sel] = React.useState(c.layer3 || null);

  /* 1 層目候補: グループ構造 [{tier,label,items}] を正とする。
     後方互換で古いフラット配列も許容する（保守時の破壊防止）。 */
  const rawBase = window.COATING_MATRIX.base[dealerRank] || [];
  const baseGroups = Array.isArray(rawBase) && rawBase.length > 0 && typeof rawBase[0] === 'string'
    ? [{ tier: 'default', label: '', items: rawBase }]   // 旧構造フォールバック
    : rawBase;
  const layer2Opts = base ? (window.COATING_MATRIX.layer2[dealerRank]?.[base] || []) : [];
  const layer3Opts = base ? (window.COATING_MATRIX.layer3[dealerRank]?.[base] || []) : [];
  const has2 = layer2Opts.length > 0;
  const has3 = layer3Opts.length > 0;

  function persist(next) {
    updateStore({ coating: { layer, base, layer2: layer2Sel, layer3: layer3Sel, ...next } });
  }

  return (
    <Card
      title="コーティング"
      subtitle={`ショップランク: ${window.COATING_MATRIX.ranks.find(r => r.id === dealerRank)?.label}`}
      actions={<span style={{ fontSize: 11, color: 'var(--ds-text-subtle)', letterSpacing: 0.5 }}>店舗設定由来</span>}
    >
      {/* Layer selector - 先にレイヤー構造を決める (Ver2.0 §5-Screen4) */}
      <div style={{ marginBottom: 20 }}>
        <div className="ds-label" style={{ marginBottom: 8 }}>レイヤー構造</div>
        <ChoiceGrid columns={3} gap={10}>
          <SelectButton selected={layer === 'single'}    onClick={() => { setLayer('single');  persist({ layer: 'single' }); }}>単層</SelectButton>
          <SelectButton selected={layer === '2layer'}    onClick={() => { setLayer('2layer');  persist({ layer: '2layer' }); }} disabled={!has2 && !!base}>2 層</SelectButton>
          <SelectButton selected={layer === '3layer'}    onClick={() => { setLayer('3layer');  persist({ layer: '3layer' }); }} disabled={!has3 && !!base}>3 層</SelectButton>
        </ChoiceGrid>
      </div>

      {/* 1 層目 — グループ毎に区切って表示。
          スタンダード系 3 列 / 高性能系 3 列 / INFINITE 系 2 列 の 3 段構造。
          列数は各グループの items.length に自動追従（データ駆動）。 */}
      <div style={{ marginBottom: 20 }}>
        <div className="ds-label" style={{ marginBottom: 8 }}>1 層目 (ベースコーティング剤)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {baseGroups.map((grp, gi) => (
            <div key={grp.tier || gi}>
              {grp.label && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                  color: 'var(--ds-text-subtle)', textTransform: 'uppercase',
                  marginBottom: 6, paddingLeft: 2,
                }}>{grp.label}</div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${grp.items.length}, minmax(0, 1fr))`,
                gap: 10,
              }}>
                {grp.items.map(b => (
                  <SelectButton key={b} selected={base === b}
                    onClick={() => { setBase(b); setLayer2Sel(null); setLayer3Sel(null); persist({ base: b, layer2: null, layer3: null }); }}
                    subLabel={`基本 ${formatYen(window.COATING_MATRIX.basePrice[b])}`}
                  >Q² {b}</SelectButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 層目 */}
      {(layer === '2layer' || layer === '3layer') && (
        <div style={{ marginBottom: 20 }}>
          <div className="ds-label" style={{ marginBottom: 8 }}>2 層目</div>
          {layer2Opts.length === 0 ? (
            <div style={{ padding: 12, background: 'var(--ds-bg-elevated)', border: '1px dashed var(--ds-line)', borderRadius: 10, fontSize: 12, color: 'var(--ds-text-muted)' }}>
              1 層目を先に選択してください
            </div>
          ) : (
            <ChoiceGrid columns={2} gap={10}>
              {layer2Opts.map(o => (
                <SelectButton key={o} selected={layer2Sel === o}
                  onClick={() => { setLayer2Sel(o); persist({ layer2: o }); }}
                  subLabel={`+ ${formatYen(window.COATING_MATRIX.basePrice[o])}`}
                >Q² {o}</SelectButton>
              ))}
            </ChoiceGrid>
          )}
        </div>
      )}

      {/* 3 層目 */}
      {layer === '3layer' && (
        <div>
          <div className="ds-label" style={{ marginBottom: 8 }}>3 層目 (トップコート)</div>
          {layer3Opts.length === 0 ? (
            <div style={{ padding: 12, background: 'var(--ds-bg-elevated)', border: '1px dashed var(--ds-line)', borderRadius: 10, fontSize: 12, color: 'var(--ds-text-muted)' }}>
              1 層目を先に選択してください
            </div>
          ) : (
            <ChoiceGrid columns={2} gap={10}>
              {layer3Opts.map(o => (
                <SelectButton key={o} selected={layer3Sel === o}
                  onClick={() => { setLayer3Sel(o); persist({ layer3: o }); }}
                  subLabel={`+ ${formatYen(window.COATING_MATRIX.basePrice[o])}`}
                >Q² {o}</SelectButton>
              ))}
            </ChoiceGrid>
          )}
        </div>
      )}

      {(store.cats?.includes('ppf')) && (
        <div style={{
          marginTop: 20, padding: 12,
          background: 'var(--ds-amber-tint-10)', border: '1px solid var(--ds-amber-tint-40)',
          borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start',
          fontSize: 12, color: 'var(--ds-amber-400)',
        }}>
          <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>PPF ＋ コーティングを同時施工のため、コーティング費用に <strong>店舗設定の減額補正</strong> を自動適用します。</span>
        </div>
      )}
    </Card>
  );
}

/* ── PPF セクション (Ver2.0 §5-Screen4 §PPF binding) ────────────── */
function PPFSection({ store, updateStore }) {
  const p = store.ppf || {};
  const [scope, setScope] = React.useState(p.scope || null); // 'full' | 'partial'
  const [selectedItems, setSelectedItems] = React.useState(p.items || []); // string[] PPF ID (film types)
  /* 部分施工: パーツID -> { on: boolean, positions: string[] } の Map。
     positions が null のパーツは on=true だけで確定、positions ありは選択位置の配列で管理。 */
  const [partialParts, setPartialParts] = React.useState(p.partialParts || {});

  function persistAll(patch) {
    updateStore({ ppf: { scope, items: selectedItems, partialParts, ...patch } });
  }

  function toggleFilmType(id) {
    const next = selectedItems.includes(id) ? selectedItems.filter(x => x !== id) : [...selectedItems, id];
    setSelectedItems(next);
    persistAll({ items: next });
  }

  function togglePart(partId) {
    const cur = partialParts[partId];
    let next;
    if (cur?.on) {
      // 解除: エントリごと削除
      next = { ...partialParts };
      delete next[partId];
    } else {
      // 選択: 新規エントリ
      next = { ...partialParts, [partId]: { on: true, positions: [] } };
    }
    setPartialParts(next);
    persistAll({ partialParts: next });
  }

  function togglePosition(partId, posId) {
    const cur = partialParts[partId];
    if (!cur?.on) return;
    const has = cur.positions.includes(posId);
    const positions = has ? cur.positions.filter(p => p !== posId) : [...cur.positions, posId];
    const next = { ...partialParts, [partId]: { ...cur, positions } };
    setPartialParts(next);
    persistAll({ partialParts: next });
  }

  return (
    <Card title="PPF (ペイント プロテクション フィルム)" subtitle="施工範囲と PPF 種類を選択します">
      {/* フル / 部分 (Ver2.0 §5-Screen4 - Screen4 内で分岐) */}
      <div style={{ marginBottom: 20 }}>
        <div className="ds-label" style={{ marginBottom: 8 }}>施工範囲</div>
        <ChoiceGrid columns={2} gap={10}>
          <SelectButton selected={scope === 'full'}    onClick={() => { setScope('full');    persistAll({ scope: 'full' }); }} icon="shield" size="lg" subLabel="全ボディ施工">フル施工</SelectButton>
          <SelectButton selected={scope === 'partial'} onClick={() => { setScope('partial'); persistAll({ scope: 'partial' }); }} icon="shield-half" size="lg" subLabel="部位ごとに選択して施工">部分施工</SelectButton>
        </ChoiceGrid>
      </div>

      {scope && (
        <>
          {/* PPF 種類 (フィルムの種類選択 — フル/部分 共通) */}
          {Object.entries(window.PPF_TYPES).map(([key, group]) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <div className="ds-label" style={{ marginBottom: 8 }}>{group.label}</div>
              <ChoiceGrid columns={2} gap={10}>
                {group.items.map(it => (
                  <SelectButton key={it.id}
                    selected={selectedItems.includes(it.id)}
                    onClick={() => toggleFilmType(it.id)}
                    subLabel={`${it.desc} · 係数 ${it.coef}`}
                  >{it.name}</SelectButton>
                ))}
              </ChoiceGrid>
            </div>
          ))}

          {/* 部分施工箇所 (v2.2: フル・部分どちらでも並行選択可能)
              binding: 「フル施工と部分施工は完全に別行動」= 加算的に扱える
              scope='full' 時 → 「追加施工箇所」というラベルで、フルとは別に選ぶ
              scope='partial' 時 → 「部分施工箇所」というラベルで、これがメイン選択 */}
          <div style={{ marginBottom: 20 }}>
            <div className="ds-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield-half" size={14} style={{ color: 'var(--ds-primary-400)' }} />
              {scope === 'full' ? '追加施工箇所 (フル施工と別に選択可)' : '部分施工箇所 (複数選択可)'}
            </div>
              <ChoiceGrid columns={2} gap={10}>
                {window.PPF_PARTIAL_PARTS.map(part => {
                  const entry = partialParts[part.id];
                  const isOn = !!entry?.on;
                  const posCount = entry?.positions?.length || 0;
                  const needsPosition = !!part.positions;
                  return (
                    <div key={part.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      /* 選択中の項目は 2 列を跨いで箇所選択 UI を含めて広く表示。
                         これで「どの部位を選んだ / どの位置を選んだ」が一望できる。 */
                      gridColumn: (isOn && needsPosition) ? 'span 2' : 'span 1',
                    }}>
                      <SelectButton selected={isOn}
                        onClick={() => togglePart(part.id)}
                        subLabel={needsPosition
                          ? (isOn ? `${posCount} 箇所選択中 · ${formatYen(part.price)} × 位置数` : `${formatYen(part.price)} / 位置 · 位置選択が必要`)
                          : formatYen(part.price)}
                      >{part.name}</SelectButton>
                      {isOn && needsPosition && (
                        /* 位置選択サブグリッド: 4 位置を 4 列で並べる。
                           part のボタンが親、位置ボタンが子として視覚的にネストされる。 */
                        <div style={{
                          padding: '10px 12px',
                          background: 'var(--ds-bg-elevated)',
                          border: '1px solid var(--ds-line)',
                          borderRadius: 10,
                          marginLeft: 8,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: 'var(--ds-text-subtle)', marginBottom: 6, textTransform: 'uppercase' }}>
                            施工箇所を選択
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                            {part.positions.map(pos => (
                              <SelectButton key={pos.id}
                                size="sm"
                                selected={entry.positions.includes(pos.id)}
                                onClick={() => togglePosition(part.id, pos.id)}
                              >{pos.label}</SelectButton>
                            ))}
                          </div>
                          {posCount === 0 && (
                            <div style={{ marginTop: 8, padding: 8, background: 'var(--ds-amber-tint-10)', border: '1px solid var(--ds-amber-tint-40)', borderRadius: 8, fontSize: 11, color: 'var(--ds-amber-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="alert-circle" size={12} />
                              少なくとも 1 箇所を選択してください
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </ChoiceGrid>
          </div>

          <div style={{
            padding: 12, background: 'var(--ds-bg-elevated)',
            border: '1px solid var(--ds-line)', borderRadius: 10,
            fontSize: 12, color: 'var(--ds-text-muted)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Icon name="calculator" size={14} style={{ color: 'var(--ds-primary-400)', marginTop: 2 }} />
            <div>
              価格計算: <strong style={{ color: 'var(--ds-text-body)' }}>PPF 種類の係数 × 店舗設定の施工係数 × ボディサイズ倍率</strong>
              — 現時点で係数を掛けて自動計算します。GYEON 以外の PPF も店舗設定で拡張可能です。
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ウィンドウフィルム (v2.2 大改造)
   ------------------------------------------------------------------
   binding: 部位ごとにグレードを個別選択できる。
   Store 構造:
     store.window = {
       positions: {
         'front':       { grade: 'ultra' },   // グレード指定 = ON
         'rear':        { grade: 'std'   },
         // 未選択部位はキー無し
       }
     }
   価格: WINDOW_FILM_PRICE_MATRIX[gradeId][positionId] × ボディサイズ倍率
   ══════════════════════════════════════════════════════════════════ */
function WindowFilmSection({ store, updateStore }) {
  const w = store.window || {};
  const [positions, setPositions] = React.useState(w.positions || {});

  function togglePosition(posId) {
    const next = { ...positions };
    if (next[posId]) {
      /* 選択解除 = キーを削除 */
      delete next[posId];
    } else {
      /* 新規選択 = デフォルト STD グレードで登録 */
      next[posId] = { grade: 'std' };
    }
    setPositions(next);
    updateStore({ window: { positions: next } });
  }

  function setGradeFor(posId, gradeId) {
    const next = { ...positions, [posId]: { grade: gradeId } };
    setPositions(next);
    updateStore({ window: { positions: next } });
  }

  const selectedCount = Object.keys(positions).length;
  const grandTotal = Object.entries(positions).reduce((sum, [posId, cfg]) => {
    return sum + (window.WINDOW_FILM_PRICE_MATRIX[cfg.grade]?.[posId] || 0);
  }, 0);

  return (
    <Card
      title="ウィンドウフィルム"
      subtitle="施工したい窓 (部位) を選び、それぞれのグレードを指定します"
    >
      {/* 部位カード群 (Ver2.0 §5-Screen4 補記): 6 部位を選択カードで並べ、
          各カードは「タップで ON/OFF」+「ON 時にグレード 3 択が中に展開」 */}
      <div style={{
        display: 'grid',
        /* Tablet Portrait: 1 列 (SegmentedControl 展開時の縦幅を優先) */
        gridTemplateColumns: '1fr',
        gap: 10,
      }}>
        {window.WINDOW_FILM_POSITIONS.map(pos => {
          const cfg = positions[pos.id];
          const isOn = !!cfg;
          const currentGrade = cfg?.grade || 'std';
          const price = isOn ? (window.WINDOW_FILM_PRICE_MATRIX[currentGrade]?.[pos.id] || 0) : 0;
          return (
            <div key={pos.id} style={{
              padding: 14,
              background: isOn ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-card)',
              border: `1px solid ${isOn ? 'var(--ds-primary-tint-60)' : 'var(--ds-line)'}`,
              borderRadius: 12,
              boxShadow: isOn ? '0 4px 12px -4px rgba(29,78,216,0.3)' : 'var(--ds-shadow-md)',
              transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
            }}>
              {/* 上段: 部位名 + ON/OFF トグル */}
              <button
                onClick={() => togglePosition(pos.id)}
                aria-pressed={isOn}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'transparent', border: 'none', padding: 0,
                  cursor: 'pointer',
                  color: 'var(--ds-text-primary)',
                  fontFamily: 'var(--ds-font-sans)',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: isOn ? 'var(--ds-primary-500)' : 'var(--ds-bg-elevated)',
                  border: `1px solid ${isOn ? 'var(--ds-primary-500)' : 'var(--ds-line-slate)'}`,
                  display: 'grid', placeItems: 'center',
                  transition: 'all var(--ds-dur-fast)',
                }}>
                  {isOn && <Icon name="check" size={13} style={{ color: '#fff' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isOn ? '#fff' : 'var(--ds-text-primary)' }}>
                    {pos.name}
                  </div>
                </div>
                {isOn && (
                  <div className="ds-numeric" style={{
                    fontSize: 14, fontWeight: 700,
                    color: 'var(--ds-primary-200)',
                    flexShrink: 0,
                  }}>
                    {formatYen(price)}
                  </div>
                )}
              </button>

              {/* 下段: ON 時のみグレード 3 択が展開 */}
              {isOn && (
                <div style={{
                  marginTop: 12, paddingTop: 12,
                  borderTop: '1px solid var(--ds-primary-tint-60)',
                }}>
                  <div className="ds-label" style={{ marginBottom: 8, fontSize: 10, color: 'var(--ds-primary-200)' }}>
                    グレードを選択
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                    {window.WINDOW_FILM_GRADES.map(g => {
                      const gPrice = window.WINDOW_FILM_PRICE_MATRIX[g.id]?.[pos.id] || 0;
                      const isSel = currentGrade === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGradeFor(pos.id, g.id)}
                          aria-pressed={isSel}
                          style={{
                            padding: '8px 6px',
                            background: isSel ? 'var(--ds-primary-600)' : 'var(--ds-bg-elevated)',
                            border: `1px solid ${isSel ? 'var(--ds-primary-500)' : 'var(--ds-line-slate)'}`,
                            borderRadius: 8,
                            color: isSel ? '#fff' : 'var(--ds-text-body)',
                            cursor: 'pointer',
                            fontFamily: 'var(--ds-font-sans)',
                            fontSize: 12,
                            fontWeight: isSel ? 700 : 500,
                            transition: 'all var(--ds-dur-fast)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          }}
                        >
                          <span>{g.short}</span>
                          <span className="ds-numeric" style={{
                            fontSize: 10,
                            color: isSel ? 'rgba(255,255,255,0.75)' : 'var(--ds-text-muted)',
                          }}>
                            {formatYen(gPrice)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 合計プレビュー (部位を選んだ時のみ) */}
      {selectedCount > 0 && (
        <div style={{
          marginTop: 16, padding: 12,
          background: 'var(--ds-primary-tint-10)',
          border: '1px solid var(--ds-primary-tint-60)',
          borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--ds-primary-300)' }}>
            ウィンドウフィルム合計 ({selectedCount} 部位)
          </span>
          <span className="ds-numeric" style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {formatYen(grandTotal)}
          </span>
        </div>
      )}
    </Card>
  );
}

/* ── その他カテゴリ (メンテ・洗車・ルームクリーニング) ────────── */
function SimpleMenuSection({ title, menuKey, items, store, updateStore }) {
  const state = store[menuKey] || { selected: [] };
  const [selected, setSelected] = React.useState(state.selected || []);
  function toggle(id) {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(next);
    updateStore({ [menuKey]: { selected: next } });
  }
  return (
    <Card title={title} subtitle="メニューをタップして選択・解除します">
      <ChoiceGrid columns={2} gap={10}>
        {items.map(it => (
          <SelectButton key={it.id} selected={selected.includes(it.id)} onClick={() => toggle(it.id)} subLabel={formatYen(it.price)}>
            {it.name}
          </SelectButton>
        ))}
      </ChoiceGrid>
    </Card>
  );
}

/* ── その他の作業 (自由入力) ──────────────────────────────────── */
function OtherSection({ store, updateStore }) {
  const [items, setItems] = React.useState(store.other?.items || []);
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  function add() {
    if (!name || !price) return;
    const next = [...items, { id: 'o-' + Date.now(), name, price: Number(price) }];
    setItems(next);
    setName(''); setPrice('');
    updateStore({ other: { items: next } });
  }
  function remove(id) {
    const next = items.filter(x => x.id !== id);
    setItems(next);
    updateStore({ other: { items: next } });
  }
  return (
    <Card title="その他の作業" subtitle="自由に作業項目を追加できます">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
        <Field label="項目名">
          <Input value={name} onChange={setName} placeholder="例: フロントリップ 塗装" />
        </Field>
        <Field label="金額 (円)">
          <Input type="number" value={price} onChange={setPrice} placeholder="0" />
        </Field>
        <Button variant="primary" icon="plus" onClick={add}>追加</Button>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(it => (
            <div key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: 'var(--ds-bg-elevated)',
              border: '1px solid var(--ds-line)', borderRadius: 10,
            }}>
              <Icon name="clipboard" size={16} style={{ color: 'var(--ds-text-muted)' }} />
              <span style={{ flex: 1, fontSize: 13 }}>{it.name}</span>
              <span className="ds-numeric" style={{ fontSize: 14, fontWeight: 600 }}>{formatYen(it.price)}</span>
              <button onClick={() => remove(it.id)} style={{ background: 'transparent', border: 'none', color: 'var(--ds-red-400)', cursor: 'pointer', padding: 4 }}>
                <Icon name="trash-2" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── 店舗オプション (追加サービスオプション・動的) ─────────────── */
function StoreOptionsSection({ store, updateStore }) {
  const selected = store.storeOptions || [];
  function toggle(id) {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    updateStore({ storeOptions: next });
  }
  return (
    <Card
      title="追加サービスオプション"
      subtitle="全カテゴリで共通の店舗オプション。項目・価格は店舗設定で自由に変更できます。"
      actions={<Button variant="ghost" size="sm" icon="settings">店舗設定</Button>}
    >
      <ChoiceGrid columns={3} gap={10}>
        {window.STORE_OPTIONS.map(o => (
          <SelectButton key={o.id} selected={selected.includes(o.id)} onClick={() => toggle(o.id)} subLabel={formatYen(o.price)}>
            {o.name}
          </SelectButton>
        ))}
      </ChoiceGrid>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ds-text-subtle)', letterSpacing: 0.2 }}>
        ※ 初期表示は「例題」です。実際は店舗ごとに項目数・名称・価格が異なります (動的)。
      </div>
    </Card>
  );
}

/* ── 明細プレビュー ─────────────────────────────────────────── */
function LineItemsPreview({ store, updateStore }) {
  // 簡易ロジックで明細を組み立てる
  const items = React.useMemo(() => {
    const rows = [];
    const bodyMult = window.BODY_SIZES.find(s => s.id === store.confirmedSize)?.multiplier ?? 1.0;

    // Coating — category: 作業分類, detail: 商品名。label は後方互換用。
    const c = store.coating || {};
    if (c.base) rows.push({ category: 'コーティング', detail: `Q² ${c.base}`, label: `コーティング · Q² ${c.base}`, qty: 1, unit: Math.round(window.COATING_MATRIX.basePrice[c.base] * bodyMult) });
    if (c.layer2) rows.push({ category: '2 層目', detail: `Q² ${c.layer2}`, label: `2 層目 · Q² ${c.layer2}`, qty: 1, unit: Math.round(window.COATING_MATRIX.basePrice[c.layer2] * bodyMult) });
    if (c.layer3) rows.push({ category: '3 層目', detail: `Q² ${c.layer3}`, label: `3 層目 · Q² ${c.layer3}`, qty: 1, unit: Math.round(window.COATING_MATRIX.basePrice[c.layer3] * bodyMult) });

    // PPF
    const p = store.ppf || {};
    (p.items || []).forEach(id => {
      const item = Object.values(window.PPF_TYPES).flatMap(g => g.items).find(x => x.id === id);
      if (item) rows.push({
        category: 'PPF',
        detail: `${item.name} (${p.scope === 'full' ? 'フル' : '部分'})`,
        label: `PPF · ${item.name} (${p.scope === 'full' ? 'フル' : '部分'})`,
        qty: 1,
        unit: Math.round(180000 * item.coef * bodyMult),
      });
    });
    // PPF 部分施工パーツ (scope='partial' 時のみ)
    /* v2.2: フル・部分どちらでも並行選択可能なので、p.partialParts があれば
       scope に関わらず明細に含める */
    if (p.partialParts) {
      Object.entries(p.partialParts).forEach(([partId, entry]) => {
        if (!entry?.on) return;
        const part = window.PPF_PARTIAL_PARTS.find(x => x.id === partId);
        if (!part) return;
        if (part.positions) {
          // 位置ごとに 1 行 (qty = 位置数)
          const posCount = entry.positions?.length || 0;
          if (posCount === 0) return;   // 位置未選択の項目は明細に載せない (Amber warn 表示済み)
          const posLabels = entry.positions.map(pid => part.positions.find(p => p.id === pid)?.label).filter(Boolean).join(', ');
          rows.push({
            category: 'PPF 部分',
            detail: `${part.name} (${posLabels})`,
            label: `PPF 部分 · ${part.name} (${posLabels})`,
            qty: posCount,
            unit: part.price,
          });
        } else {
          rows.push({ category: 'PPF 部分', detail: part.name, label: `PPF 部分 · ${part.name}`, qty: 1, unit: part.price });
        }
      });
    }

    // Window (v2.2 大改造: 部位ごとにグレード指定、明細行も部位ごと)
    const w = store.window || {};
    /* 新構造: store.window.positions[posId] = { grade } */
    if (w.positions) {
      Object.entries(w.positions).forEach(([posId, cfg]) => {
        const pos = window.WINDOW_FILM_POSITIONS.find(p => p.id === posId);
        const grade = window.WINDOW_FILM_GRADES.find(g => g.id === cfg.grade);
        const price = window.WINDOW_FILM_PRICE_MATRIX[cfg.grade]?.[posId] || 0;
        if (pos && grade && price > 0) {
          rows.push({
            category: 'ウィンドウフィルム',
            detail: `${pos.name} · ${grade.short}`,
            label: `ウィンドウフィルム · ${pos.name} (${grade.name})`,
            qty: 1,
            unit: Math.round(price * bodyMult),
          });
        }
      });
    }
    /* 旧構造フォールバック (localStorage に古いデータがある場合の互換) */
    else if (w.grade) {
      const legacyPrice = { std: 40000, high: 60000, ultra: 90000 }[w.grade];
      const grade = window.WINDOW_FILM_GRADES.find(g => g.id === w.grade);
      if (grade && legacyPrice) {
        rows.push({
          category: 'ウィンドウフィルム',
          detail: `${grade.name} (旧データ)`,
          label: `ウィンドウフィルム · ${grade.name}`,
          qty: 1,
          unit: legacyPrice,
        });
      }
    }

    // Maintenance / carwash / roomclean
    [['maintenance', window.MAINTENANCE_MENUS, 'メンテ'], ['carwash', window.CARWASH_MENUS, '洗車'], ['roomclean', window.ROOMCLEAN_MENUS, 'ルームクリーニング']].forEach(([k, arr, prefix]) => {
      (store[k]?.selected || []).forEach(id => {
        const it = arr.find(x => x.id === id);
        if (it) rows.push({ category: prefix, detail: it.name, label: `${prefix} · ${it.name}`, qty: 1, unit: it.price });
      });
    });

    // Other
    (store.other?.items || []).forEach(it => {
      rows.push({ category: 'その他', detail: it.name, label: `その他 · ${it.name}`, qty: 1, unit: it.price });
    });

    // Store options
    (store.storeOptions || []).forEach(id => {
      const it = window.STORE_OPTIONS.find(x => x.id === id);
      if (it) rows.push({ category: 'オプション', detail: it.name, label: `オプション · ${it.name}`, qty: 1, unit: it.price });
    });

    return rows;
  }, [store]);

  const total = items.reduce((a, r) => a + r.qty * r.unit, 0);

  React.useEffect(() => {
    updateStore({ __lineItems: items });
  }, [JSON.stringify(items)]);

  return (
    <Card title="明細プレビュー" subtitle="各行の数量・単価を編集できます">
      {items.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 13 }}>
          <Icon name="file-text" size={32} style={{ color: 'var(--ds-text-faint)' }} />
          <div style={{ marginTop: 12 }}>まだ項目がありません。上でカテゴリを選択・設定してください。</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px 96px 28px',
            gap: 8, padding: '8px 10px',
            fontSize: 10, color: 'var(--ds-text-subtle)', letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase',
          }}>
            <div>項目</div>
            <div style={{ textAlign: 'right' }}>数量 / 単価</div>
            <div style={{ textAlign: 'right' }}>小計</div>
            <div />
          </div>
          {items.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px 96px 28px',
              gap: 8, alignItems: 'center', padding: '10px 10px',
              background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10,
              fontSize: 13,
            }}>
              {/* 2 段組: 上段=作業カテゴリ (小さめ・muted) / 下段=商品名 (通常・primary)
                  category が無い旧データは fallback で label をそのまま表示 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.3, minWidth: 0 }}>
                {r.category ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--ds-text-muted)', fontWeight: 500, letterSpacing: 0.2 }}>
                      {r.category}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ds-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
                      {r.detail}
                    </div>
                  </>
                ) : (
                  <div>{r.label}</div>
                )}
              </div>
              {/* 数量 × 単価: 1 セル内で縦積み。狭い列でも 2 行で綺麗に収まる */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 12, color: 'var(--ds-text-muted)' }}>
                <span className="ds-numeric">×{r.qty}</span>
                <span className="ds-numeric">{formatYen(r.unit)}</span>
              </div>
              {/* 小計: 一番大きく、bold で強調 */}
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--ds-text-primary)' }} className="ds-numeric">{formatYen(r.qty * r.unit)}</div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--ds-red-400)', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }} aria-label="削除">
                <Icon name="trash-2" size={12} />
              </button>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '12px 12px 4px', marginTop: 8,
            borderTop: '1px solid var(--ds-line-strong)',
          }}>
            <span className="ds-overline" style={{ padding: 0 }}>明細小計</span>
            <span className="ds-price-total" style={{ fontSize: 22 }}>{formatYen(total)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

window.Screen4_Estimate = Screen4_Estimate;
