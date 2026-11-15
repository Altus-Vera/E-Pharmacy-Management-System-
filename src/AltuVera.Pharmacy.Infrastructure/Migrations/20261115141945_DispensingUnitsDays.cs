using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AltuVera.Pharmacy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DispensingUnitsDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "days",
                table: "invoice_items",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "directions",
                table: "invoice_items",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "dose",
                table: "invoice_items",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "frequency_code",
                table: "invoice_items",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sale_unit",
                table: "invoice_items",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "unit");

            migrationBuilder.AddColumn<int>(
                name: "units_per_sale_unit",
                table: "invoice_items",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<decimal>(
                name: "pack_selling_price",
                table: "goods_receipt_items",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "base_unit",
                table: "drugs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unit");

            migrationBuilder.AddColumn<decimal>(
                name: "content_per_unit",
                table: "drugs",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "default_dose",
                table: "drugs",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "default_frequency",
                table: "drugs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "dose_unit",
                table: "drugs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "max_days",
                table: "drugs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "min_days",
                table: "drugs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "min_loose_qty",
                table: "drugs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "non_loose_reason",
                table: "drugs",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sell_mode",
                table: "drugs",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "loose");

            migrationBuilder.AddColumn<int>(
                name: "units_per_strip",
                table: "drugs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "pack_selling_price",
                table: "drug_batches",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "frequency_codes",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    description = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    times_per_day = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_frequency_codes", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_frequency_codes_code",
                table: "frequency_codes",
                column: "code",
                unique: true);
        
            // Standard dose codes (insert-only)
            migrationBuilder.Sql(@"
INSERT INTO frequency_codes (code, description, times_per_day, sort_order, is_active, created_at, updated_at)
SELECT v.code, v.description, v.tpd, v.sort_order, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (VALUES
('OD', 'Once a day', 1, 10),
('BD', 'Twice a day', 2, 20),
('TDS', 'Three times a day', 3, 30),
('QDS', 'Four times a day', 4, 40),
('MANE', 'Every morning', 1, 50),
('NOCTE', 'At night', 1, 60),
('1-0-0', 'Every morning', 1, 70),
('0-0-1', 'At night', 1, 80),
('1-0-1', 'Morning and night', 2, 90),
('1-1-1', 'Morning, noon and night', 3, 100),
('Q6H', 'Every 6 hours', 4, 110),
('Q8H', 'Every 8 hours', 3, 120),
('WEEKLY', 'Once a week', NULL, 130),
('SOS', 'When needed', NULL, 140)
) AS v(code, description, tpd, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM frequency_codes f WHERE f.code = v.code);
UPDATE frequency_codes SET times_per_day = 0.14 WHERE code = 'WEEKLY' AND times_per_day IS NULL;");

            // Starting selling rules for existing drugs — fills only the new columns
            migrationBuilder.Sql(@"
UPDATE drugs SET base_unit = 'tablet',  sell_mode = 'loose' WHERE dosage_form = 'Tablet'  AND base_unit = 'unit';
UPDATE drugs SET base_unit = 'capsule', sell_mode = 'loose' WHERE dosage_form = 'Capsule' AND base_unit = 'unit';
UPDATE drugs SET base_unit = 'bottle',  sell_mode = 'pack', dose_unit = 'ml', non_loose_reason = 'Sealed bottle'
       WHERE dosage_form = 'Syrup' AND base_unit = 'unit';
UPDATE drugs SET base_unit = 'vial',    sell_mode = 'pack', non_loose_reason = 'Sealed vial / pen'
       WHERE dosage_form = 'Vial' AND base_unit = 'unit';
UPDATE drugs SET sell_mode = 'pack', non_loose_reason = 'Sold as a whole item'
       WHERE dosage_form = 'Other' AND base_unit = 'unit' AND non_loose_reason IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "frequency_codes");

            migrationBuilder.DropColumn(
                name: "days",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "directions",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "dose",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "frequency_code",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "sale_unit",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "units_per_sale_unit",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "pack_selling_price",
                table: "goods_receipt_items");

            migrationBuilder.DropColumn(
                name: "base_unit",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "content_per_unit",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "default_dose",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "default_frequency",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "dose_unit",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "max_days",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "min_days",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "min_loose_qty",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "non_loose_reason",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "sell_mode",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "units_per_strip",
                table: "drugs");

            migrationBuilder.DropColumn(
                name: "pack_selling_price",
                table: "drug_batches");
        }
    }
}
