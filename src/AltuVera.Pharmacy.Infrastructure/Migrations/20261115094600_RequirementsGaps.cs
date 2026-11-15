using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AltuVera.Pharmacy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RequirementsGaps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "loyalty_points_earned",
                table: "invoices",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "verified_by_user_id",
                table: "invoices",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "discount_rate",
                table: "doctors",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "doctors",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "hospital",
                table: "doctors",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "slmc_reg_no",
                table: "doctors",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_doctors_slmc_reg_no",
                table: "doctors",
                column: "slmc_reg_no");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_doctors_slmc_reg_no",
                table: "doctors");

            migrationBuilder.DropColumn(
                name: "loyalty_points_earned",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "verified_by_user_id",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "discount_rate",
                table: "doctors");

            migrationBuilder.DropColumn(
                name: "email",
                table: "doctors");

            migrationBuilder.DropColumn(
                name: "hospital",
                table: "doctors");

            migrationBuilder.DropColumn(
                name: "slmc_reg_no",
                table: "doctors");
        }
    }
}
