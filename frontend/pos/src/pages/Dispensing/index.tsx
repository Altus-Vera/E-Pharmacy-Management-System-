import { useState, useCallback, useEffect, useRef } from "react";
import { drugService } from "../../services/drug.service";
import { customerService } from "../../services/customer.service";
import { doctorService } from "../../services/doctor.service";
import { invoiceService } from "../../services/invoice.service";
import { useCartStore } from "../../store/cartStore";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDate } from "../../utils/formatters";
import type { Drug, Customer, Doctor, PaymentMode } from "../../types";
import styles from "./Dispensing.module.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}Y`;
}

function isColdChain(drug: Drug): boolean {
  const s = (drug.storage_requirements ?? "").toLowerCase();
  return s.includes("2") && s.includes("8") || s.includes("refriger") || s.includes("cold");
}

function expiryWarning(expiry: string | null): "danger" | "warning" | null {
  if (!expiry) return null;
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 3600 * 24);
  if (days < 0) return "danger";
  if (days < 90) return "warning";
  return null;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DispensingPage() {
  const searchRef = useRef<HTMLInputElement>(null);

  // drug search
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [searching, setSearching] = useState(false);

  // customer modal
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  // doctor modal
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<Doctor[]>([]);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);

  // cash
  const [cashTendered, setCashTendered] = useState<string>("");

  // checkout
  const [submitting, setSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const {
    items, customer, doctor, paymentMode,
    setCustomer, setDoctor, setPaymentMode,
    addItem, updateQuantity, updateDiscount, removeItem, clearCart,
    subtotal, totalDiscount, total,
  } = useCartStore();

  // F1 focus shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchDrugs = useCallback(async (q: string) => {
    setDrugQuery(q);
    if (q.length < 2) { setDrugResults([]); return; }
    setSearching(true);
    try {
      setDrugResults(await drugService.search(q));
    } catch { setDrugResults([]); }
    finally { setSearching(false); }
  }, []);

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    try { setCustomerResults(await customerService.search(q)); }
    catch { setCustomerResults([]); }
  }

  async function searchDoctors(q: string) {
    setDoctorQuery(q);
    if (q.length < 2) { setDoctorResults([]); return; }
    try { setDoctorResults(await doctorService.search(q)); }
    catch { setDoctorResults([]); }
  }

  function selectCustomer(c: Customer) {
    setCustomer(c);
    setCustomerModalOpen(false);
    setCustomerResults([]);
    setCustomerQuery("");
  }

  function selectDoctor(d: Doctor) {
    setDoctor(d);
    setDoctorModalOpen(false);
    setDoctorResults([]);
    setDoctorQuery("");
  }

  function handleAddDrug(drug: Drug) {
    addItem(drug);
    setDrugQuery("");
    setDrugResults([]);
    searchRef.current?.focus();
  }

  const netTotal = total();
  const tendered = parseFloat(cashTendered) || 0;
  const change = tendered - netTotal;

  async function handleCheckout() {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const invoice = await invoiceService.create({
        customer_id: customer?.id,
        doctor_id: doctor?.id,
        items: items.map((i) => ({
          drug_id: i.drug.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_rate: i.discount_rate,
        })),
        payment_mode: paymentMode as PaymentMode,
      });
      setInvoiceNumber(invoice.invoice_number);
      clearCart();
      setDrugResults([]);
      setDrugQuery("");
      setCashTendered("");
      setSuccessModalOpen(true);
    } catch {
      // keep cart; server error will surface in future
    } finally {
      setSubmitting(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ══ TOP BARS ═══════════════════════════════════════════════════════════ */}
      <div className={styles.topBars}>

        {/* Customer bar */}
        <div className={styles.infoBar}>
          <div className={styles.infoBarLeft}>
            {customer ? (
              <>
                <div className={styles.infoIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </div>
                <div>
                  <div className={styles.infoName}>
                    {customer.name}
                    {customer.contact_number && <span className={styles.infoSub}> · {customer.contact_number}</span>}
                    {customer.dob && <span className={styles.infoSub}> · Age: {calcAge(customer.dob)}</span>}
                    {customer.gender && <span className={styles.infoSub}> {customer.gender.charAt(0).toUpperCase()}</span>}
                  </div>
                  {customer.clinical_remarks && (
                    <div className={styles.allergyAlert}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      CLINICAL NOTE: {customer.clinical_remarks}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className={styles.noEntity}>No patient selected</span>
            )}
          </div>
          <div className={styles.infoBarRight}>
            {customer && (
              <span className={styles.loyaltyBadge}>⭐ {customer.loyalty_points} Loyalty Pts</span>
            )}
            <button className={styles.changeBtn} onClick={() => setCustomerModalOpen(true)}>
              {customer ? "Change" : "+ Patient"} (F4)
            </button>
            {customer && (
              <button className={styles.removeEntityBtn} onClick={() => setCustomer(null)}>✕</button>
            )}
          </div>
        </div>

        {/* Doctor / Prescriber bar */}
        <div className={styles.infoBar}>
          <div className={styles.infoBarLeft}>
            {doctor ? (
              <>
                <div className={styles.infoIcon} style={{ color: "var(--color-primary)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                  </svg>
                </div>
                <div>
                  <div className={styles.infoName}>
                    Dr. {doctor.name}
                    <span className={styles.slmcBadge}>SLMC: {doctor.slmc_registration_number}</span>
                  </div>
                  <div className={styles.infoSub}>
                    {[doctor.specialization, doctor.hospital].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </>
            ) : (
              <span className={styles.noEntity}>No prescriber linked</span>
            )}
          </div>
          <div className={styles.infoBarRight}>
            <button className={styles.changeBtn} onClick={() => setDoctorModalOpen(true)}>
              {doctor ? "Edit Prescriber" : "+ Prescriber"}
            </button>
            {doctor && (
              <button className={styles.removeEntityBtn} onClick={() => setDoctor(null)}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ══ MAIN AREA ══════════════════════════════════════════════════════════ */}
      <div className={styles.main}>

        {/* ── Left: search + tray ─────────────────────────────────────────── */}
        <div className={styles.left}>

          {/* Drug search */}
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                className={styles.searchInput}
                placeholder="Scan Barcode or Search by Brand (Panadol), Generic (Paracetamol), or Strength (F1 to focus)…"
                value={drugQuery}
                onChange={(e) => searchDrugs(e.target.value)}
                autoFocus
              />
              {drugQuery && (
                <button className={styles.searchClear} onClick={() => { setDrugQuery(""); setDrugResults([]); }}>✕</button>
              )}
            </div>
            <div className={styles.searchActions}>
              <button className={styles.actionBtn}>Generic Sub (Alt+G)</button>
              <button className={styles.actionBtn}>FEFO Batches</button>
            </div>
          </div>

          {/* Drug results dropdown */}
          {drugQuery.length >= 2 && (
            <div className={styles.drugDropdown}>
              {searching && <div className={styles.dropdownMsg}>Searching…</div>}
              {!searching && drugResults.length === 0 && (
                <div className={styles.dropdownMsg}>No drugs found for "{drugQuery}"</div>
              )}
              {drugResults.map((drug) => (
                <div key={drug.id} className={styles.drugRow} onClick={() => handleAddDrug(drug)}>
                  <div className={styles.drugRowLeft}>
                    <div className={styles.drugName}>
                      {drug.brand_name}
                      {drug.is_prescription_only && <span className={styles.pomTag}>POM</span>}
                      {isColdChain(drug) && <span className={styles.coldTag}>2–8°C</span>}
                    </div>
                    <div className={styles.drugGeneric}>{drug.generic_name}{drug.strength ? ` · ${drug.strength}` : ""} · {drug.dosage_form}</div>
                  </div>
                  <div className={styles.drugRowRight}>
                    <div className={styles.drugPrice}>{formatCurrency(drug.unit_price)}</div>
                    <div className={styles.drugStock} style={{ color: drug.quantity <= drug.reorder_level ? "var(--color-danger)" : undefined }}>
                      Stock: {drug.quantity}
                    </div>
                    {drug.batch_number && <div className={styles.batchTag}>{drug.batch_number}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dispensing Tray */}
          <div className={styles.tray}>
            <div className={styles.trayHeader}>
              <div className={styles.trayTitle}>
                PRESCRIPTION DISPENSING TRAY
                {items.length > 0 && <span className={styles.trayCount}>{items.length} Item{items.length !== 1 ? "s" : ""}</span>}
              </div>
              <div className={styles.trayNote}>Strict FEFO (First Expired, First Out) rules applied</div>
            </div>

            {items.length === 0 ? (
              <div className={styles.trayEmpty}>Add drugs using the search bar above to begin dispensing</div>
            ) : (
              <table className={styles.trayTable}>
                <thead>
                  <tr>
                    <th className={styles.thNum}>#</th>
                    <th className={styles.thItem}>ITEM &amp; STRENGTH</th>
                    <th className={styles.thBatch}>BATCH / EXPIRY</th>
                    <th className={styles.thUnit}>UNIT</th>
                    <th className={styles.thQty}>QTY</th>
                    <th className={styles.thPrice}>UNIT PRICE</th>
                    <th className={styles.thDisc}>DISC %</th>
                    <th className={styles.thTotal}>LINE TOTAL (LKR)</th>
                    <th className={styles.thAct}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const warn = expiryWarning(item.drug.expiry_date);
                    return (
                      <tr key={item.drug.id} className={styles.trayRow}>
                        <td className={styles.tdNum}>{idx + 1}</td>
                        <td className={styles.tdItem}>
                          <div className={styles.itemName}>{item.drug.brand_name}</div>
                          <div className={styles.itemSub}>{item.drug.generic_name}{item.drug.strength ? ` · ${item.drug.strength}` : ""}</div>
                          <div className={styles.itemBadges}>
                            {item.drug.is_prescription_only && <Badge variant="warning">POM</Badge>}
                            {item.drug.is_high_alert && <Badge variant="danger">High Alert</Badge>}
                            {item.drug.is_narcotic && <Badge variant="danger">Narcotic</Badge>}
                            {isColdChain(item.drug) && <Badge variant="info">2–8°C</Badge>}
                          </div>
                        </td>
                        <td className={styles.tdBatch}>
                          {item.drug.batch_number && (
                            <div className={styles.batchNum}>{item.drug.batch_number}</div>
                          )}
                          {item.drug.expiry_date && (
                            <div className={styles.expiryDate} style={{ color: warn === "danger" ? "var(--color-danger)" : warn === "warning" ? "var(--color-warning)" : undefined }}>
                              ★ Exp: {formatDate(item.drug.expiry_date)}
                            </div>
                          )}
                        </td>
                        <td className={styles.tdUnit}>{item.drug.dosage_form}</td>
                        <td className={styles.tdQty}>
                          <div className={styles.qtyControl}>
                            <button className={styles.qtyBtn} onClick={() => updateQuantity(item.drug.id, item.quantity - 1)}>−</button>
                            <span className={styles.qtyVal}>{item.quantity}</span>
                            <button className={styles.qtyBtn} onClick={() => updateQuantity(item.drug.id, item.quantity + 1)}>+</button>
                          </div>
                        </td>
                        <td className={styles.tdPrice}>{formatCurrency(item.unit_price)}</td>
                        <td className={styles.tdDisc}>
                          <input
                            className={styles.discInput}
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={item.discount_rate}
                            onChange={(e) => updateDiscount(item.drug.id, parseFloat(e.target.value) || 0)}
                          />
                          <span className={styles.discPct}>%</span>
                        </td>
                        <td className={styles.tdTotal}>{formatCurrency(item.line_total)}</td>
                        <td className={styles.tdAct}>
                          <button className={styles.removeBtn} onClick={() => removeItem(item.drug.id)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {items.length > 0 && (
              <div className={styles.trayFooterLegend}>
                <span className={styles.legendItem}>★ FEFO Auto-allocated</span>
                <span className={styles.legendItem}>POM Verified</span>
                <span className={styles.legendItem}>Cold-chain check</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: billing panel ─────────────────────────────────────────── */}
        <div className={styles.billing}>
          {/* Totals */}
          <div className={styles.billingSection}>
            <div className={styles.billingRow}>
              <span>Gross Subtotal</span>
              <span>{formatCurrency(subtotal())}</span>
            </div>
            <div className={styles.billingRow}>
              <span>Item / Special Discount</span>
              <span className={styles.discountVal}>− {formatCurrency(totalDiscount())}</span>
            </div>
            <div className={styles.billingRow}>
              <span>Tax (0% Essential Rx / VAT Ex.)</span>
              <span>{formatCurrency(0)}</span>
            </div>
          </div>

          <div className={styles.netPayable}>
            <span>NET PAYABLE</span>
            <span className={styles.netAmount}>{formatCurrency(netTotal)}</span>
          </div>
          <div className={styles.netSub}>Total payable including discounts</div>

          {/* Settlement mode */}
          <div className={styles.billingSectionLabel}>SELECT SETTLEMENT MODE</div>
          <div className={styles.settleTabs}>
            {(["cash", "card", "qr"] as PaymentMode[]).map((mode) => (
              <button
                key={mode}
                className={`${styles.settleTab} ${paymentMode === mode ? styles.settleTabActive : ""}`}
                onClick={() => setPaymentMode(mode)}
              >
                {mode === "cash" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
                  </svg>
                )}
                {mode === "card" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                )}
                {mode === "qr" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/>
                    <path d="M21 16h-3v3M21 21h-3M14 3v3h3M14 10h7M14 14h3v3M3 10v4M3 17v1"/>
                  </svg>
                )}
                <span>{mode === "qr" ? "LankaQR" : mode === "card" ? "Credit/Debit" : "Cash"}</span>
              </button>
            ))}
          </div>

          {/* Cash tendered */}
          {paymentMode === "cash" && (
            <div className={styles.cashSection}>
              <div className={styles.billingSectionLabel}>CASH TENDERED (LKR)</div>
              <div className={styles.cashInputRow}>
                <span className={styles.cashPrefix}>Rs.</span>
                <input
                  className={styles.cashInput}
                  type="number"
                  min={0}
                  step={0.01}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.cashPresets}>
                <button className={styles.presetBtn} onClick={() => setCashTendered(netTotal.toFixed(2))}>Exact</button>
                {[500, 1000, 5000].map((v) => (
                  <button key={v} className={styles.presetBtn} onClick={() => setCashTendered((Math.ceil(netTotal / v) * v).toFixed(2))}>
                    +{v}
                  </button>
                ))}
              </div>
              <div className={styles.changeRow}>
                <span>CHANGE TO RETURN</span>
                <span className={`${styles.changeVal} ${change < 0 ? styles.changeNeg : ""}`}>
                  LKR {change >= 0 ? formatCurrency(change) : "0.00"}
                </span>
              </div>
              <div className={styles.changeSub}>
                {tendered === 0 ? "Awaiting tendered cash" : change < 0 ? "Insufficient amount" : "Change ready"}
              </div>
            </div>
          )}

          <div className={styles.checkoutSection}>
            <button
              className={styles.checkoutBtn}
              disabled={items.length === 0 || submitting}
              onClick={handleCheckout}
            >
              {submitting ? "Processing…" : "Complete Sale (F12)"}
            </button>
            {items.length > 0 && (
              <button className={styles.clearBtn} onClick={clearCart}>Clear All</button>
            )}
          </div>
        </div>
      </div>

      {/* ══ MODALS ═════════════════════════════════════════════════════════════ */}

      {/* Customer search modal */}
      <Modal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Select Patient" size="sm">
        <div className={styles.modalSearch}>
          <input
            className={styles.modalSearchInput}
            placeholder="Search by name or phone…"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
            autoFocus
          />
        </div>
        {customerResults.map((c) => (
          <div key={c.id} className={styles.entityRow} onClick={() => selectCustomer(c)}>
            <div className={styles.entityName}>{c.name}</div>
            <div className={styles.entitySub}>{c.contact_number} · {c.loyalty_points} loyalty pts{c.clinical_remarks ? ` · ⚠ ${c.clinical_remarks}` : ""}</div>
          </div>
        ))}
        {customerQuery.length >= 2 && customerResults.length === 0 && (
          <div className={styles.modalEmpty}>No patients found</div>
        )}
      </Modal>

      {/* Doctor search modal */}
      <Modal open={doctorModalOpen} onClose={() => setDoctorModalOpen(false)} title="Select Prescriber" size="sm">
        <div className={styles.modalSearch}>
          <input
            className={styles.modalSearchInput}
            placeholder="Search by name or SLMC number…"
            value={doctorQuery}
            onChange={(e) => searchDoctors(e.target.value)}
            autoFocus
          />
        </div>
        {doctorResults.map((d) => (
          <div key={d.id} className={styles.entityRow} onClick={() => selectDoctor(d)}>
            <div className={styles.entityName}>Dr. {d.name} <span className={styles.slmcInline}>SLMC: {d.slmc_registration_number}</span></div>
            <div className={styles.entitySub}>{[d.specialization, d.hospital].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
        {doctorQuery.length >= 2 && doctorResults.length === 0 && (
          <div className={styles.modalEmpty}>No prescribers found</div>
        )}
      </Modal>

      {/* Success modal */}
      <Modal
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Sale Completed"
        size="sm"
        footer={<Button onClick={() => setSuccessModalOpen(false)}>New Sale</Button>}
      >
        <div className={styles.successBody}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>Invoice #{invoiceNumber}</div>
          <div className={styles.successSub}>Sale recorded successfully.</div>
        </div>
      </Modal>
    </div>
  );
}
