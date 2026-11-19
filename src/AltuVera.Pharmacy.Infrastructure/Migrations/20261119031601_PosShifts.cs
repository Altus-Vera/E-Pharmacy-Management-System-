using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AltuVera.Pharmacy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PosShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ShiftId",
                table: "sales_returns",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftId",
                table: "invoices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Shifts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShiftNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Terminal = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OpeningCash = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OpeningNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ClosedByUserId = table.Column<int>(type: "int", nullable: true),
                    CountedCash = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ClosingNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SalesCount = table.Column<int>(type: "int", nullable: false),
                    GrossSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NetSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CashSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CardSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OtherSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    VoidCount = table.Column<int>(type: "int", nullable: false),
                    VoidTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReturnCount = table.Column<int>(type: "int", nullable: false),
                    ReturnTotal = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ItemsSold = table.Column<int>(type: "int", nullable: false),
                    ExpectedCash = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CashDifference = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shifts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Shifts_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sales_returns_ShiftId",
                table: "sales_returns",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_ShiftId",
                table: "invoices",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_Shifts_ShiftNumber",
                table: "Shifts",
                column: "ShiftNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shifts_UserId_Status",
                table: "Shifts",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_invoices_Shifts_ShiftId",
                table: "invoices",
                column: "ShiftId",
                principalTable: "Shifts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_sales_returns_Shifts_ShiftId",
                table: "sales_returns",
                column: "ShiftId",
                principalTable: "Shifts",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_invoices_Shifts_ShiftId",
                table: "invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_sales_returns_Shifts_ShiftId",
                table: "sales_returns");

            migrationBuilder.DropTable(
                name: "Shifts");

            migrationBuilder.DropIndex(
                name: "IX_sales_returns_ShiftId",
                table: "sales_returns");

            migrationBuilder.DropIndex(
                name: "IX_invoices_ShiftId",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "ShiftId",
                table: "sales_returns");

            migrationBuilder.DropColumn(
                name: "ShiftId",
                table: "invoices");
        }
    }
}
