import { useState, useCallback } from "react";
import { drugService } from "../../services/drug.service";
import { customerService } from "../../services/customer.service";
import { invoiceService } from "../../services/invoice.service";
import { useCartStore } from "../../store/cartStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency } from "../../utils/formatters";
import type { Drug, Customer, PaymentMode } from "../../types";
import styles from "./Dispensing.module.css";

export function DispensingPage() {
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [searching, setSearching] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const {
    items, customer, paymentMode,
    setCustomer, setPaymentMode,
    addItem, updateQuantity, removeItem, clearCart,
    subtotal, total,
  } = useCartStore();

  // Drug search with debounce
  const searchDrugs = useCallback(async (q: string) => {
    setDrugQuery(q);
    if (q.length < 2) { setDrugResults([]); return; }
    setSearching(true);
    try {
      const results = await drugService.search(q);
      setDrugResults(results);
    } catch {
      setDrugResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Customer search
  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    try {
      const results = await customerService.search(q);
      setCustomerResults(results);
    } catch {
      setCustomerResults([]);
    }
  }

  function selectCustomer(c: Customer) {
    setCustomer(c);
    setCustomerModalOpen(false);
    setCustomerResults([]);
    setCustomerQuery("");
  }

  async function handleCheckout() {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const invoice = await invoiceService.create({
        customer_id: customer?.id,
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
      setSuccessModalOpen(true);
    } catch {
      // error handled visually
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Left ── */}
      <div className={styles.left}>
        {/* Customer bar */}
        <div className={styles.customerBar}>
          {customer ? (
            <>
              <div className={styles.customerInfo}>
                <div className={styles.customerName}>{customer.name}</div>
                <div className={styles.customerPhone}>{customer.contact_number}</div>
              </div>
              <div className={styles.customerActions}>
                <Badge variant="info">
                  {customer.loyalty_points} pts
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                No customer selected
              </span>
              <Button variant="secondary" size="sm" onClick={() => setCustomerModalOpen(true)}>
                + Customer
              </Button>
            </>
          )}
        </div>

        {/* Drug search */}
        <div className={styles.searchBar}>
          <div className={styles.searchInput}>
            <Input
              placeholder="Search drug by name, code, or generic name…"
              value={drugQuery}
              onChange={(e) => searchDrugs(e.target.value)}
              label="Drug Search"
            />
          </div>
        </div>

        {/* Drug results */}
        <div className={styles.drugResults}>
          {searching && (
            <div className={styles.emptyState}>Searching…</div>
          )}
          {!searching && drugQuery.length >= 2 && drugResults.length === 0 && (
            <div className={styles.emptyState}>No drugs found for "{drugQuery}"</div>
          )}
          {!searching && drugQuery.length < 2 && (
            <div className={styles.emptyState}>Type at least 2 characters to search</div>
          )}
          {drugResults.map((drug) => (
            <div key={drug.id} className={styles.drugRow} onClick={() => addItem(drug)}>
              <div>
                <div className={styles.drugName}>{drug.brand_name}</div>
                <div className={styles.drugGeneric}>{drug.generic_name} · {drug.strength}</div>
              </div>
              <div className={styles.drugMeta}>
                <div className={styles.drugPrice}>{formatCurrency(drug.unit_price)}</div>
                <div className={styles.drugStock}>Stock: {drug.quantity}</div>
                {drug.is_prescription_only && (
                  <Badge variant="warning">Rx</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right (Cart) ── */}
      <div className={styles.right}>
        <div className={styles.cartHeader}>
          <span>Cart</span>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              Clear
            </Button>
          )}
        </div>

        <div className={styles.cartItems}>
          {items.length === 0 ? (
            <div className={styles.cartEmpty}>Add drugs to begin</div>
          ) : (
            items.map((item) => (
              <div key={item.drug.id} className={styles.cartItem}>
                <div className={styles.cartItemName}>{item.drug.brand_name}</div>
                <div className={styles.cartItemRow}>
                  <div className={styles.qtyControl}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.drug.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className={styles.qtyValue}>{item.quantity}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQuantity(item.drug.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.lineTotal}>{formatCurrency(item.line_total)}</span>
                  <button className={styles.removeBtn} onClick={() => removeItem(item.drug.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.cartFooter}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal())}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span>{formatCurrency(total())}</span>
          </div>

          <select
            className={styles.paymentSelect}
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>

          <Button
            fullWidth
            loading={submitting}
            disabled={items.length === 0}
            onClick={handleCheckout}
          >
            Complete Sale
          </Button>
        </div>
      </div>

      {/* ── Customer Search Modal ── */}
      <Modal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="Select Customer"
        size="sm"
      >
        <div className={styles.searchModalInput}>
          <Input
            placeholder="Search by name or phone…"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
            autoFocus
          />
        </div>
        {customerResults.map((c) => (
          <div key={c.id} className={styles.customerResultRow} onClick={() => selectCustomer(c)}>
            <div style={{ fontWeight: "var(--font-weight-medium)", fontSize: "var(--font-size-sm)" }}>
              {c.name}
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {c.contact_number} · {c.loyalty_points} loyalty pts
            </div>
          </div>
        ))}
        {customerQuery.length >= 2 && customerResults.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", padding: "var(--space-4)" }}>
            No customers found
          </div>
        )}
      </Modal>

      {/* ── Success Modal ── */}
      <Modal
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Sale Completed"
        size="sm"
        footer={
          <Button onClick={() => setSuccessModalOpen(false)}>New Sale</Button>
        }
      >
        <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
          <div style={{ fontSize: "var(--font-size-2xl)", marginBottom: "var(--space-4)" }}>✓</div>
          <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-2)" }}>
            Invoice #{invoiceNumber}
          </div>
          <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            Sale recorded successfully.
          </div>
        </div>
      </Modal>
    </div>
  );
}
