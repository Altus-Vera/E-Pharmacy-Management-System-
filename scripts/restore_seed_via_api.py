"""
One-off, ADD-ONLY restore of the seed catalog into the current .NET API.

Reads the records defined in backend/seed_data.py and backend/seed_expand.py
(their database code is replaced by in-memory stubs, so they never touch SQL directly),
then creates each record through the API. A record is skipped if it already exists:
  categories / suppliers by name, doctors by SLMC number (or name), customers by phone, drugs by item code.
Nothing is ever updated or deleted.

Usage (API must be running):
    python scripts/restore_seed_via_api.py --dry-run
    python scripts/restore_seed_via_api.py
Credentials: --user / --password (an admin account), or env RESTORE_USER / RESTORE_PASSWORD.
"""
import argparse, enum, importlib, itertools, json, os, sys, types, urllib.request, urllib.error
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")

# ── in-memory stubs for the old SQLAlchemy app ────────────────────────────────
_ids = itertools.count(1)
REGISTRY = {}          # fake id -> record
COLLECTED = {"category": [], "supplier": [], "doctor": [], "customer": [], "drug": []}


class Rec:
    kind = "?"
    def __init__(self, **kw):
        self.__dict__.update(kw)
        self.id = None
        self._kw = kw

    def _register(self):
        if self.id is None:
            self.id = next(_ids)
            REGISTRY[self.id] = self
            COLLECTED[self.kind].append(self)


def make(kind):
    return type(kind.title(), (Rec,), {"kind": kind})


class Query:
    def __init__(self, *a): pass
    def filter_by(self, **k): return self
    def filter(self, *a): return self
    def first(self): return None
    def count(self): return 0
    def all(self): return []


class Result:
    def fetchone(self): return None
    def scalar(self): return 0
    def fetchall(self): return []


class FakeSession:
    def add(self, o): o._register()
    def add_all(self, objs): [o._register() for o in objs]
    def flush(self): pass
    def commit(self): pass
    def rollback(self): pass
    def close(self): pass
    def query(self, *a): return Query()
    def execute(self, *a, **k): return Result()


def install_stubs():
    def mod(name, **attrs):
        m = types.ModuleType(name); m.__dict__.update(attrs); sys.modules[name] = m; return m
    mod("app"); mod("app.models")
    mod("app.database", SessionLocal=lambda: FakeSession())
    Gender = enum.Enum("Gender", {"male": "male", "female": "female", "other": "other"})
    DosageForm = enum.Enum("DosageForm", {k: k for k in ["tablet", "capsule", "syrup", "vial", "other"]})
    mod("app.models.customer", Customer=make("customer"), Gender=Gender)
    mod("app.models.doctor", Doctor=make("doctor"))
    mod("app.models.drug", Drug=make("drug"), DosageForm=DosageForm)
    mod("app.models.supplier", Supplier=make("supplier"))
    mod("app.models.drug_category", DrugCategory=make("category"))
    try:
        import sqlalchemy  # noqa: F401
    except ImportError:
        mod("sqlalchemy", text=lambda s: s)


def collect():
    install_stubs()
    sys.path.insert(0, BACKEND)
    for name in ["seed_data", "seed_expand"]:
        m = importlib.import_module(name)
        if hasattr(m, "add_doctor_if_missing"):
            # the original wrote raw SQL and dropped the SLMC number; keep every field instead
            m.add_doctor_if_missing = lambda db, **d: sys.modules["app.models.doctor"].Doctor(**d)._register()
        m.seed()


# ── API client ────────────────────────────────────────────────────────────────
class Api:
    def __init__(self, base, token=None):
        self.base, self.token = base.rstrip("/"), token

    def call(self, method, path, body=None):
        data = json.dumps(body, default=str).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token: req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode(errors='replace')[:300]}")


