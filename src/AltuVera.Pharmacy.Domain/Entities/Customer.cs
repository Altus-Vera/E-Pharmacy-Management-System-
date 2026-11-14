using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public DateOnly? Dob { get; set; }
    public Gender? Gender { get; set; }
    public decimal LoyaltyPoints { get; set; }
    public decimal DiscountRate { get; set; }
    public string? ClinicalRemarks { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<Prescription> Prescriptions { get; set; } = [];
    public ICollection<Invoice> Invoices { get; set; } = [];
}
