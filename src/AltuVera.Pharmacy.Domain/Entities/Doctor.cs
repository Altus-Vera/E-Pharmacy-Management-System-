namespace AltuVera.Pharmacy.Domain.Entities;

public class Doctor
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SlmcRegNo { get; set; }
    public string? Specialization { get; set; }
    public string? Email { get; set; }
    public string? Hospital { get; set; }
    public decimal DiscountRate { get; set; }
    public string? ContactNumber { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore] public ICollection<Prescription> Prescriptions { get; set; } = [];
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<Invoice> Invoices { get; set; } = [];
}
