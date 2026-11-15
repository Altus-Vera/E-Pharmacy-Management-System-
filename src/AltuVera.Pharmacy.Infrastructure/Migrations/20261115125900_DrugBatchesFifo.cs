using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AltuVera.Pharmacy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DrugBatchesFifo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "drug_batch_id",
                table: "invoice_items",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "batch_number",
                table: "goods_receipt_items",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "drug_batch_id",
                table: "goods_receipt_items",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "expiry_date",
                table: "goods_receipt_items",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "selling_price",
                table: "goods_receipt_items",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "drug_batches",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    drug_id = table.Column<int>(type: "int", nullable: false),
                    batch_number = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    manufactured_date = table.Column<DateOnly>(type: "date", nullable: true),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    quantity_received = table.Column<int>(type: "int", nullable: false),
                    quantity_remaining = table.Column<int>(type: "int", nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    selling_price = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    received_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    goods_receipt_item_id = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_drug_batches", x => x.id);
                    table.ForeignKey(
                        name: "FK_drug_batches_drugs_drug_id",
                        column: x => x.drug_id,
                        principalTable: "drugs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_drug_batches_drug_id_received_at",
                table: "drug_batches",
                columns: new[] { "drug_id", "received_at" });
        
            // Existing stock becomes one "Opening" batch per drug (insert-only, skips drugs that already have batches)
            migrationBuilder.Sql(@"
INSERT INTO drug_batches (drug_id, batch_number, manufactured_date, expiry_date, quantity_received, quantity_remaining,
                          unit_cost, selling_price, received_at, source, goods_receipt_item_id, created_at, updated_at)
SELECT d.id, d.batch_number, d.manufactured_date, d.expiry_date, d.quantity, d.quantity,
       NULL, d.unit_price, d.created_at, 'Opening', NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM drugs d
WHERE d.quantity > 0 AND NOT EXISTS (SELECT 1 FROM drug_batches b WHERE b.drug_id = d.id);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "drug_batches");

            migrationBuilder.DropColumn(
                name: "drug_batch_id",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "batch_number",
                table: "goods_receipt_items");

            migrationBuilder.DropColumn(
                name: "drug_batch_id",
                table: "goods_receipt_items");

            migrationBuilder.DropColumn(
                name: "expiry_date",
                table: "goods_receipt_items");

            migrationBuilder.DropColumn(
                name: "selling_price",
                table: "goods_receipt_items");
        }
    }
}
