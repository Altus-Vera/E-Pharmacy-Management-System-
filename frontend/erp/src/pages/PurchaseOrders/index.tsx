import { useEffect, useState } from "react";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { supplierService } from "../../services/supplier.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatDate, formatPoStatus } from "../../utils/formatters";
import type { PurchaseOrder, PurchaseOrderCreate, PurchaseOrderItemCreate, Supplier } from "../../types";
import styles from "./PurchaseOrders.module.css";

const emptyItem = (): PurchaseOrderItemCreate => ({ drug_id: 0, quantity_ordered: 1, unit_cost: 0 });

export function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseOrderItemCreate[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [allPOs, allSuppliers] = await Promise.all([purchaseOrderService.getAll(), supplierService.getAll()]);
      setPos(allPOs);
      setSuppliers(allSuppliers);
    } finally { setLoading(false); }
  }

  function openNew() {
    setSupplierId(suppliers[0]?.id ?? 0);
    setNotes("");
    setItems([emptyItem()]);
    setModalOpen(true);
  }

  function updateItem(idx: number, field: keyof PurchaseOrderItemCreate, value: unknown) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function handleSave() {
    setSaving(true);
    const body: PurchaseOrderCreate = { supplier_id: supplierId, notes, items };
    try {
      const created = await purchaseOrderService.create(body);
      setPos((prev) => [created, ...prev]);
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  const statusVariant = (s: string): "warning" | "success" | "danger" | "primary" | "neutral" => {
    if (s === "received") return "success";
    if (s === "cancelled") return "danger";
    if (s === "submitted") return "primary";
    if (s === "draft") return "neutral";
    return "warning";
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button onClick={openNew}>+ New Order</Button>
      </div>

      <Table<PurchaseOrder>
        columns={[
          { key: "order_number", header: "Order #" },
          { key: "supplier_id", header: "Supplier", render: (r) => suppliers.find((s) => s.id === r.supplier_id)?.name ?? `#${r.supplier_id}` },
          { key: "items", header: "Items", render: (r) => `${r.items.length} item(s)` },
          { key: "status", header: "Status", render: (r) => <Badge variant={statusVariant(r.status)}>{formatPoStatus(r.status)}</Badge> },
          { key: "created_at", header: "Created", render: (r) => formatDate(r.created_at) },
        ]}
        data={pos}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No purchase orders found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Purchase Order"
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave} disabled={items.some((i) => !i.drug_id)}>Create Order</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <div>
            <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" }}>Supplier</label>
            <select
              style={{ width: "100%", marginTop: "var(--space-1)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-size-sm)" }}
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
            >
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>

        <div className={styles.itemsSection}>
          <div className={styles.itemsTitle}>Order Items</div>
          {items.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <Input label={idx === 0 ? "Drug ID" : ""} type="number" min={1} placeholder="Drug ID" value={item.drug_id || ""} onChange={(e) => updateItem(idx, "drug_id", parseInt(e.target.value) || 0)} />
              <Input label={idx === 0 ? "Qty" : ""} type="number" min={1} value={item.quantity_ordered} onChange={(e) => updateItem(idx, "quantity_ordered", parseInt(e.target.value) || 1)} />
              <Input label={idx === 0 ? "Unit Cost" : ""} type="number" min={0} step={0.01} value={item.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", parseFloat(e.target.value) || 0)} />
              <button className={styles.removeBtn} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} disabled={items.length === 1}>✕</button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className={styles.addItemBtn} onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            + Add Item
          </Button>
        </div>
      </Modal>
    </div>
  );
}