def v(x):
    if isinstance(x, enum.Enum): return x.value
    if isinstance(x, date): return x.isoformat()
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000/api")
    ap.add_argument("--user", default=os.environ.get("RESTORE_USER"))
    ap.add_argument("--password", default=os.environ.get("RESTORE_PASSWORD"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    collect()
    # de-duplicate within the seed files themselves
    def uniq(items, key):
        seen, out = set(), []
        for it in items:
            k = key(it)
            if k and k not in seen: seen.add(k); out.append(it)
        return out
    cats = uniq(COLLECTED["category"], lambda r: r.name.strip().lower())
    sups = uniq(COLLECTED["supplier"], lambda r: r.name.strip().lower())
    docs = uniq(COLLECTED["doctor"], lambda r: (getattr(r, "slmc_registration_number", None) or r.name).strip().lower())
    custs = uniq(COLLECTED["customer"], lambda r: (r.contact_number or "").strip())
    drugs = uniq(COLLECTED["drug"], lambda r: r.item_code.strip().upper())
    print(f"In seed files: {len(cats)} categories, {len(sups)} suppliers, {len(docs)} doctors, {len(custs)} customers, {len(drugs)} drugs")
    if a.dry_run:
        return

    if not a.user or not a.password:
        sys.exit("Provide --user and --password (admin) or RESTORE_USER / RESTORE_PASSWORD.")
    api = Api(a.api)
    api.token = api.call("POST", "/auth/login", {"username": a.user, "password": a.password})["access_token"]

    stats = {k: [0, 0, 0] for k in ["categories", "suppliers", "doctors", "customers", "drugs"]}  # added, skipped, failed
    def run(kind, fn):
        try:
            stats[kind][0 if fn() else 1] += 1
        except Exception as e:
            stats[kind][2] += 1
            print(f"  ! {kind}: {e}")

    # categories
    existing = {c["name"].strip().lower(): c["id"] for c in api.call("GET", "/drug-categories")}
    cat_id = {}
    for c in cats:
        def f(c=c):
            k = c.name.strip().lower()
            if k in existing: cat_id[c.id] = existing[k]; return False
            new = api.call("POST", "/drug-categories", {"name": c.name, "description": getattr(c, "description", None)})
            existing[k] = cat_id[c.id] = new["id"]; return True
        run("categories", f)
    # duplicates in seed map to the surviving one
    for c in COLLECTED["category"]:
        cat_id.setdefault(c.id, existing.get(c.name.strip().lower()))

    # suppliers
    existing = {s["name"].strip().lower(): s["id"] for s in api.call("GET", "/suppliers")}
    sup_id = {}
    for s in sups:
        def f(s=s):
            k = s.name.strip().lower()
            if k in existing: sup_id[s.id] = existing[k]; return False
            new = api.call("POST", "/suppliers", {"name": s.name, "address": getattr(s, "address", None),
                                                  "contact_number": getattr(s, "contact_number", None),
                                                  "special_remarks": getattr(s, "special_remarks", None)})
            existing[k] = sup_id[s.id] = new["id"]; return True
        run("suppliers", f)
    for s in COLLECTED["supplier"]:
        sup_id.setdefault(s.id, existing.get(s.name.strip().lower()))

    # doctors
    have = api.call("GET", "/doctors")
    slmcs = {(d.get("slmc_reg_no") or "").strip().upper() for d in have}
    names = {d["name"].strip().lower() for d in have}
    for d in docs:
        def f(d=d):
            slmc = (getattr(d, "slmc_registration_number", None) or "").strip()
            if (slmc and slmc.upper() in slmcs) or d.name.strip().lower() in names: return False
            if not slmc:
                raise RuntimeError(f"Dr. {d.name} has no SLMC number in the seed file - add manually")
            api.call("POST", "/doctors", {"name": d.name, "slmc_reg_no": slmc,
                                          "specialization": getattr(d, "specialization", None),
                                          "contact_number": getattr(d, "contact_number", None),
                                          "address": getattr(d, "address", None),
                                          "email": getattr(d, "email", None),
                                          "hospital": getattr(d, "hospital", None)})
            slmcs.add(slmc.upper()); names.add(d.name.strip().lower()); return True
        run("doctors", f)

    # customers
    phones = {(c.get("contact_number") or "").strip() for c in api.call("GET", "/customers")}
    for c in custs:
        def f(c=c):
            ph = (c.contact_number or "").strip()
            if ph in phones: return False
            api.call("POST", "/customers", {"name": c.name, "contact_number": ph,
                                            "email": getattr(c, "email", None), "address": getattr(c, "address", None),
                                            "dob": v(getattr(c, "dob", None)), "gender": v(getattr(c, "gender", None)),
                                            "clinical_remarks": getattr(c, "clinical_remarks", None),
                                            "discount_rate": float(getattr(c, "discount_rate", 0) or 0)})
            phones.add(ph); return True
        run("customers", f)

    # drugs
    codes = {d["item_code"].strip().upper() for d in api.call("GET", "/drugs")}
    for d in drugs:
        def f(d=d):
            code = d.item_code.strip().upper()
            if code in codes: return False
            g = lambda k, default=None: v(getattr(d, k, default))
            api.call("POST", "/drugs", {
                "item_code": d.item_code, "brand_name": d.brand_name, "generic_name": d.generic_name,
                "active_ingredient": g("active_ingredient"), "description": g("description"), "strength": g("strength"),
                "dosage_form": g("dosage_form", "other"), "storage_requirements": g("storage_requirements"),
                "batch_number": g("batch_number"), "manufactured_date": g("manufactured_date"), "expiry_date": g("expiry_date"),
                "unit_price": float(g("unit_price", 0) or 0), "discount": float(g("discount", 0) or 0),
                "quantity": int(g("quantity", 0) or 0), "pack_size": g("pack_size"),
                "low_stock_threshold": int(g("low_stock_threshold", 10) or 10), "reorder_level": int(g("reorder_level", 20) or 20),
                "is_prescription_only": bool(g("is_prescription_only", False)), "is_otc": bool(g("is_otc", False)),
                "is_high_alert": bool(g("is_high_alert", False)), "is_narcotic": bool(g("is_narcotic", False)),
                "is_active": True,
                "category_id": cat_id.get(getattr(d, "category_id", None)),
                "supplier_id": sup_id.get(getattr(d, "supplier_id", None)),
            })
            codes.add(code); return True
        run("drugs", f)

    print("\nResult (added / skipped as already present / failed):")
    for k, (ad, sk, fa) in stats.items():
        print(f"  {k:<11} {ad:>4} added  {sk:>4} skipped  {fa:>3} failed")


if __name__ == "__main__":
    main()
