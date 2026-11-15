using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class Outlet
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactNumber { get; set; }
    public string? ManagerName { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsHeadOffice { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore] public ICollection<StockTransfer> TransfersOut { get; set; } = [];
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<StockTransfer> TransfersIn { get; set; } = [];
}

public class StockTransfer
{
    public int Id { get; set; }
    public string TransferNumber { get; set; } = string.Empty;
    public int FromOutletId { get; set; }
    public int ToOutletId { get; set; }
    public int DrugId { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
    public TransferStatus Status { get; set; } = TransferStatus.Pending;
    public int? RequestedByUserId { get; set; }
    public int? ApprovedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Outlet FromOutlet { get; set; } = null!;
    public Outlet ToOutlet { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
}
