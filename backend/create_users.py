"""
Safe user creation script — skips any username that already exists.
Run from backend/ directory:
    python create_users.py

Existing data is NEVER touched.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.user import User, UserType
from app.utils.password_utils import hash_password

USERS = [
    dict(name="System Administrator", nic="199012345678", user_type=UserType.system_administrator,
         username="admin",    password="Admin@123",      contact_number="0771234567"),
    dict(name="Pharmacist One",       nic="199112345678", user_type=UserType.pharmacist,
         username="pharmacist", password="Pharm@123",    contact_number="0772345678"),
    dict(name="Stock Manager",        nic="199212345678", user_type=UserType.stock_manager,
         username="stockmgr",  password="Stock@123",     contact_number="0773456789"),
    dict(name="Pharmacy Manager",     nic="199312345678", user_type=UserType.pharmacy_manager,
         username="manager",   password="Manager@123",   contact_number="0774567890"),
]

def run():
    db = SessionLocal()
    try:
        created = 0
        for u in USERS:
            exists = db.query(User).filter(User.username == u["username"]).first()
            if exists:
                print(f"  skip  {u['username']}  (already exists)")
                continue
            db.add(User(
                name=u["name"],
                nic=u["nic"],
                user_type=u["user_type"],
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                contact_number=u.get("contact_number"),
                is_active=True,
            ))
            print(f"  added {u['username']}")
            created += 1

        db.commit()
        print(f"\n✓ Done — {created} user(s) created, {len(USERS)-created} skipped.")
        print("\nLogin credentials:")
        for u in USERS:
            print(f"  {u['username']:12s}  /  {u['password']}")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
