"""
Additive expansion seed — adds ~50 records per table (insert if not exists).
Run from backend/ directory:
    python seed_expand.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from sqlalchemy import text
from app.database import SessionLocal
from app.models.customer import Customer, Gender
from app.models.drug import Drug, DosageForm
from app.models.supplier import Supplier
from app.models.drug_category import DrugCategory


def upsert_category(db, name, description):
    obj = db.query(DrugCategory).filter_by(name=name).first()
    if not obj:
        obj = DrugCategory(name=name, description=description)
        db.add(obj)
        db.flush()
    return obj


def add_supplier_if_missing(db, name, contact, address):
    obj = db.query(Supplier).filter_by(name=name).first()
    if not obj:
        obj = Supplier(name=name, contact_number=contact, address=address)
        db.add(obj)
        db.flush()
    return obj


def add_doctor_if_missing(db, name, specialization="", contact_number=None, address=None, **_):
    row = db.execute(text("SELECT id FROM doctors WHERE name = :n"), {"n": name}).fetchone()
    if not row:
        db.execute(
            text("INSERT INTO doctors (name, specialization, contact_number, address, is_active) "
                 "VALUES (:name, :spec, :contact, :addr, 1)"),
            {"name": name, "spec": specialization, "contact": contact_number, "addr": address},
        )


def add_customer_if_missing(db, **kwargs):
    if not db.query(Customer).filter_by(contact_number=kwargs["contact_number"]).first():
        db.add(Customer(**kwargs))


def add_drug_if_missing(db, **kwargs):
    if not db.query(Drug).filter_by(item_code=kwargs["item_code"]).first():
        db.add(Drug(**kwargs))


def seed():
    db = SessionLocal()
    try:
        # ── Categories ─────────────────────────────────────────────────────
        cats = {
            "Analgesics":        upsert_category(db, "Analgesics",        "Pain relief medications"),
            "Cardiovascular":    upsert_category(db, "Cardiovascular",    "Heart and blood pressure drugs"),
            "Antibiotics":       upsert_category(db, "Antibiotics",       "Bacterial infection treatment"),
            "Diabetes":          upsert_category(db, "Diabetes",          "Blood sugar management"),
            "Respiratory":       upsert_category(db, "Respiratory",       "Asthma and COPD medications"),
            "Gastroenterology":  upsert_category(db, "Gastroenterology",  "Digestive system drugs"),
            "Psychiatry":        upsert_category(db, "Psychiatry",        "Mental health medications"),
            "Vitamins":          upsert_category(db, "Vitamins",          "Vitamin and mineral supplements"),
            "Dermatology":       upsert_category(db, "Dermatology",       "Skin and topical medications"),
            "Ophthalmology":     upsert_category(db, "Ophthalmology",     "Eye medications"),
            "Neurology":         upsert_category(db, "Neurology",         "Neurological medications"),
            "Oncology":          upsert_category(db, "Oncology",          "Cancer treatment drugs"),
        }

        # ── Suppliers ──────────────────────────────────────────────────────
        sup1 = add_supplier_if_missing(db, "MediPharm Lanka (Pvt) Ltd",      "0112-345678", "No. 45, Galle Road, Colombo 03")
        sup2 = add_supplier_if_missing(db, "National Pharma Distributors",   "0112-987654", "Industrial Zone, Ekala, Ja-Ela")
        sup3 = add_supplier_if_missing(db, "Hemas Pharmaceuticals (Pvt) Ltd","0112-430000", "No. 36, Bristol Street, Colombo 01")
        sup4 = add_supplier_if_missing(db, "CIC Holdings PLC",               "0112-434700", "199, Kew Road, Colombo 02")
        db.flush()

        # ── Doctors (add up to ~50 total) ──────────────────────────────────
        new_doctors = [
            dict(name="Kasun Ranasinghe",    slmc_registration_number="SLMC-11021", specialization="Consultant Neurologist",     hospital="National Hospital Sri Lanka",    contact_number="0771-001122"),
            dict(name="Sandya Alwis",         slmc_registration_number="SLMC-29834", specialization="Consultant Dermatologist",   hospital="Skin Diseases Hospital Colombo", contact_number="0712-334455"),
            dict(name="Thilina Gunawardena",  slmc_registration_number="SLMC-63412", specialization="Consultant Ophthalmologist", hospital="National Eye Hospital",          contact_number="0778-556677"),
            dict(name="Dilini Senanayake",    slmc_registration_number="SLMC-47892", specialization="Consultant Paediatrician",   hospital="Lady Ridgeway Hospital",         contact_number="0770-889900"),
            dict(name="Mahesh Kumarasinghe",  slmc_registration_number="SLMC-85634", specialization="Consultant Surgeon",         hospital="Colombo South Teaching Hospital",contact_number="0765-112233"),
            dict(name="Rashmi Wijesinghe",    slmc_registration_number="SLMC-30091", specialization="General Practitioner",       hospital="Lanka Hospitals",                contact_number="0714-445566"),
            dict(name="Chathuri Perera",      slmc_registration_number="SLMC-56234", specialization="Consultant Gynaecologist",   hospital="De Soysa Maternity Hospital",    contact_number="0777-778899"),
            dict(name="Lasith Jayasena",      slmc_registration_number="SLMC-91023", specialization="Consultant Orthopaedic",     hospital="Castle Street Hospital",         contact_number="0711-001100"),
            dict(name="Nadeesha Rathnayaka",  slmc_registration_number="SLMC-24501", specialization="Consultant Endocrinologist", hospital="National Hospital Sri Lanka",    contact_number="0712-223344"),
            dict(name="Vimukthi Herath",      slmc_registration_number="SLMC-78345", specialization="Consultant Oncologist",      hospital="Apeksha Hospital",               contact_number="0771-556677"),
            dict(name="Prabha Cooray",        slmc_registration_number="SLMC-15678", specialization="Consultant Psychiatrist",    hospital="National Institute of Mental Health", contact_number="0765-889900"),
            dict(name="Roshan De Silva",      slmc_registration_number="SLMC-44210", specialization="General Practitioner",       hospital="Nawaloka Hospital",              contact_number="0770-112233"),
            dict(name="Imalka Samaraweera",   slmc_registration_number="SLMC-67894", specialization="Consultant Nephrologist",    hospital="National Hospital Sri Lanka",    contact_number="0714-334455"),
            dict(name="Supun Madushanka",     slmc_registration_number="SLMC-32156", specialization="Consultant Gastroenterologist", hospital="Colombo General Hospital",    contact_number="0778-556600"),
            dict(name="Thanuja Wickrama",     slmc_registration_number="SLMC-89023", specialization="Consultant Allergist",       hospital="Teaching Hospital Kandy",        contact_number="0771-990011"),
            dict(name="Dinesh Amarasinghe",   slmc_registration_number="SLMC-50341", specialization="Consultant Urologist",       hospital="National Hospital Sri Lanka",    contact_number="0712-112200"),
            dict(name="Shiromi Athukorala",   slmc_registration_number="SLMC-71289", specialization="Consultant Radiologist",     hospital="Asiri Hospital",                 contact_number="0765-334411"),
            dict(name="Gayan Nanayakkara",    slmc_registration_number="SLMC-23890", specialization="General Practitioner",       hospital="Durdans Hospital",               contact_number="0714-556622"),
            dict(name="Priyanka Lokuge",      slmc_registration_number="SLMC-60127", specialization="Consultant Haematologist",   hospital="National Blood Transfusion Service", contact_number="0770-778833"),
            dict(name="Sanjaya Bandara",      slmc_registration_number="SLMC-38902", specialization="Consultant Rheumatologist",  hospital="Teaching Hospital Peradeniya",   contact_number="0778-990044"),
            dict(name="Upul Liyanage",        slmc_registration_number="SLMC-14023", specialization="General Practitioner",       hospital="Lanka Hospitals",                contact_number="0771-112255"),
            dict(name="Chamari Gunasekara",   slmc_registration_number="SLMC-55671", specialization="Consultant Immunologist",    hospital="National Hospital Sri Lanka",    contact_number="0712-334466"),
            dict(name="Nilanka Tissera",      slmc_registration_number="SLMC-80234", specialization="Consultant Pulmonologist",   hospital="Chest Hospital Welisara",        contact_number="0765-556677"),
            dict(name="Ruvini Dasanayake",    slmc_registration_number="SLMC-27890", specialization="General Practitioner",       hospital="Nawaloka Hospital",              contact_number="0714-778899"),
            dict(name="Thushara Wijeratne",   slmc_registration_number="SLMC-91234", specialization="Consultant Cardiologist",    hospital="Durdans Hospital",               contact_number="0777-000011"),
            dict(name="Amara Kulatunge",      slmc_registration_number="SLMC-43210", specialization="General Practitioner",       hospital="Asiri Central Hospital",         contact_number="0770-223344"),
            dict(name="Dilshan Fonseka",      slmc_registration_number="SLMC-66789", specialization="Consultant Infectious Disease", hospital="IDH Colombo",                contact_number="0712-445555"),
            dict(name="Sewwandi Rajapaksha",  slmc_registration_number="SLMC-19034", specialization="Consultant Neonatologist",   hospital="Lady Ridgeway Hospital",         contact_number="0765-667788"),
            dict(name="Buddhika Mendis",      slmc_registration_number="SLMC-74512", specialization="Consultant Hepatologist",    hospital="Teaching Hospital Kandy",        contact_number="0771-889900"),
            dict(name="Nadira Peiris",        slmc_registration_number="SLMC-30456", specialization="General Practitioner",       hospital="Colombo South Teaching Hospital",contact_number="0714-001122"),
            dict(name="Chaminda Vithanage",   slmc_registration_number="SLMC-58923", specialization="Consultant Vascular Surgeon", hospital="National Hospital Sri Lanka",  contact_number="0778-223344"),
            dict(name="Kushani Rodrigo",      slmc_registration_number="SLMC-82345", specialization="Consultant Rehabilitation",  hospital="Ragama Teaching Hospital",       contact_number="0770-445566"),
            dict(name="Priyantha Nandasiri",  slmc_registration_number="SLMC-15890", specialization="General Practitioner",       hospital="Negombo General Hospital",       contact_number="0712-667788"),
            dict(name="Anusha Kalutara",      slmc_registration_number="SLMC-47023", specialization="Consultant Paediatrician",   hospital="Teaching Hospital Galle",        contact_number="0771-889911"),
            dict(name="Sachith Perera",       slmc_registration_number="SLMC-63901", specialization="General Practitioner",       hospital="Kurunegala Teaching Hospital",   contact_number="0765-001133"),
            dict(name="Mangala Dissanayake",  slmc_registration_number="SLMC-29100", specialization="Consultant Orthopaedic",     hospital="National Hospital Sri Lanka",    contact_number="0714-223355"),
            dict(name="Thilaka Weerasekara",  slmc_registration_number="SLMC-71034", specialization="Consultant Anaesthesiologist", hospital="Colombo General Hospital",    contact_number="0778-445566"),
            dict(name="Ruvindu Jayarathna",   slmc_registration_number="SLMC-38200", specialization="General Practitioner",       hospital="Asiri Hospital",                 contact_number="0770-667788"),
            dict(name="Vindya Kumaratunga",   slmc_registration_number="SLMC-54678", specialization="Consultant Endocrinologist", hospital="Lanka Hospitals",                contact_number="0712-889900"),
            dict(name="Lasantha Meedeniya",   slmc_registration_number="SLMC-80901", specialization="Consultant Plastic Surgeon", hospital="National Hospital Sri Lanka",    contact_number="0771-001144"),
            dict(name="Sanduni Priyashantha", slmc_registration_number="SLMC-23412", specialization="General Practitioner",       hospital="Durdans Hospital",               contact_number="0765-223355"),
            dict(name="Kasun Wickramaratne",  slmc_registration_number="SLMC-67023", specialization="Consultant Neurosurgeon",    hospital="National Hospital Sri Lanka",    contact_number="0714-445566"),
            dict(name="Nilmini Gunathilake",  slmc_registration_number="SLMC-45789", specialization="Consultant Obstetrician",    hospital="De Soysa Maternity Hospital",    contact_number="0778-667788"),
            dict(name="Indunil Samarakoon",   slmc_registration_number="SLMC-91456", specialization="General Practitioner",       hospital="Nawaloka Hospital",              contact_number="0770-889911"),
        ]
        for d in new_doctors:
            add_doctor_if_missing(db, **d)
        db.flush()

        # ── Customers (add up to ~50 total) ────────────────────────────────
        new_customers = [
            dict(name="Thilanka Jayawardena",  contact_number="+94771334455", email="thilanka.j@gmail.com",  address="12, Dutugemunu St, Dehiwela",        dob=date(1983, 4, 10), gender=Gender.male,   loyalty_points=320, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Sewwandi Rathnayaka",   contact_number="+94712556677", email="sewwandi.r@email.com",  address="45, High Level Rd, Maharagama",      dob=date(1990, 8, 22), gender=Gender.female, loyalty_points=150, discount_rate=0.0,  clinical_remarks="Latex allergy"),
            dict(name="Pradeep Almeida",       contact_number="+94761778899", email=None,                    address="78, Sea View Rd, Moratuwa",           dob=date(1960, 1, 5),  gender=Gender.male,   loyalty_points=780, discount_rate=10.0, clinical_remarks=None),
            dict(name="Nadeesha Kumari",       contact_number="+94714990011", email="nadeesha.k@yahoo.com",  address="23, Flower Rd, Colombo 07",           dob=date(1995, 11, 18),gender=Gender.female, loyalty_points=60,  discount_rate=0.0,  clinical_remarks="NSAIDs allergy"),
            dict(name="Sachith Rodrigo",       contact_number="+94770112233", email=None,                    address="34, Temple Rd, Kotte",                dob=date(1972, 6, 30), gender=Gender.male,   loyalty_points=940, discount_rate=7.5,  clinical_remarks=None),
            dict(name="Imalka Perera",         contact_number="+94711223344", email="imalka.p@hotmail.com",  address="56, Railway Ave, Nugegoda",           dob=date(1988, 3, 14), gender=Gender.female, loyalty_points=200, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Ruwan Madusanka",       contact_number="+94765334455", email=None,                    address="89, Main St, Kalutara",               dob=date(1975, 9, 25), gender=Gender.male,   loyalty_points=430, discount_rate=5.0,  clinical_remarks="Penicillin allergy"),
            dict(name="Dinusha Wijesinghe",    contact_number="+94714445566", email="dinusha.w@gmail.com",   address="12, Bauddhaloka Mw, Colombo 07",      dob=date(1998, 2, 7),  gender=Gender.female, loyalty_points=85,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Kasun Niroshan",        contact_number="+94770556677", email=None,                    address="45, Nawala Rd, Rajagiriya",           dob=date(1965, 7, 19), gender=Gender.male,   loyalty_points=1100,discount_rate=10.0, clinical_remarks=None),
            dict(name="Piyumi Athukorala",     contact_number="+94712667788", email="piyumi.a@email.com",    address="23, Galle Rd, Dehiwela",              dob=date(1993, 5, 11), gender=Gender.female, loyalty_points=175, discount_rate=0.0,  clinical_remarks="Sulfa allergy"),
            dict(name="Vimukthi Peris",        contact_number="+94761778800", email=None,                    address="67, Pitakotte Rd, Kotte",             dob=date(1980, 12, 3), gender=Gender.male,   loyalty_points=560, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Rashmi Kulatunga",      contact_number="+94714889900", email="rashmi.k@gmail.com",    address="34, Baseline Rd, Colombo 09",         dob=date(1996, 8, 28), gender=Gender.female, loyalty_points=40,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Lasith Mendis",         contact_number="+94771000111", email=None,                    address="12, Laksiri Rd, Battaramulla",         dob=date(1958, 3, 17), gender=Gender.male,   loyalty_points=1500,discount_rate=15.0, clinical_remarks="Aspirin intolerance"),
            dict(name="Chamari Senadeera",     contact_number="+94711111222", email="chamari.s@yahoo.com",   address="45, Duplication Rd, Colombo 03",      dob=date(1991, 10, 9), gender=Gender.female, loyalty_points=270, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Priyanka Gunasena",     contact_number="+94765222333", email=None,                    address="78, Havelock Rd, Colombo 05",          dob=date(1977, 4, 23), gender=Gender.male,   loyalty_points=620, discount_rate=7.5,  clinical_remarks=None),
            dict(name="Nilanka Dias",          contact_number="+94714333444", email="nilanka.d@hotmail.com", address="23, Stratford Ave, Colombo 06",        dob=date(2001, 1, 15), gender=Gender.female, loyalty_points=25,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Thushara Herath",       contact_number="+94770444555", email=None,                    address="56, Colombo Rd, Kurunegala",           dob=date(1969, 7, 4),  gender=Gender.male,   loyalty_points=890, discount_rate=10.0, clinical_remarks=None),
            dict(name="Ruvini Alwis",          contact_number="+94712555666", email="ruvini.a@gmail.com",    address="12, Church Rd, Negombo",              dob=date(1986, 11, 20),gender=Gender.female, loyalty_points=130, discount_rate=0.0,  clinical_remarks="Iodine allergy"),
            dict(name="Buddhika Ratnayake",    contact_number="+94761666777", email=None,                    address="34, Peradeniya Rd, Kandy",             dob=date(1974, 2, 14), gender=Gender.male,   loyalty_points=750, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Sandya Wickramasinghe", contact_number="+94714777888", email="sandya.w@email.com",    address="78, Anagarika Dharmapala Mw, Galle",  dob=date(1999, 6, 8),  gender=Gender.female, loyalty_points=45,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Upul Dissanayake",      contact_number="+94771888999", email=None,                    address="45, Ampitiya Rd, Kandy",               dob=date(1963, 9, 29), gender=Gender.male,   loyalty_points=1300,discount_rate=12.5, clinical_remarks=None),
            dict(name="Dilrukshi Wijeratne",   contact_number="+94711999000", email="dilrukshi.w@gmail.com", address="23, Galle Face, Colombo 03",           dob=date(1994, 3, 7),  gender=Gender.female, loyalty_points=90,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Chaminda Fonseka",      contact_number="+94765000111", email=None,                    address="67, Nawala Rd, Nugegoda",              dob=date(1971, 8, 16), gender=Gender.male,   loyalty_points=680, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Kushani Jayasekara",    contact_number="+94714111222", email="kushani.j@yahoo.com",   address="12, Station Rd, Maharagama",           dob=date(1997, 5, 2),  gender=Gender.female, loyalty_points=55,  discount_rate=0.0,  clinical_remarks="Morphine sensitivity"),
            dict(name="Dinesh Pathirana",      contact_number="+94770222333", email=None,                    address="34, Hemas Rd, Wattala",                dob=date(1982, 12, 11),gender=Gender.male,   loyalty_points=410, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Sewwandi Cooray",       contact_number="+94712333444", email="sewwandi.c@hotmail.com",address="56, Old Rd, Kelaniya",                 dob=date(1989, 7, 25), gender=Gender.female, loyalty_points=200, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Lasantha Gunathilake",  contact_number="+94761444555", email=None,                    address="78, New Town Rd, Matara",              dob=date(1956, 4, 18), gender=Gender.male,   loyalty_points=2000,discount_rate=15.0, clinical_remarks="Beta-blocker sensitive"),
            dict(name="Vindya Peiris",         contact_number="+94714555666", email="vindya.p@gmail.com",    address="23, Lotus Rd, Colombo 01",             dob=date(2003, 10, 30),gender=Gender.female, loyalty_points=10,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Ruvindu Navaratne",     contact_number="+94771666777", email=None,                    address="45, Lake Rd, Boralesgamuwa",           dob=date(1976, 1, 9),  gender=Gender.male,   loyalty_points=550, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Thilaka Nanayakkara",   contact_number="+94711777888", email="thilaka.n@email.com",   address="12, Liberty Plaza, Colombo 03",        dob=date(1987, 6, 22), gender=Gender.female, loyalty_points=310, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Mahesh Perera",         contact_number="+94765888999", email=None,                    address="34, Independence Ave, Colombo 07",     dob=date(1961, 11, 5), gender=Gender.male,   loyalty_points=1700,discount_rate=10.0, clinical_remarks=None),
            dict(name="Amara Rodrigo",         contact_number="+94714999000", email="amara.r@yahoo.com",     address="67, Bauddhaloka Mw, Colombo 07",       dob=date(2000, 3, 19), gender=Gender.female, loyalty_points=70,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Gayan Silva",           contact_number="+94770001112", email=None,                    address="12, Sir James Peiris Mw, Colombo 02",  dob=date(1973, 8, 7),  gender=Gender.male,   loyalty_points=490, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Nilmini Rajakaruna",    contact_number="+94712112223", email="nilmini.r@gmail.com",   address="45, Dharmapala Mw, Colombo 07",        dob=date(1992, 2, 28), gender=Gender.female, loyalty_points=160, discount_rate=0.0,  clinical_remarks="ACE inhibitor cough"),
            dict(name="Supun Wijesekara",      contact_number="+94761223334", email=None,                    address="78, R.A. De Mel Mw, Colombo 04",       dob=date(1979, 9, 14), gender=Gender.male,   loyalty_points=870, discount_rate=7.5,  clinical_remarks=None),
            dict(name="Anusha Vithanage",      contact_number="+94714334445", email="anusha.v@hotmail.com",  address="23, Ward Place, Colombo 07",            dob=date(1995, 4, 1),  gender=Gender.female, loyalty_points=95,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Indunil Ranaweera",     contact_number="+94770445556", email=None,                    address="34, Horton Place, Colombo 07",          dob=date(1966, 7, 20), gender=Gender.male,   loyalty_points=1050,discount_rate=10.0, clinical_remarks=None),
            dict(name="Prabha Jayatilake",     contact_number="+94712556667", email="prabha.j@gmail.com",    address="56, Gregory's Rd, Colombo 07",          dob=date(1984, 12, 12),gender=Gender.female, loyalty_points=240, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Thilina Kumarasinghe",  contact_number="+94761667778", email=None,                    address="12, Reid Ave, Colombo 07",              dob=date(1970, 5, 31), gender=Gender.male,   loyalty_points=600, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Sachini Halangoda",     contact_number="+94714778889", email="sachini.h@email.com",   address="45, Maitland Pl, Colombo 07",           dob=date(1998, 10, 3), gender=Gender.female, loyalty_points=30,  discount_rate=0.0,  clinical_remarks=None),
            dict(name="Roshan Liyanagama",     contact_number="+94771889990", email=None,                    address="78, Queens Rd, Colombo 03",             dob=date(1957, 3, 26), gender=Gender.male,   loyalty_points=2300,discount_rate=15.0, clinical_remarks="Warfarin patient"),
            dict(name="Mangala Fernando",      contact_number="+94711990001", email="mangala.f@yahoo.com",   address="23, Layards Rd, Colombo 05",            dob=date(1991, 1, 8),  gender=Gender.female, loyalty_points=120, discount_rate=0.0,  clinical_remarks=None),
            dict(name="Dilshan Tennakoon",     contact_number="+94765001112", email=None,                    address="34, Dickman's Rd, Colombo 05",          dob=date(1978, 6, 17), gender=Gender.male,   loyalty_points=730, discount_rate=5.0,  clinical_remarks=None),
            dict(name="Roshani Mendis",        contact_number="+94714112223", email="roshani.m@hotmail.com", address="67, Alfred House Gdns, Colombo 03",     dob=date(2002, 9, 24), gender=Gender.female, loyalty_points=15,  discount_rate=0.0,  clinical_remarks=None),
        ]
        for c in new_customers:
            add_customer_if_missing(db, **c)
        db.flush()

        # ── Drugs (add up to ~50 total) ────────────────────────────────────
        new_drugs = [
            # Analgesics
            dict(item_code="DRG-0021", brand_name="Tramadol 50mg",        generic_name="Tramadol HCl",             active_ingredient="Tramadol Hydrochloride",   strength="50mg",         dosage_form=DosageForm.capsule, batch_number="TRM-2026A", expiry_date=date(2027, 5, 31),  unit_price=95.00,   discount=0.0, quantity=340,  reorder_level=40,  low_stock_threshold=20, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Analgesics"].id,       supplier_id=sup1.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0022", brand_name="Celebrex 200mg",       generic_name="Celecoxib",                active_ingredient="Celecoxib",                strength="200mg",        dosage_form=DosageForm.capsule, batch_number="CEL-2026B", expiry_date=date(2028, 2, 28),  unit_price=220.00,  discount=0.0, quantity=190,  reorder_level=25,  low_stock_threshold=12, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Analgesics"].id,       supplier_id=sup2.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0023", brand_name="Meftal 500mg",         generic_name="Mefenamic Acid",           active_ingredient="Mefenamic Acid",           strength="500mg",        dosage_form=DosageForm.tablet,  batch_number="MEF-2026C", expiry_date=date(2027, 8, 31),  unit_price=35.00,   discount=0.0, quantity=720,  reorder_level=80,  low_stock_threshold=40, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Analgesics"].id,       supplier_id=sup3.id, storage_requirements="Store below 30°C"),
            dict(item_code="DRG-0024", brand_name="Nurofen Cold & Flu",   generic_name="Ibuprofen + Pseudoephedrine", active_ingredient="Ibuprofen + Pseudoephedrine HCl", strength="200/30mg", dosage_form=DosageForm.tablet, batch_number="NUR-2026D", expiry_date=date(2027, 11, 30), unit_price=145.00,  discount=0.0, quantity=410,  reorder_level=50,  low_stock_threshold=25, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Analgesics"].id,       supplier_id=sup4.id, storage_requirements="Store below 30°C"),

            # Cardiovascular
            dict(item_code="DRG-0025", brand_name="Amlodipine 5mg",       generic_name="Amlodipine Besylate",      active_ingredient="Amlodipine Besylate",      strength="5mg",          dosage_form=DosageForm.tablet,  batch_number="AML-2026E", expiry_date=date(2028, 6, 30),  unit_price=28.00,   discount=0.0, quantity=980,  reorder_level=100, low_stock_threshold=50, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup1.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0026", brand_name="Lasix 40mg",           generic_name="Furosemide",               active_ingredient="Furosemide",               strength="40mg",         dosage_form=DosageForm.tablet,  batch_number="LAS-2026F", expiry_date=date(2027, 9, 30),  unit_price=15.00,   discount=0.0, quantity=1300, reorder_level=150, low_stock_threshold=75, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup2.id, storage_requirements="Store below 25°C, protect from light"),
            dict(item_code="DRG-0027", brand_name="Lisinopril 10mg",      generic_name="Lisinopril",               active_ingredient="Lisinopril",               strength="10mg",         dosage_form=DosageForm.tablet,  batch_number="LIS-2026G", expiry_date=date(2028, 4, 30),  unit_price=42.00,   discount=0.0, quantity=760,  reorder_level=80,  low_stock_threshold=40, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup3.id, storage_requirements="Store below 30°C"),
            dict(item_code="DRG-0028", brand_name="Digoxin 0.25mg",       generic_name="Digoxin",                  active_ingredient="Digoxin",                  strength="0.25mg",       dosage_form=DosageForm.tablet,  batch_number="DIG-2026H", expiry_date=date(2027, 12, 31), unit_price=25.00,   discount=0.0, quantity=550,  reorder_level=60,  low_stock_threshold=30, is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0029", brand_name="Aspirin Cardio 75mg",  generic_name="Aspirin",                  active_ingredient="Acetylsalicylic Acid",     strength="75mg",         dosage_form=DosageForm.tablet,  batch_number="ASP-2026I", expiry_date=date(2028, 8, 31),  unit_price=12.00,   discount=0.0, quantity=2000, reorder_level=200, low_stock_threshold=100,is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup1.id, storage_requirements="Store below 25°C, dry place"),
            dict(item_code="DRG-0030", brand_name="Clopidogrel 75mg",     generic_name="Clopidogrel",              active_ingredient="Clopidogrel Bisulphate",   strength="75mg",         dosage_form=DosageForm.tablet,  batch_number="CLO-2026J", expiry_date=date(2027, 7, 31),  unit_price=185.00,  discount=5.0, quantity=380,  reorder_level=40,  low_stock_threshold=20, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Cardiovascular"].id,   supplier_id=sup2.id, storage_requirements="Store below 30°C"),

            # Antibiotics
            dict(item_code="DRG-0031", brand_name="Ciprobay 500mg",       generic_name="Ciprofloxacin",            active_ingredient="Ciprofloxacin HCl",        strength="500mg",        dosage_form=DosageForm.tablet,  batch_number="CIP-2026K", expiry_date=date(2028, 1, 31),  unit_price=95.00,   discount=0.0, quantity=490,  reorder_level=60,  low_stock_threshold=30, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Antibiotics"].id,      supplier_id=sup3.id, storage_requirements="Store below 25°C, protect from light"),
            dict(item_code="DRG-0032", brand_name="Doxycycline 100mg",    generic_name="Doxycycline",              active_ingredient="Doxycycline Hyclate",      strength="100mg",        dosage_form=DosageForm.capsule, batch_number="DOX-2026L", expiry_date=date(2027, 6, 30),  unit_price=55.00,   discount=0.0, quantity=620,  reorder_level=70,  low_stock_threshold=35, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Antibiotics"].id,      supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from light and moisture"),
            dict(item_code="DRG-0033", brand_name="Flagyl 400mg",         generic_name="Metronidazole",            active_ingredient="Metronidazole",            strength="400mg",        dosage_form=DosageForm.tablet,  batch_number="FLA-2026M", expiry_date=date(2028, 3, 31),  unit_price=22.00,   discount=0.0, quantity=840,  reorder_level=90,  low_stock_threshold=45, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Antibiotics"].id,      supplier_id=sup1.id, storage_requirements="Store below 30°C, protect from light"),
            dict(item_code="DRG-0034", brand_name="Zinnat 500mg",         generic_name="Cefuroxime",               active_ingredient="Cefuroxime Axetil",        strength="500mg",        dosage_form=DosageForm.tablet,  batch_number="ZIN-2026N", expiry_date=date(2027, 10, 31), unit_price=265.00,  discount=0.0, quantity=280,  reorder_level=30,  low_stock_threshold=15, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Antibiotics"].id,      supplier_id=sup2.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0035", brand_name="Azithromycin 500mg",   generic_name="Azithromycin",             active_ingredient="Azithromycin Dihydrate",   strength="500mg",        dosage_form=DosageForm.tablet,  batch_number="AZI-2026O", expiry_date=date(2028, 5, 31),  unit_price=185.00,  discount=0.0, quantity=390,  reorder_level=45,  low_stock_threshold=22, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Antibiotics"].id,      supplier_id=sup3.id, storage_requirements="Store below 30°C"),

            # Diabetes
            dict(item_code="DRG-0036", brand_name="Januvia 100mg",        generic_name="Sitagliptin",              active_ingredient="Sitagliptin Phosphate",    strength="100mg",        dosage_form=DosageForm.tablet,  batch_number="JAN-2026P", expiry_date=date(2028, 7, 31),  unit_price=1850.00, discount=5.0, quantity=95,   reorder_level=15,  low_stock_threshold=8,  is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Diabetes"].id,         supplier_id=sup4.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0037", brand_name="Diamicron MR 60mg",    generic_name="Gliclazide",               active_ingredient="Gliclazide",               strength="60mg",         dosage_form=DosageForm.tablet,  batch_number="DIA-2026Q", expiry_date=date(2027, 11, 30), unit_price=145.00,  discount=0.0, quantity=420,  reorder_level=50,  low_stock_threshold=25, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Diabetes"].id,         supplier_id=sup1.id, storage_requirements="Store below 30°C"),
            dict(item_code="DRG-0038", brand_name="Jardiance 10mg",       generic_name="Empagliflozin",            active_ingredient="Empagliflozin",            strength="10mg",         dosage_form=DosageForm.tablet,  batch_number="JAR-2026R", expiry_date=date(2028, 9, 30),  unit_price=3200.00, discount=0.0, quantity=60,   reorder_level=10,  low_stock_threshold=5,  is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Diabetes"].id,         supplier_id=sup2.id, storage_requirements="Store below 30°C"),
            dict(item_code="DRG-0039", brand_name="NovoRapid FlexPen",    generic_name="Insulin Aspart",           active_ingredient="Insulin Aspart",           strength="100 IU/mL",    dosage_form=DosageForm.vial,    batch_number="NOR-2026S", expiry_date=date(2027, 3, 31),  unit_price=5500.00, discount=0.0, quantity=25,   reorder_level=6,   low_stock_threshold=3,  is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Diabetes"].id,         supplier_id=sup3.id, storage_requirements="Refrigerate 2-8°C before opening. Store below 30°C after opening."),

            # Respiratory
            dict(item_code="DRG-0040", brand_name="Spiriva 18mcg",        generic_name="Tiotropium",               active_ingredient="Tiotropium Bromide",       strength="18mcg",        dosage_form=DosageForm.other,   batch_number="SPI-2026T", expiry_date=date(2027, 8, 31),  unit_price=4800.00, discount=0.0, quantity=22,   reorder_level=5,   low_stock_threshold=3,  is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Respiratory"].id,      supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0041", brand_name="Montelast 10mg",       generic_name="Montelukast",              active_ingredient="Montelukast Sodium",       strength="10mg",         dosage_form=DosageForm.tablet,  batch_number="MON-2026U", expiry_date=date(2028, 2, 28),  unit_price=185.00,  discount=0.0, quantity=330,  reorder_level=40,  low_stock_threshold=20, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Respiratory"].id,      supplier_id=sup1.id, storage_requirements="Store below 25°C, protect from moisture and light"),
            dict(item_code="DRG-0042", brand_name="Prednisolone 5mg",     generic_name="Prednisolone",             active_ingredient="Prednisolone",             strength="5mg",          dosage_form=DosageForm.tablet,  batch_number="PRE-2026V", expiry_date=date(2027, 12, 31), unit_price=18.00,   discount=0.0, quantity=1100, reorder_level=120, low_stock_threshold=60, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Respiratory"].id,      supplier_id=sup2.id, storage_requirements="Store below 25°C"),

            # Gastroenterology
            dict(item_code="DRG-0043", brand_name="Losec 20mg",           generic_name="Omeprazole",               active_ingredient="Omeprazole",               strength="20mg",         dosage_form=DosageForm.capsule, batch_number="LOS-2026W", expiry_date=date(2028, 4, 30),  unit_price=85.00,   discount=0.0, quantity=880,  reorder_level=90,  low_stock_threshold=45, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Gastroenterology"].id, supplier_id=sup3.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0044", brand_name="Zantac 150mg",         generic_name="Ranitidine",               active_ingredient="Ranitidine HCl",           strength="150mg",        dosage_form=DosageForm.tablet,  batch_number="ZAN-2026X", expiry_date=date(2027, 6, 30),  unit_price=32.00,   discount=0.0, quantity=760,  reorder_level=80,  low_stock_threshold=40, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Gastroenterology"].id, supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from light"),
            dict(item_code="DRG-0045", brand_name="Loperamide 2mg",       generic_name="Loperamide HCl",           active_ingredient="Loperamide Hydrochloride", strength="2mg",          dosage_form=DosageForm.capsule, batch_number="LOP-2026Y", expiry_date=date(2028, 1, 31),  unit_price=22.00,   discount=0.0, quantity=940,  reorder_level=100, low_stock_threshold=50, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Gastroenterology"].id, supplier_id=sup1.id, storage_requirements="Store below 30°C"),
            dict(item_code="DRG-0046", brand_name="Duphalac Syrup",       generic_name="Lactulose",                active_ingredient="Lactulose",                strength="667mg/mL",     dosage_form=DosageForm.syrup,   batch_number="DUP-2026Z", expiry_date=date(2027, 9, 30),  unit_price=580.00,  discount=0.0, quantity=120,  reorder_level=15,  low_stock_threshold=8,  is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Gastroenterology"].id, supplier_id=sup2.id, storage_requirements="Store below 25°C"),

            # Neurology / Psychiatry
            dict(item_code="DRG-0047", brand_name="Epilim 200mg",         generic_name="Sodium Valproate",         active_ingredient="Sodium Valproate",         strength="200mg",        dosage_form=DosageForm.tablet,  batch_number="EPI-2026A2",expiry_date=date(2028, 3, 31),  unit_price=65.00,   discount=0.0, quantity=490,  reorder_level=55,  low_stock_threshold=28, is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Neurology"].id,        supplier_id=sup3.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0048", brand_name="Tegretol 200mg",       generic_name="Carbamazepine",            active_ingredient="Carbamazepine",            strength="200mg",        dosage_form=DosageForm.tablet,  batch_number="TEG-2026B2",expiry_date=date(2027, 11, 30), unit_price=45.00,   discount=0.0, quantity=620,  reorder_level=70,  low_stock_threshold=35, is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Neurology"].id,        supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from moisture and light"),
            dict(item_code="DRG-0049", brand_name="Zoloft 50mg",          generic_name="Sertraline",               active_ingredient="Sertraline HCl",           strength="50mg",         dosage_form=DosageForm.tablet,  batch_number="ZOL-2026C2",expiry_date=date(2028, 6, 30),  unit_price=285.00,  discount=0.0, quantity=310,  reorder_level=35,  low_stock_threshold=18, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Psychiatry"].id,       supplier_id=sup1.id, storage_requirements="Store below 25°C, protect from moisture"),
            dict(item_code="DRG-0050", brand_name="Lexapro 10mg",         generic_name="Escitalopram",             active_ingredient="Escitalopram Oxalate",     strength="10mg",         dosage_form=DosageForm.tablet,  batch_number="LEX-2026D2",expiry_date=date(2028, 8, 31),  unit_price=320.00,  discount=0.0, quantity=270,  reorder_level=30,  low_stock_threshold=15, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Psychiatry"].id,       supplier_id=sup2.id, storage_requirements="Store below 25°C"),

            # Vitamins / OTC
            dict(item_code="DRG-0051", brand_name="Zinc 10mg Tablet",     generic_name="Zinc Sulphate",            active_ingredient="Zinc Sulphate Monohydrate",strength="10mg",         dosage_form=DosageForm.tablet,  batch_number="ZNC-2026E2",expiry_date=date(2029, 1, 31),  unit_price=8.00,    discount=0.0, quantity=4000, reorder_level=300, low_stock_threshold=150,is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Vitamins"].id,         supplier_id=sup3.id, storage_requirements="Store below 30°C, protect from moisture"),
            dict(item_code="DRG-0052", brand_name="Folic Acid 5mg",       generic_name="Folic Acid",               active_ingredient="Folic Acid",               strength="5mg",          dosage_form=DosageForm.tablet,  batch_number="FOL-2026F2",expiry_date=date(2028, 11, 30), unit_price=5.00,    discount=0.0, quantity=5000, reorder_level=400, low_stock_threshold=200,is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Vitamins"].id,         supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from light"),
            dict(item_code="DRG-0053", brand_name="Vitamin B Complex",    generic_name="Vitamin B Complex",        active_ingredient="Thiamine + Riboflavin + Niacin + B6 + B12", strength="Multi", dosage_form=DosageForm.tablet, batch_number="VTB-2026G2", expiry_date=date(2028, 7, 31), unit_price=18.00,   discount=0.0, quantity=2500, reorder_level=200, low_stock_threshold=100,is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Vitamins"].id,         supplier_id=sup1.id, storage_requirements="Store below 30°C, protect from moisture"),
            dict(item_code="DRG-0054", brand_name="ORS Sachet",           generic_name="Oral Rehydration Salts",   active_ingredient="Glucose + NaCl + KCl + NaHCO3", strength="20.5g/sachet", dosage_form=DosageForm.other, batch_number="ORS-2026H2", expiry_date=date(2029, 3, 31), unit_price=25.00,   discount=0.0, quantity=1800, reorder_level=200, low_stock_threshold=100,is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Vitamins"].id,         supplier_id=sup2.id, storage_requirements="Store in a cool dry place"),

            # Dermatology
            dict(item_code="DRG-0055", brand_name="Betnovate Cream",      generic_name="Betamethasone Valerate",   active_ingredient="Betamethasone Valerate",   strength="0.1%",         dosage_form=DosageForm.other,   batch_number="BET-2026I2",expiry_date=date(2027, 10, 31), unit_price=185.00,  discount=0.0, quantity=240,  reorder_level=25,  low_stock_threshold=12, is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Dermatology"].id,      supplier_id=sup3.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0056", brand_name="Canesten Cream 1%",    generic_name="Clotrimazole",             active_ingredient="Clotrimazole",             strength="1%",           dosage_form=DosageForm.other,   batch_number="CAN-2026J2",expiry_date=date(2028, 4, 30),  unit_price=320.00,  discount=0.0, quantity=160,  reorder_level=20,  low_stock_threshold=10, is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Dermatology"].id,      supplier_id=sup4.id, storage_requirements="Store below 25°C"),
            dict(item_code="DRG-0057", brand_name="Acutane 20mg",         generic_name="Isotretinoin",             active_ingredient="Isotretinoin",             strength="20mg",         dosage_form=DosageForm.capsule, batch_number="ACU-2026K2",expiry_date=date(2027, 7, 31),  unit_price=1200.00, discount=0.0, quantity=80,   reorder_level=10,  low_stock_threshold=5,  is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Dermatology"].id,      supplier_id=sup1.id, storage_requirements="Store below 25°C, protect from light"),

            # Ophthalmology
            dict(item_code="DRG-0058", brand_name="Systane Ultra Eye Drops", generic_name="Propylene Glycol",      active_ingredient="Propylene Glycol + PEG 400", strength="0.4%/0.3%",  dosage_form=DosageForm.other,   batch_number="SYS-2026L2",expiry_date=date(2027, 5, 31),  unit_price=1850.00, discount=0.0, quantity=55,   reorder_level=8,   low_stock_threshold=4,  is_prescription_only=False, is_otc=True,  is_high_alert=False, is_narcotic=False, category_id=cats["Ophthalmology"].id,    supplier_id=sup2.id, storage_requirements="Store below 25°C, do not freeze"),
            dict(item_code="DRG-0059", brand_name="Xalatan Eye Drops",    generic_name="Latanoprost",              active_ingredient="Latanoprost",              strength="0.005%",       dosage_form=DosageForm.other,   batch_number="XAL-2026M2",expiry_date=date(2027, 2, 28),  unit_price=2800.00, discount=0.0, quantity=35,   reorder_level=5,   low_stock_threshold=3,  is_prescription_only=True,  is_otc=False, is_high_alert=False, is_narcotic=False, category_id=cats["Ophthalmology"].id,    supplier_id=sup3.id, storage_requirements="Refrigerate 2-8°C. After opening store below 25°C for up to 6 weeks."),

            # Oncology
            dict(item_code="DRG-0060", brand_name="Tamoxifen 20mg",       generic_name="Tamoxifen Citrate",        active_ingredient="Tamoxifen Citrate",        strength="20mg",         dosage_form=DosageForm.tablet,  batch_number="TAM-2026N2",expiry_date=date(2028, 10, 31), unit_price=95.00,   discount=0.0, quantity=480,  reorder_level=50,  low_stock_threshold=25, is_prescription_only=True,  is_otc=False, is_high_alert=True,  is_narcotic=False, category_id=cats["Oncology"].id,         supplier_id=sup4.id, storage_requirements="Store below 25°C, protect from moisture and light"),
        ]
        for d in new_drugs:
            add_drug_if_missing(db, **d)

        db.commit()

        doc_count  = db.execute(text("SELECT COUNT(*) FROM doctors")).scalar()
        cust_count = db.query(Customer).count()
        drug_count = db.query(Drug).count()
        print(f"✓ Doctors:   {doc_count}")
        print(f"✓ Customers: {cust_count}")
        print(f"✓ Drugs:     {drug_count}")
        print("\nExpansion seed complete.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
