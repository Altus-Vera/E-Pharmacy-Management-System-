namespace AltuVera.Pharmacy.Domain.Entities;

/// <summary>
/// Optional copy of the paper prescription kept with a POS bill. Each one gets the next number in
/// the day's queue (1, 2, 3… restarting every day) so the paper copies can be filed in bill order.
/// </summary>
public class BillPrescription
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public DateOnly QueueDate { get; set; }
    public int QueueNumber { get; set; }
    /// <summary>Stored file names (under uploads/bill-rx), separated by '|'.</summary>
    public string Files { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int? UploadedByUserId { get; set; }
    public int? ShiftId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
}
