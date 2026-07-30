export default function QuoteEditor({
  quote,
  onNameChange,
  currencyDraft,
  onCurrencyChange,
  onCurrencyPreset,
  currencyFormatter,
  totals,
  priceStatus,
  onReimportPrices,
  storeTotals,
  onRowChange,
  onRemoveRow,
  onAddRow,
  formatDateTime,
}) {
  return (
    <>
      <header className="quote-header">
        <div className="quote-header-main">
          <label className="field">
            <span>Nombre de la cotización</span>
            <input
              type="text"
              value={quote.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej: PC Gamer RTX 4060"
            />
          </label>
          <label className="field">
            <span>Moneda</span>
            <div className="currency-row">
              <div className="currency-pills">
                {["CLP", "USD", "EUR"].map((code) => (
                  <label
                    key={code}
                    className={"currency-pill" + (quote.currency === code ? " active" : "")}
                  >
                    <input
                      type="radio"
                      name="currency"
                      value={code}
                      checked={quote.currency === code}
                      onChange={() => onCurrencyPreset(code)}
                    />
                    {code}
                  </label>
                ))}
              </div>
              <div className="currency-custom">
                <span>Otra</span>
                <input
                  className="currency-input"
                  type="text"
                  value={currencyDraft}
                  onChange={onCurrencyChange}
                  maxLength={3}
                  placeholder="Ej: GBP"
                  aria-label="Moneda personalizada"
                />
              </div>
            </div>
          </label>
        </div>

        <div className="totals">
          <div className="total-card">
            <span className="total-label">Total oferta</span>
            <span className="total-value">{currencyFormatter.format(totals.totalOffer || 0)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Precio normal</span>
            <span className="total-value">{currencyFormatter.format(totals.totalRegular || 0)}</span>
          </div>
          <div className="total-card total-card-saving">
            <span className="total-label">Ahorro</span>
            <span className="total-value">{currencyFormatter.format(totals.saving || 0)}</span>
          </div>
          <div className="total-card">
            <span className="total-label">Ítems con precio</span>
            <span className="total-value">
              {totals.rowsWithPrice}/{quote.rows.length}
            </span>
            {totals.rowsWithPrice === 0 && <span className="muted">Agrega precios para ver totales reales</span>}
          </div>
          <div className="total-card total-card-status">
            <span className="total-label">Estado de precios</span>
            <span
              className={`status-chip ${priceStatus.className}`}
              title={priceStatus.updatedAt ? `Actualizado: ${formatDateTime(priceStatus.updatedAt)}` : ""}
            >
              {priceStatus.label}
            </span>
            {priceStatus.updatedAt && (
              <span className="muted">
                Actualizado: {formatDateTime(priceStatus.updatedAt)} ·{" "}
                <button className="link-btn" onClick={onReimportPrices}>
                  Reimportar precios
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="store-totals">
          {storeTotals.length === 0 ? (
            <span className="muted">Aún no hay precios por tienda.</span>
          ) : (
            storeTotals.map((store) => (
              <div key={store.store} className="store-pill">
                <div className="store-name">{store.store}</div>
                <div className="store-values">
                  <span>Oferta: {currencyFormatter.format(store.offer)}</span>
                  <span>Normal: {currencyFormatter.format(store.regular)}</span>
                  <span>Ahorro: {currencyFormatter.format(store.saving)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </header>

      <section className="table-section">
        <div className="table-wrapper">
          <div className="table-toolbar">
            <span className="muted">
              {totals.rowsWithPrice === 0
                ? "Sin precios cargados; agrega manualmente o importa por id."
                : totals.rowsWithPrice === quote.rows.length
                ? "Todos los ítems tienen precio."
                : "Faltan precios en algunos ítems."}
            </span>
          </div>
          <table className="quote-table">
            <thead>
              <tr>
                <th style={{ width: "14%" }}>Componente</th>
                <th style={{ width: "28%" }}>Producto</th>
                <th style={{ width: "14%" }}>Tienda</th>
                <th style={{ width: "12%" }}>Oferta</th>
                <th style={{ width: "12%" }}>Normal</th>
                <th style={{ width: "16%" }}>Notas</th>
                <th style={{ width: "4%" }}></th>
              </tr>
            </thead>
            <tbody>
              {quote.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => onRowChange(row.id, "category", e.target.value)}
                      placeholder="Tarjeta de video, RAM…"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.product}
                      onChange={(e) => onRowChange(row.id, "product", e.target.value)}
                      placeholder="Modelo exacto"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.store}
                      onChange={(e) => onRowChange(row.id, "store", e.target.value)}
                      placeholder="Tienda"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.offerPrice}
                      onChange={(e) => onRowChange(row.id, "offerPrice", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.regularPrice}
                      onChange={(e) => onRowChange(row.id, "regularPrice", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => onRowChange(row.id, "notes", e.target.value)}
                      placeholder="Comentarios, links…"
                    />
                  </td>
                  <td className="actions-cell">
                    <button className="icon-btn" onClick={() => onRemoveRow(row.id)} title="Eliminar fila">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7}>
                  <button className="secondary-btn full-width" onClick={onAddRow}>
                    + Agregar componente
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
