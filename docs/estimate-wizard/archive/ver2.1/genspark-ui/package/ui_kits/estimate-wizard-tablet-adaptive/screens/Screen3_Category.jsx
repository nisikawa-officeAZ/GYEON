/* =============================================================================
   Screen 3 — 作業内容選択 (Category Selection)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen3 準拠。
   7 カテゴリ・複数選択可・自由選択 (制限なし)。編集時も同じ。
   PPF 部分施工は Screen4 内で分岐 (Screen3 では独立カテゴリにしない)。
   選択されたカテゴリのみ Screen4 に表示。
   ============================================================================= */

function Screen3_Category({ store, updateStore }) {
  const [cats, setCats] = React.useState(store.cats || []);

  function toggle(id) {
    const next = cats.includes(id) ? cats.filter(c => c !== id) : [...cats, id];
    setCats(next);
    updateStore({ cats: next });
  }

  return (
    <div>
      <ScreenTitle
        step={3}
        title="作業内容選択"
        subtitle="見積対象の施工カテゴリを選びます。複数選択可・自由選択（制限なし）です。"
      />

      <Card title="施工カテゴリ" subtitle="タップで選択 / 解除。選択したカテゴリのみが次の見積画面に表示されます。">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {window.CATEGORIES.map(c => (
            <CategoryCard key={c.id}
              category={c}
              selected={cats.includes(c.id)}
              onClick={() => toggle(c.id)}
            />
          ))}
        </div>

        {cats.length > 0 && (
          <div style={{
            marginTop: 20, padding: 14, background: 'var(--ds-primary-tint-10)',
            border: '1px solid var(--ds-primary-tint-60)', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'var(--ds-primary-tint-40)',
              display: 'grid', placeItems: 'center', color: 'var(--ds-primary-300)',
            }}>
              <Icon name="check" size={16} />
            </div>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--ds-text-primary)' }}>
              <strong>{cats.length}</strong> 件のカテゴリを選択中
              <span style={{ color: 'var(--ds-text-muted)', marginLeft: 8 }}>
                (
                {cats.map(id => window.CATEGORIES.find(c => c.id === id)?.label).join(' / ')}
                )
              </span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, background: 'var(--ds-bg-elevated)', border: '1px solid var(--ds-line)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={14} style={{ color: 'var(--ds-primary-400)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--ds-text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ds-text-body)' }}>PPF部分施工</strong> は独立カテゴリではありません — <strong>PPF</strong> を選択すると、次の画面で「フル施工 / 部分施工」に分岐します。<br />
            <strong style={{ color: 'var(--ds-text-body)' }}>メンテナンス / 洗車</strong> なども新規・編集問わず、いつでも自由に選択できます。
          </div>
        </div>
      </Card>
    </div>
  );
}

function CategoryCard({ category, selected, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={selected}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '18px 16px', minHeight: 120,
        background: selected ? 'var(--ds-primary-tint-40)' : 'var(--ds-bg-elevated)',
        border: `1px solid ${selected ? 'var(--ds-primary-tint-60)' : 'var(--ds-line-slate)'}`,
        borderRadius: 14, cursor: 'pointer',
        textAlign: 'left', color: 'var(--ds-text-primary)',
        fontFamily: 'var(--ds-font-sans)',
        transition: 'all var(--ds-dur-fast) var(--ds-ease-out)',
        boxShadow: selected ? 'inset 0 0 0 1px rgba(59,130,246,0.15), 0 4px 12px -4px rgba(29,78,216,0.3)' : 'none',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--ds-line-slate-2)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--ds-line-slate)'; }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--ds-primary-500)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 2px 8px rgba(29,78,216,0.4)',
        }}>
          <Icon name="check" size={14} style={{ color: '#fff' }} />
        </div>
      )}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: selected ? 'rgba(59,130,246,0.20)' : 'var(--ds-bg-panel)',
        display: 'grid', placeItems: 'center',
        color: selected ? 'var(--ds-primary-300)' : 'var(--ds-text-muted)',
      }}>
        <Icon name={category.icon} size={20} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? '#fff' : 'var(--ds-text-primary)' }}>
          {category.label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ds-text-subtle)', marginTop: 3 }}>
          {category.sub}
        </div>
      </div>
    </button>
  );
}

window.Screen3_Category = Screen3_Category;
