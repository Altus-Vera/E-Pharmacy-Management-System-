"""
Safely resets a user's password. Does NOT touch any other data.
Run from backend/ directory:
    python reset_password.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.user import User
from app.utils.password_utils import hash_password

RESETS = [
    ("admin",      "Admin@1234"),
    ("pharmacist", "Pharm@1234"),
    ("stockmgr",   "Stock@1234"),
    ("manager",    "Manager@1234"),
]

def run():
    db = SessionLocal()
    try:
        for username, new_password in RESETS:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                print(f"  skip  {username}  (not found)")
                continue
            user.hashed_password = hash_password(new_password)
            print(f"  reset {username}")
        db.commit()
        print("\n✓ Passwords updated.")
        print("\nNew login credentials:")
        for username, pw in RESETS:
            print(f"  {username:12s}  /  {pw}")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
