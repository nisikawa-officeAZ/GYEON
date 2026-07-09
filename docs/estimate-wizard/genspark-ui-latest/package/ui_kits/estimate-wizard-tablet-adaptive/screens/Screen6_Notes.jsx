/* =============================================================================
   Screen 6 — 備考 / メモ (Notes)
   -----------------------------------------------------------------------------
   Ver2.0 §5-Screen6 準拠。
   - 備考: 見積内に表示 (顧客向け)
   - メモ: 社内用の記録 (見積には出さない)
   ============================================================================= */

function Screen6_Notes({ store, updateStore }) {
  const [notesCustomer, setNotesCustomer] = React.useState(store.notesCustomer || '');
  const [notesInternal, setNotesInternal] = React.useState(store.notesInternal || '');

  return (
    <div>
      <ScreenTitle step={6} title="備考" subtitle="顧客向けの備考と、社内用のメモをそれぞれ記録します。" />

      <Card
        title="備考 (顧客向け)"
        subtitle="見積書 PDF・LINE 送信文にそのまま表示されます"
        actions={<span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 700, color: 'var(--ds-primary-400)', padding: '3px 8px', border: '1px solid var(--ds-primary-tint-60)', borderRadius: 999, background: 'var(--ds-primary-tint-10)' }}>顧客に表示</span>}
      >
        <Textarea
          value={notesCustomer}
          onChange={v => { setNotesCustomer(v); updateStore({ notesCustomer: v }); }}
          placeholder="例: 施工予定日は打ち合わせにて調整いたします。ご不明点はいつでもお問い合わせください。"
          rows={5}
        />
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ds-text-subtle)' }}>
          {notesCustomer.length} 文字 · 見積 PDF に自動反映されます
        </div>
      </Card>

      <Card
        title="メモ (社内用)"
        subtitle="社内スタッフのみが確認できます。顧客への送付物には表示されません。"
        actions={<span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 700, color: 'var(--ds-text-muted)', padding: '3px 8px', border: '1px solid var(--ds-line-strong)', borderRadius: 999, background: 'var(--ds-bg-elevated)' }}>内部限定</span>}
      >
        <Textarea
          value={notesInternal}
          onChange={v => { setNotesInternal(v); updateStore({ notesInternal: v }); }}
          placeholder="例: 車体にリアフェンダーに傷あり。次回入庫時に補修見積を提案。"
          rows={5}
        />
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ds-text-subtle)' }}>
          {notesInternal.length} 文字 · 見積書には表示されません
        </div>
      </Card>
    </div>
  );
}

window.Screen6_Notes = Screen6_Notes;
