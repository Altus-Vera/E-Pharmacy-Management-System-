using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class StockMovement
{
    public int Id { get; set; }
    public int DrugId { get; set; }
    public MovementType MovementType { get; set; }
    public int Quantity { get; set; }
    public decimal? UnitCost { get; set; }
    public ReferenceType ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public string? Notes { get; set; }
    public int? PerformedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Drug Drug { get; set; } = null!;
}
