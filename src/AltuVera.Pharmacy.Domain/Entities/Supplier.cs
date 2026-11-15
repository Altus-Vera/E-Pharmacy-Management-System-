namespace AltuVera.Pharmacy.Domain.Entities;

public class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ContactNumber { get; set; }
    public string? SpecialRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore] public ICollection<Drug> Drugs { get; set; } = [];
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = [];
}
