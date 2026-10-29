"""
Seed script — run from backend/ directory:
    python seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from app.database import SessionLocal
from app.models.customer import Customer, Gender
from app.models.doctor import Doctor
from app.models.drug import Drug, DosageForm
from app.models.supplier import Supplier
from app.models.drug_category import DrugCategory

def seed():
    db = SessionLocal()
    try:
        # ── Categories ─────────────────────────────────────────────────────
        cats = {
            "Analgesics":       DrugCategory(name="Analgesics",       description="Pain relief medications"),
            "Cardiovascular":   DrugCategory(name="Cardiovascular",   description="Heart and blood pressure drugs"),
            "Antibiotics":      DrugCategory(name="Antibiotics",      description="Bacterial infection treatment"),
            "Diabetes":         DrugCategory(name="Diabetes",         description="Blood sugar management"),
            "Respiratory":      DrugCategory(name="Respiratory",      description="Asthma and COPD medications"),
            "Gastroenterology": DrugCategory(name="Gastroenterology", description="Digestive system drugs"),
            "Psychiatry":       DrugCategory(name="Psychiatry",       description="Mental health medications"),
            "Vitamins":         DrugCategory(name="Vitamins",         description="Vitamin and mineral supplements"),
        }
        for c in cats.values():
            db.add(c)
        db.flush()

        # ── Suppliers ──────────────────────────────────────────────────────
        sup1 = Supplier(
            name="MediPharm Lanka (Pvt) Ltd",
            contact_number="0112-345678",
            address="No. 45, Galle Road, Colombo 03",
        )
        sup2 = Supplier(
            name="National Pharma Distributors",
            contact_number="0112-987654",
            address="Industrial Zone, Ekala, Ja-Ela",
        )
        db.add_all([sup1, sup2])
        db.flush()

        # ── Doctors ────────────────────────────────────────────────────────
        doctors = [
            Doctor(name="Nimal Weerasinghe",   slmc_registration_number="SLMC-38419",
                   specialization="Consultant Cardiologist",   hospital="National Hospital Sri Lanka",
                   contact_number="0777-112233"),
            Doctor(name="Amali Fernando",       slmc_registration_number="SLMC-21304",
                   specialization="Consultant Physician",      hospital="Colombo General Hospital",
                   contact_number="0711-445566"),
            Doctor(name="Pradeep Jayawardena",  slmc_registration_number="SLMC-55670",
                   specialization="Consultant Diabetologist",  hospital="Lady Ridgeway Hospital",
                   contact_number="0777-667788"),
            Doctor(name="Sachini Mendis",       slmc_registration_number="SLMC-14892",
                   specialization="Respiratory Physician",     hospital="Chest Hospital Welisara",
                   contact_number="0714-990011"),
            Doctor(name="Ruwan Bandara",        slmc_registration_number="SLMC-72341",
                   specialization="General Practitioner",      hospital="Nawaloka Hospital",
                   contact_number="0765-223344"),
        ]
        db.add_all(doctors)
        db.flush()

        # ── Customers ──────────────────────────────────────────────────────
        customers = [
            Customer(
                name="Kavinda Bandara",
                contact_number="+94771214567",
                email="kavinda.b@email.com",
                address="No. 12, Kandy Road, Kelaniya",
                dob=date(1978, 3, 15),
                gender=Gender.male,
                loyalty_points=420,
                discount_rate=5.0,
                clinical_remarks="Penicillin Group Allergy • Regular Cardiac Patient",
            ),
            Customer(
                name="Samanthi Perera",
                contact_number="+94712345678",
                email="samanthi.p@gmail.com",
                address="45/B, High Level Road, Nugegoda",
                dob=date(1992, 7, 22),
                gender=Gender.female,
                loyalty_points=185,
                discount_rate=0.0,
                clinical_remarks="Sulfa drug allergy",
            ),
            Customer(
                name="Anura Dissanayake",
                contact_number="+94761122334",
                address="23, Temple Road, Kandy",
                dob=date(1955, 11, 8),
                gender=Gender.male,
                loyalty_points=860,
                discount_rate=10.0,
                clinical_remarks=None,
            ),
            Customer(
                name="Dilrukshi Rajapaksha",
                contact_number="+94714455667",
                email="dilrukshi.r@yahoo.com",
                address="7, Marine Drive, Galle",
                dob=date(1985, 5, 30),
                gender=Gender.female,
                loyalty_points=50,
                discount_rate=0.0,
                clinical_remarks="Aspirin intolerance",
            ),
            Customer(
                name="Chamara Gunaratne",
                contact_number="+94778899001",
                address="15, Pettah Market Road, Colombo 11",
                dob=date(1969, 9, 3),
                gender=Gender.male,
                loyalty_points=1200,
                discount_rate=7.5,
                clinical_remarks=None,
            ),
            Customer(
                name="Nimasha Wickramasinghe",
                contact_number="+94721234567",
                email="nimasha.w@hotmail.com",
                address="34, Rajagiriya Gardens, Rajagiriya",
                dob=date(2000, 2, 14),
                gender=Gender.female,
                loyalty_points=30,
                discount_rate=0.0,
                clinical_remarks=None,
            ),
        ]
        db.add_all(customers)
        db.flush()

        # ── Drugs ──────────────────────────────────────────────────────────
        drugs = [
            # Analgesics
            Drug(
                item_code="DRG-0001", brand_name="Panadol 500mg", generic_name="Paracetamol",
                active_ingredient="Paracetamol", strength="500mg", dosage_form=DosageForm.tablet,
                batch_number="BATCH-2026A", expiry_date=date(2026, 11, 30),
                unit_price=65.00, discount=0.0, quantity=540, reorder_level=50, low_stock_threshold=30,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Analgesics"].id, supplier_id=sup1.id,
                storage_requirements="Store below 30°C, away from moisture",
            ),
            Drug(
                item_code="DRG-0002", brand_name="Brufen 400mg", generic_name="Ibuprofen",
                active_ingredient="Ibuprofen", strength="400mg", dosage_form=DosageForm.tablet,
                batch_number="IBU-2026B", expiry_date=date(2027, 3, 31),
                unit_price=85.00, discount=0.0, quantity=380, reorder_level=40, low_stock_threshold=20,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Analgesics"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C",
            ),
            Drug(
                item_code="DRG-0003", brand_name="Voltaren 50mg", generic_name="Diclofenac Sodium",
                active_ingredient="Diclofenac Sodium", strength="50mg", dosage_form=DosageForm.tablet,
                batch_number="VOL-2025X", expiry_date=date(2025, 6, 30),  # expiring soon — warning
                unit_price=120.00, discount=5.0, quantity=12, reorder_level=30, low_stock_threshold=15,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Analgesics"].id, supplier_id=sup2.id,
                storage_requirements="Store below 30°C",
            ),

            # Cardiovascular
            Drug(
                item_code="DRG-0004", brand_name="Atorva 20mg", generic_name="Atorvastatin",
                active_ingredient="Atorvastatin Calcium", strength="20mg", dosage_form=DosageForm.tablet,
                batch_number="AT-2026X", expiry_date=date(2027, 8, 31),
                unit_price=385.00, discount=5.0, quantity=210, reorder_level=30, low_stock_threshold=15,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Cardiovascular"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C, protect from light",
            ),
            Drug(
                item_code="DRG-0005", brand_name="Tenormin 50mg", generic_name="Atenolol",
                active_ingredient="Atenolol", strength="50mg", dosage_form=DosageForm.tablet,
                batch_number="TEN-2026C", expiry_date=date(2028, 1, 31),
                unit_price=95.00, discount=0.0, quantity=330, reorder_level=40, low_stock_threshold=20,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Cardiovascular"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C",
            ),
            Drug(
                item_code="DRG-0006", brand_name="Warfarin 5mg", generic_name="Warfarin Sodium",
                active_ingredient="Warfarin Sodium", strength="5mg", dosage_form=DosageForm.tablet,
                batch_number="WAR-2026D", expiry_date=date(2027, 2, 28),
                unit_price=45.00, discount=0.0, quantity=890, reorder_level=100, low_stock_threshold=50,
                is_prescription_only=True, is_otc=False, is_high_alert=True, is_narcotic=False,
                category_id=cats["Cardiovascular"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C, protect from light and moisture",
            ),

            # Antibiotics
            Drug(
                item_code="DRG-0007", brand_name="Amoxil 500mg", generic_name="Amoxicillin",
                active_ingredient="Amoxicillin Trihydrate", strength="500mg", dosage_form=DosageForm.capsule,
                batch_number="AMX-2026E", expiry_date=date(2026, 9, 30),
                unit_price=55.00, discount=0.0, quantity=620, reorder_level=80, low_stock_threshold=40,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Antibiotics"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C",
            ),
            Drug(
                item_code="DRG-0008", brand_name="Augmentin 625mg", generic_name="Co-Amoxiclav",
                active_ingredient="Amoxicillin + Clavulanic Acid", strength="625mg", dosage_form=DosageForm.tablet,
                batch_number="AUG-2026F", expiry_date=date(2027, 5, 31),
                unit_price=175.00, discount=0.0, quantity=450, reorder_level=60, low_stock_threshold=30,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Antibiotics"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C",
            ),

            # Diabetes
            Drug(
                item_code="DRG-0009", brand_name="Mixtard 30/70 Penfill", generic_name="Insulin Biphasic",
                active_ingredient="Human Insulin Biphasic", strength="30/70 IU/mL", dosage_form=DosageForm.vial,
                batch_number="INS-4409", expiry_date=date(2027, 4, 30),
                unit_price=1450.00, discount=0.0, quantity=45, reorder_level=10, low_stock_threshold=5,
                is_prescription_only=True, is_otc=False, is_high_alert=True, is_narcotic=False,
                category_id=cats["Diabetes"].id, supplier_id=sup1.id,
                storage_requirements="Refrigerate 2-8°C, do not freeze. Discard 28 days after opening.",
            ),
            Drug(
                item_code="DRG-0010", brand_name="Glucophage 500mg", generic_name="Metformin HCl",
                active_ingredient="Metformin Hydrochloride", strength="500mg", dosage_form=DosageForm.tablet,
                batch_number="MET-2026G", expiry_date=date(2028, 3, 31),
                unit_price=22.00, discount=0.0, quantity=1200, reorder_level=150, low_stock_threshold=80,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Diabetes"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C",
            ),
            Drug(
                item_code="DRG-0011", brand_name="Lantus SoloStar", generic_name="Insulin Glargine",
                active_ingredient="Insulin Glargine", strength="100 IU/mL", dosage_form=DosageForm.vial,
                batch_number="LAN-2026H", expiry_date=date(2026, 12, 31),
                unit_price=4200.00, discount=0.0, quantity=18, reorder_level=5, low_stock_threshold=3,
                is_prescription_only=True, is_otc=False, is_high_alert=True, is_narcotic=False,
                category_id=cats["Diabetes"].id, supplier_id=sup1.id,
                storage_requirements="Refrigerate 2-8°C before opening. Store below 30°C after opening.",
            ),

            # Respiratory
            Drug(
                item_code="DRG-0012", brand_name="Ventolin Inhaler", generic_name="Salbutamol",
                active_ingredient="Salbutamol Sulphate", strength="100mcg/dose", dosage_form=DosageForm.other,
                batch_number="VEN-2026I", expiry_date=date(2027, 6, 30),
                unit_price=680.00, discount=0.0, quantity=95, reorder_level=20, low_stock_threshold=10,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Respiratory"].id, supplier_id=sup2.id,
                storage_requirements="Store below 30°C. Protect from direct sunlight and frost.",
            ),
            Drug(
                item_code="DRG-0013", brand_name="Seretide 250 Accuhaler", generic_name="Salmeterol + Fluticasone",
                active_ingredient="Salmeterol Xinafoate + Fluticasone Propionate", strength="250/50mcg", dosage_form=DosageForm.other,
                batch_number="SER-2026J", expiry_date=date(2027, 10, 31),
                unit_price=3200.00, discount=0.0, quantity=30, reorder_level=8, low_stock_threshold=4,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Respiratory"].id, supplier_id=sup1.id,
                storage_requirements="Store below 30°C",
            ),

            # Gastroenterology
            Drug(
                item_code="DRG-0014", brand_name="Nexium 20mg", generic_name="Esomeprazole",
                active_ingredient="Esomeprazole Magnesium", strength="20mg", dosage_form=DosageForm.capsule,
                batch_number="NEX-2026K", expiry_date=date(2028, 2, 28),
                unit_price=145.00, discount=0.0, quantity=760, reorder_level=60, low_stock_threshold=30,
                is_prescription_only=True, is_otc=False, is_high_alert=False, is_narcotic=False,
                category_id=cats["Gastroenterology"].id, supplier_id=sup2.id,
                storage_requirements="Store below 30°C",
            ),
            Drug(
                item_code="DRG-0015", brand_name="Perinorm 10mg", generic_name="Metoclopramide",
                active_ingredient="Metoclopramide HCl", strength="10mg", dosage_form=DosageForm.tablet,
                batch_number="PER-2026L", expiry_date=date(2027, 7, 31),
                unit_price=18.00, discount=0.0, quantity=900, reorder_level=100, low_stock_threshold=50,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Gastroenterology"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C, protect from light",
            ),

            # Psychiatry (narcotic / high alert)
            Drug(
                item_code="DRG-0016", brand_name="Morphine 10mg Injection", generic_name="Morphine Sulphate",
                active_ingredient="Morphine Sulphate", strength="10mg/mL", dosage_form=DosageForm.vial,
                batch_number="MOR-2026M", expiry_date=date(2027, 9, 30),
                unit_price=850.00, discount=0.0, quantity=60, reorder_level=15, low_stock_threshold=8,
                is_prescription_only=True, is_otc=False, is_high_alert=True, is_narcotic=True,
                category_id=cats["Psychiatry"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C, protect from light. Schedule I Narcotic.",
            ),

            # Vitamins / OTC
            Drug(
                item_code="DRG-0017", brand_name="Vitamin C 500mg", generic_name="Ascorbic Acid",
                active_ingredient="Ascorbic Acid", strength="500mg", dosage_form=DosageForm.tablet,
                batch_number="VTC-2026N", expiry_date=date(2028, 6, 30),
                unit_price=12.00, discount=0.0, quantity=3000, reorder_level=200, low_stock_threshold=100,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Vitamins"].id, supplier_id=sup1.id,
                storage_requirements="Store below 30°C, protect from moisture",
            ),
            Drug(
                item_code="DRG-0018", brand_name="Calci-D 500", generic_name="Calcium Carbonate + Vitamin D3",
                active_ingredient="Calcium Carbonate + Cholecalciferol", strength="500mg/200IU", dosage_form=DosageForm.tablet,
                batch_number="CAL-2026O", expiry_date=date(2028, 4, 30),
                unit_price=32.00, discount=0.0, quantity=1500, reorder_level=150, low_stock_threshold=75,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Vitamins"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C, away from direct sunlight",
            ),
            Drug(
                item_code="DRG-0019", brand_name="Piriton 4mg", generic_name="Chlorphenamine Maleate",
                active_ingredient="Chlorphenamine Maleate", strength="4mg", dosage_form=DosageForm.tablet,
                batch_number="PIR-2026P", expiry_date=date(2027, 1, 31),
                unit_price=8.00, discount=0.0, quantity=2200, reorder_level=200, low_stock_threshold=100,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Analgesics"].id, supplier_id=sup1.id,
                storage_requirements="Store below 25°C",
            ),
            Drug(
                item_code="DRG-0020", brand_name="Calpol Syrup", generic_name="Paracetamol Syrup",
                active_ingredient="Paracetamol", strength="120mg/5mL", dosage_form=DosageForm.syrup,
                batch_number="CAP-2026Q", expiry_date=date(2027, 11, 30),
                unit_price=195.00, discount=0.0, quantity=180, reorder_level=25, low_stock_threshold=12,
                is_prescription_only=False, is_otc=True, is_high_alert=False, is_narcotic=False,
                category_id=cats["Analgesics"].id, supplier_id=sup2.id,
                storage_requirements="Store below 25°C, keep upright",
            ),
        ]
        for d in drugs:
            db.add(d)

        db.commit()
        print(f"✓ {len(cats)} categories")
        print(f"✓ 2 suppliers")
        print(f"✓ {len(doctors)} doctors")
        print(f"✓ {len(customers)} customers")
        print(f"✓ {len(drugs)} drugs")
        print("\nSeed complete.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
