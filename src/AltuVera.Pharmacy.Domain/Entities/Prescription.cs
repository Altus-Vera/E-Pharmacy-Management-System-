using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class Prescription
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public int? DoctorId { get; set; }
    public DateOnly IssueDate { get; set; }
    public string? DrugDetailsText { get; set; }
    public ReproduceType ReproduceType { get; set; } = ReproduceType.OneTime;
    public int? ValidDays { get; set; }
    public int? ValidMonths { get; set; }
    public string? ScanFilePath { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public Doctor? Doctor { get; set; }
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<Invoice> Invoices { get; set; } = [];
}
