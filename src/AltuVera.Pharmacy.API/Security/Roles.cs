namespace AltuVera.Pharmacy.API.Security;

/// <summary>Role groups from the System Requirements "User Classes" table.</summary>
public static class R
{
    public const string Pharmacist = "Pharmacist";
    public const string StockManager = "StockManager";
    public const string PharmacyManager = "PharmacyManager";
    public const string Admin = "SystemAdministrator";

    /// <summary>Dispensing, billing, customers, doctors, prescriptions.</summary>
    public const string Pos = "Pharmacist,PharmacyManager,SystemAdministrator";
    /// <summary>Inventory, suppliers, purchasing, stock reports.</summary>
    public const string Stock = "StockManager,PharmacyManager,SystemAdministrator";
    /// <summary>Price adjustments, discounts, approvals, auditing.</summary>
    public const string Manager = "PharmacyManager,SystemAdministrator";
    /// <summary>User management, setup, backups.</summary>
    public const string UserAdmin = "SystemAdministrator,PharmacyManager";
}
