using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Drug> Drugs => Set<Drug>();
    public DbSet<DrugBatch> DrugBatches => Set<DrugBatch>();
    public DbSet<FrequencyCode> FrequencyCodes => Set<FrequencyCode>();
    public DbSet<DrugCategory> DrugCategories => Set<DrugCategory>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptItem> GoodsReceiptItems => Set<GoodsReceiptItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockLocation> StockLocations => Set<StockLocation>();
    public DbSet<UnitOfMeasure> UnitsOfMeasure => Set<UnitOfMeasure>();
    public DbSet<PriceAdjustment> PriceAdjustments => Set<PriceAdjustment>();
    public DbSet<PurchaseRequisition> PurchaseRequisitions => Set<PurchaseRequisition>();
    public DbSet<PurchaseInvoice> PurchaseInvoices => Set<PurchaseInvoice>();
    public DbSet<SalesReturn> SalesReturns => Set<SalesReturn>();
    public DbSet<StockAdjustment> StockAdjustments => Set<StockAdjustment>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Outlet> Outlets => Set<Outlet>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<SupplierReturn> SupplierReturns => Set<SupplierReturn>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Users ──────────────────────────────────────────────
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            e.Property(x => x.Nic).HasColumnName("nic").HasMaxLength(20).IsRequired();
            e.Property(x => x.UserType).HasColumnName("user_type")
                .HasMaxLength(30).IsRequired().HasConversion<string>();
            e.Property(x => x.Address).HasColumnName("address");
            e.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(20);
            e.Property(x => x.Username).HasColumnName("username").HasMaxLength(100).IsRequired();
            e.Property(x => x.HashedPassword).HasColumnName("hashed_password").HasMaxLength(255).IsRequired();
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.FailedLoginAttempts).HasColumnName("failed_login_attempts");
            e.Property(x => x.LockedUntil).HasColumnName("locked_until");
            e.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.Nic).IsUnique();
            e.HasIndex(x => x.Username).IsUnique();
        });

        // ── DrugCategories ─────────────────────────────────────
        modelBuilder.Entity<DrugCategory>(e =>
        {
            e.ToTable("drug_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
        });

        // ── Drugs ─────────────────────────────────────────────
        modelBuilder.Entity<Drug>(e =>
        {
            e.ToTable("drugs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ItemCode).HasColumnName("item_code").HasMaxLength(50).IsRequired();
            e.Property(x => x.BrandName).HasColumnName("brand_name").HasMaxLength(200).IsRequired();
            e.Property(x => x.GenericName).HasColumnName("generic_name").HasMaxLength(200).IsRequired();
            e.Property(x => x.ActiveIngredient).HasColumnName("active_ingredient").HasMaxLength(200);
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.Strength).HasColumnName("strength").HasMaxLength(50);
            e.Property(x => x.DosageForm).HasColumnName("dosage_form")
                .HasMaxLength(20).IsRequired().HasConversion<string>();
            e.Property(x => x.StorageRequirements).HasColumnName("storage_requirements").HasMaxLength(300);
            e.Property(x => x.BatchNumber).HasColumnName("batch_number").HasMaxLength(100);
            e.Property(x => x.ManufacturedDate).HasColumnName("manufactured_date");
            e.Property(x => x.ExpiryDate).HasColumnName("expiry_date");
            e.Property(x => x.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2).IsRequired();
            e.Property(x => x.Discount).HasColumnName("discount").HasPrecision(5, 2);
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.PackSize).HasColumnName("pack_size");
            e.Property(x => x.BaseUnit).HasColumnName("base_unit").HasMaxLength(20).HasDefaultValue("unit");
            e.Property(x => x.UnitsPerStrip).HasColumnName("units_per_strip");
            e.Property(x => x.SellMode).HasColumnName("sell_mode").HasMaxLength(10).HasDefaultValue("loose");
            e.Property(x => x.NonLooseReason).HasColumnName("non_loose_reason").HasMaxLength(200);
            e.Property(x => x.MinLooseQty).HasColumnName("min_loose_qty");
            e.Property(x => x.DoseUnit).HasColumnName("dose_unit").HasMaxLength(20);
            e.Property(x => x.ContentPerUnit).HasColumnName("content_per_unit").HasPrecision(10, 2);
            e.Property(x => x.DefaultDose).HasColumnName("default_dose").HasPrecision(8, 2);
            e.Property(x => x.DefaultFrequency).HasColumnName("default_frequency").HasMaxLength(20);
            e.Property(x => x.MaxDays).HasColumnName("max_days");
            e.Property(x => x.MinDays).HasColumnName("min_days");
            e.Property(x => x.LowStockThreshold).HasColumnName("low_stock_threshold");
            e.Property(x => x.ReorderLevel).HasColumnName("reorder_level");
            e.Property(x => x.IsPrescriptionOnly).HasColumnName("is_prescription_only");
            e.Property(x => x.IsOtc).HasColumnName("is_otc");
            e.Property(x => x.IsHighAlert).HasColumnName("is_high_alert");
            e.Property(x => x.IsNarcotic).HasColumnName("is_narcotic");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CategoryId).HasColumnName("category_id");
            e.Property(x => x.SupplierId).HasColumnName("supplier_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.ItemCode).IsUnique();
            e.HasOne(x => x.Category).WithMany(c => c.Drugs).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Supplier).WithMany(s => s.Drugs).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Customers ─────────────────────────────────────────
        modelBuilder.Entity<Customer>(e =>
        {
            e.ToTable("customers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            e.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(20).IsRequired();
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(150);
            e.Property(x => x.Address).HasColumnName("address");
            e.Property(x => x.Dob).HasColumnName("dob");
            e.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(10).HasConversion<string>();
            e.Property(x => x.LoyaltyPoints).HasColumnName("loyalty_points").HasPrecision(10, 2);
            e.Property(x => x.DiscountRate).HasColumnName("discount_rate").HasPrecision(5, 2);
            e.Property(x => x.ClinicalRemarks).HasColumnName("clinical_remarks");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.ContactNumber);
        });

        // ── Doctors ───────────────────────────────────────────
        modelBuilder.Entity<Doctor>(e =>
        {
            e.ToTable("doctors");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            e.Property(x => x.Specialization).HasColumnName("specialization").HasMaxLength(100);
            e.Property(x => x.SlmcRegNo).HasColumnName("slmc_reg_no").HasMaxLength(30);
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(150);
            e.Property(x => x.Hospital).HasColumnName("hospital").HasMaxLength(150);
            e.Property(x => x.DiscountRate).HasColumnName("discount_rate").HasPrecision(5, 2).HasDefaultValue(0m);
            e.HasIndex(x => x.SlmcRegNo);
            e.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(20);
            e.Property(x => x.Address).HasColumnName("address");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
        });

        // ── Suppliers ─────────────────────────────────────────
        modelBuilder.Entity<Supplier>(e =>
        {
            e.ToTable("suppliers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            e.Property(x => x.Address).HasColumnName("address");
            e.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(20);
            e.Property(x => x.SpecialRemarks).HasColumnName("special_remarks");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
        });

        // ── Prescriptions ─────────────────────────────────────
        modelBuilder.Entity<Prescription>(e =>
        {
            e.ToTable("prescriptions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.CustomerId).HasColumnName("customer_id").IsRequired();
            e.Property(x => x.DoctorId).HasColumnName("doctor_id");
            e.Property(x => x.IssueDate).HasColumnName("issue_date").IsRequired();
            e.Property(x => x.DrugDetailsText).HasColumnName("drug_details_text");
            e.Property(x => x.ReproduceType).HasColumnName("reproduce_type")
                .HasMaxLength(20).IsRequired().HasConversion<string>();
            e.Property(x => x.ValidDays).HasColumnName("valid_days");
            e.Property(x => x.ValidMonths).HasColumnName("valid_months");
            e.Property(x => x.ScanFilePath).HasColumnName("scan_file_path").HasMaxLength(500);
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Customer).WithMany(c => c.Prescriptions).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Doctor).WithMany(d => d.Prescriptions).HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Invoices ──────────────────────────────────────────
        modelBuilder.Entity<Invoice>(e =>
        {
            e.ToTable("invoices");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.CustomerId).HasColumnName("customer_id");
            e.Property(x => x.DoctorId).HasColumnName("doctor_id");
            e.Property(x => x.PrescriptionId).HasColumnName("prescription_id");
            e.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(12, 2);
            e.Property(x => x.DiscountAmount).HasColumnName("discount_amount").HasPrecision(12, 2);
            e.Property(x => x.TaxRate).HasColumnName("tax_rate").HasPrecision(5, 2);
            e.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(12, 2);
            e.Property(x => x.TotalAmount).HasColumnName("total_amount").HasPrecision(12, 2);
            e.Property(x => x.PaymentMode).HasColumnName("payment_mode").HasMaxLength(10).HasConversion<string>();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(15).HasConversion<string>();
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
            e.Property(x => x.CancellationReason).HasColumnName("cancellation_reason");
            e.Property(x => x.ServedByUserId).HasColumnName("served_by_user_id");
            e.Property(x => x.VerifiedByUserId).HasColumnName("verified_by_user_id");
            e.Property(x => x.LoyaltyPointsEarned).HasColumnName("loyalty_points_earned").HasDefaultValue(0);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.InvoiceNumber).IsUnique();
            e.HasOne(x => x.Customer).WithMany(c => c.Invoices).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Doctor).WithMany(d => d.Invoices).HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Prescription).WithMany(p => p.Invoices).HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FrequencyCode>(e =>
        {
            e.ToTable("frequency_codes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Code).HasColumnName("code").HasMaxLength(20);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(100);
            e.Property(x => x.TimesPerDay).HasColumnName("times_per_day").HasPrecision(5, 2);
            e.Property(x => x.SortOrder).HasColumnName("sort_order");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<DrugBatch>(e =>
        {
            e.ToTable("drug_batches");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.BatchNumber).HasColumnName("batch_number").HasMaxLength(50);
            e.Property(x => x.ManufacturedDate).HasColumnName("manufactured_date");
            e.Property(x => x.ExpiryDate).HasColumnName("expiry_date");
            e.Property(x => x.QuantityReceived).HasColumnName("quantity_received");
            e.Property(x => x.QuantityRemaining).HasColumnName("quantity_remaining");
            e.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(10, 2);
            e.Property(x => x.SellingPrice).HasColumnName("selling_price").HasPrecision(10, 2);
            e.Property(x => x.PackSellingPrice).HasColumnName("pack_selling_price").HasPrecision(10, 2);
            e.Property(x => x.ReceivedAt).HasColumnName("received_at");
            e.Property(x => x.Source).HasColumnName("source").HasMaxLength(20);
            e.Property(x => x.GoodsReceiptItemId).HasColumnName("goods_receipt_item_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(x => x.Drug).WithMany(d => d.Batches).HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.DrugId, x.ReceivedAt });
        });

        modelBuilder.Entity<InvoiceItem>(e =>
        {
            e.ToTable("invoice_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.InvoiceId).HasColumnName("invoice_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.UnitPrice).HasColumnName("unit_price").HasPrecision(10, 2);
            e.Property(x => x.DiscountRate).HasColumnName("discount_rate").HasPrecision(5, 2);
            e.Property(x => x.DiscountAmount).HasColumnName("discount_amount").HasPrecision(10, 2);
            e.Property(x => x.LineTotal).HasColumnName("line_total").HasPrecision(12, 2);
            e.Property(x => x.DrugBatchId).HasColumnName("drug_batch_id");
            e.Property(x => x.SaleUnit).HasColumnName("sale_unit").HasMaxLength(10).HasDefaultValue("unit");
            e.Property(x => x.UnitsPerSaleUnit).HasColumnName("units_per_sale_unit").HasDefaultValue(1);
            e.Property(x => x.Dose).HasColumnName("dose").HasPrecision(8, 2);
            e.Property(x => x.FrequencyCode).HasColumnName("frequency_code").HasMaxLength(20);
            e.Property(x => x.Days).HasColumnName("days");
            e.Property(x => x.Directions).HasColumnName("directions").HasMaxLength(200);
            e.HasOne(x => x.Invoice).WithMany(i => i.Items).HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Purchase Orders ───────────────────────────────────
        modelBuilder.Entity<PurchaseOrder>(e =>
        {
            e.ToTable("purchase_orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.OrderNumber).HasColumnName("order_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.SupplierId).HasColumnName("supplier_id");
            e.Property(x => x.OrderDate).HasColumnName("order_date");
            e.Property(x => x.ExpectedDeliveryDate).HasColumnName("expected_delivery_date");
            e.Property(x => x.ReceivedDate).HasColumnName("received_date");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(25).HasConversion<string>();
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.OrderNumber).IsUnique();
            e.HasOne(x => x.Supplier).WithMany(s => s.PurchaseOrders).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PurchaseOrderItem>(e =>
        {
            e.ToTable("purchase_order_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.PurchaseOrderId).HasColumnName("purchase_order_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.QuantityOrdered).HasColumnName("quantity_ordered");
            e.Property(x => x.QuantityReceived).HasColumnName("quantity_received");
            e.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(10, 2);
            e.HasOne(x => x.PurchaseOrder).WithMany(po => po.Items).HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Goods Receipts ────────────────────────────────────
        modelBuilder.Entity<GoodsReceipt>(e =>
        {
            e.ToTable("goods_receipts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GrnNumber).HasColumnName("grn_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.PurchaseOrderId).HasColumnName("purchase_order_id");
            e.Property(x => x.SupplierId).HasColumnName("supplier_id");
            e.Property(x => x.ReceivedDate).HasColumnName("received_date");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.ReceivedByUserId).HasColumnName("received_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.GrnNumber).IsUnique();
            e.HasOne(x => x.PurchaseOrder).WithMany(po => po.GoodsReceipts).HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GoodsReceiptItem>(e =>
        {
            e.ToTable("goods_receipt_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.GoodsReceiptId).HasColumnName("goods_receipt_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.QuantityReceived).HasColumnName("quantity_received");
            e.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(10, 2);
            e.Property(x => x.IsFreeGoods).HasColumnName("is_free_goods");
            e.Property(x => x.BatchNumber).HasColumnName("batch_number").HasMaxLength(50);
            e.Property(x => x.ExpiryDate).HasColumnName("expiry_date");
            e.Property(x => x.SellingPrice).HasColumnName("selling_price").HasPrecision(10, 2);
            e.Property(x => x.PackSellingPrice).HasColumnName("pack_selling_price").HasPrecision(10, 2);
            e.Property(x => x.DrugBatchId).HasColumnName("drug_batch_id");
            e.HasOne(x => x.GoodsReceipt).WithMany(gr => gr.Items).HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Stock Movements ───────────────────────────────────
        modelBuilder.Entity<StockMovement>(e =>
        {
            e.ToTable("stock_movements");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.MovementType).HasColumnName("movement_type").HasMaxLength(20).HasConversion<string>();
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(10, 2);
            e.Property(x => x.ReferenceType).HasColumnName("reference_type").HasMaxLength(20).HasConversion<string>();
            e.Property(x => x.ReferenceId).HasColumnName("reference_id");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.PerformedByUserId).HasColumnName("performed_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.DrugId);
            e.HasIndex(x => x.CreatedAt);
            e.HasOne(x => x.Drug).WithMany(d => d.StockMovements).HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Stock Locations ───────────────────────────────────
        modelBuilder.Entity<StockLocation>(e =>
        {
            e.ToTable("stock_locations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
        });

        // ── Units of Measure ──────────────────────────────────
        modelBuilder.Entity<UnitOfMeasure>(e =>
        {
            e.ToTable("units_of_measure");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(50).IsRequired();
            e.Property(x => x.Abbreviation).HasColumnName("abbreviation").HasMaxLength(10);
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
        });

        // ── Price Adjustments ─────────────────────────────────
        modelBuilder.Entity<PriceAdjustment>(e =>
        {
            e.ToTable("price_adjustments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.OldPrice).HasColumnName("old_price").HasPrecision(10, 2);
            e.Property(x => x.NewPrice).HasColumnName("new_price").HasPrecision(10, 2);
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.AdjustedByUserId).HasColumnName("adjusted_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Drug).WithMany(d => d.PriceAdjustments).HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Purchase Requisitions ─────────────────────────────
        modelBuilder.Entity<PurchaseRequisition>(e =>
        {
            e.ToTable("purchase_requisitions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.RequisitionNumber).HasColumnName("requisition_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.QuantityRequested).HasColumnName("quantity_requested");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20);
            e.Property(x => x.RequestedByUserId).HasColumnName("requested_by_user_id");
            e.Property(x => x.ApprovedByUserId).HasColumnName("approved_by_user_id");
            e.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Purchase Invoices ─────────────────────────────────
        modelBuilder.Entity<PurchaseInvoice>(e =>
        {
            e.ToTable("purchase_invoices");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.InvoiceNumber).HasColumnName("invoice_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.SupplierId).HasColumnName("supplier_id");
            e.Property(x => x.GoodsReceiptId).HasColumnName("goods_receipt_id");
            e.Property(x => x.InvoiceDate).HasColumnName("invoice_date");
            e.Property(x => x.TotalAmount).HasColumnName("total_amount").HasPrecision(12, 2);
            e.Property(x => x.IsPaid).HasColumnName("is_paid");
            e.Property(x => x.PaidAt).HasColumnName("paid_at");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.GoodsReceipt).WithMany().HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Sales Returns ─────────────────────────────────────
        modelBuilder.Entity<SalesReturn>(e =>
        {
            e.ToTable("sales_returns");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ReturnNumber).HasColumnName("return_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.InvoiceId).HasColumnName("invoice_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.RefundAmount).HasColumnName("refund_amount").HasPrecision(12, 2);
            e.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(20).HasConversion<string>();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(10).HasConversion<string>();
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.ProcessedByUserId).HasColumnName("processed_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Stock Adjustments ─────────────────────────────────
        modelBuilder.Entity<StockAdjustment>(e =>
        {
            e.ToTable("stock_adjustments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.AdjustmentNumber).HasColumnName("adjustment_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.AdjustmentType).HasColumnName("adjustment_type").HasMaxLength(10).HasConversion<string>();
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.AdjustedByUserId).HasColumnName("adjusted_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Audit Logs ────────────────────────────────────────
        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(x => x.EntityType).HasColumnName("entity_type").HasMaxLength(50).IsRequired();
            e.Property(x => x.EntityId).HasColumnName("entity_id");
            e.Property(x => x.OldValue).HasColumnName("old_value").HasColumnType("nvarchar(max)");
            e.Property(x => x.NewValue).HasColumnName("new_value").HasColumnType("nvarchar(max)");
            e.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.Action);
            e.HasIndex(x => x.EntityType);
            e.HasIndex(x => x.CreatedAt);
        });

        // ── Outlets ───────────────────────────────────────────
        modelBuilder.Entity<Outlet>(e =>
        {
            e.ToTable("outlets");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            e.Property(x => x.Code).HasColumnName("code").HasMaxLength(20).IsRequired();
            e.Property(x => x.Address).HasColumnName("address");
            e.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(20);
            e.Property(x => x.ManagerName).HasColumnName("manager_name").HasMaxLength(100);
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.IsHeadOffice).HasColumnName("is_head_office");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<StockTransfer>(e =>
        {
            e.ToTable("stock_transfers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TransferNumber).HasColumnName("transfer_number").HasMaxLength(20).IsRequired();
            e.Property(x => x.FromOutletId).HasColumnName("from_outlet_id");
            e.Property(x => x.ToOutletId).HasColumnName("to_outlet_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.Notes).HasColumnName("notes");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(15).HasConversion<string>();
            e.Property(x => x.RequestedByUserId).HasColumnName("requested_by_user_id");
            e.Property(x => x.ApprovedByUserId).HasColumnName("approved_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasIndex(x => x.TransferNumber).IsUnique();
            e.HasOne(x => x.FromOutlet).WithMany(o => o.TransfersOut).HasForeignKey(x => x.FromOutletId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ToOutlet).WithMany(o => o.TransfersIn).HasForeignKey(x => x.ToOutletId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Supplier Returns ──────────────────────────────────
        modelBuilder.Entity<SupplierReturn>(e =>
        {
            e.ToTable("supplier_returns");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ReturnNumber).HasColumnName("return_number").HasMaxLength(50).IsRequired();
            e.Property(x => x.SupplierId).HasColumnName("supplier_id");
            e.Property(x => x.DrugId).HasColumnName("drug_id");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(10, 2);
            e.Property(x => x.Reason).HasColumnName("reason");
            e.Property(x => x.ProcessedByUserId).HasColumnName("processed_by_user_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
