using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AltuVera.Pharmacy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BillPrescriptionQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillPrescriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InvoiceId = table.Column<int>(type: "int", nullable: false),
                    QueueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    QueueNumber = table.Column<int>(type: "int", nullable: false),
                    Files = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: true),
                    ShiftId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillPrescriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BillPrescriptions_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BillPrescriptions_InvoiceId",
                table: "BillPrescriptions",
                column: "InvoiceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillPrescriptions_QueueDate_QueueNumber",
                table: "BillPrescriptions",
                columns: new[] { "QueueDate", "QueueNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillPrescriptions");
        }
    }
}
