namespace AltuVera.Pharmacy.Domain.Enums;

public enum UserType { Pharmacist, StockManager, PharmacyManager, SystemAdministrator }
public enum DosageForm { Syrup, Tablet, Capsule, Vial, Other }
public enum Gender { Male, Female, Other }
public enum ReproduceType { OneTime, Recurrent }
public enum PaymentMode { Cash, Card, Other }
public enum InvoiceStatus { Completed, Cancelled }
public enum PurchaseOrderStatus { Draft, Submitted, PartiallyReceived, Received, Cancelled }
public enum MovementType { Purchase, Sale, Adjustment, ReturnToSupplier, TransferIn, TransferOut }
public enum ReferenceType { Invoice, PurchaseOrder, GoodsReceipt, SupplierReturn, Manual }
public enum TransferStatus { Pending, Approved, InTransit, Received, Cancelled }
public enum AdjustmentType { Increase, Decrease }
public enum SalesReturnReason { Damaged, Expired, WrongItem, PatientRefusal, Other }
public enum SalesReturnStatus { Pending, Approved, Rejected }
