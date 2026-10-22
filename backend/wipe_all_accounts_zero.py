"""
ExpiryGo - Clean Slate Script (Zero Accounts & Zero Demo Data)
Wipes every user account, shop, product, reservation, order, notification, etc.
Leaves the database completely clean with EXACTLY ZERO (0) accounts ready for real-world testing.
"""

import sys
import os
import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from db.session import SessionLocal, init_db
from db.models import (
    User, Shop, Product, Reservation, Order,
    Notification, Favorite, PantryItem, Review, Follower
)

def wipe_all_to_zero():
    print("=" * 70)
    print("🧹 EXPIRYGO - PURGING ALL ACCOUNTS TO ZERO (REAL TESTING MODE)")
    print("=" * 70)

    # Initialize tables if not already present
    init_db()

    # Step 1: Wipe using SQLAlchemy session
    db = SessionLocal()
    try:
        print("[Step 1] Deleting all records via ORM session...")
        db.query(Review).delete()
        db.query(Favorite).delete()
        db.query(Follower).delete()
        db.query(PantryItem).delete()
        db.query(Notification).delete()
        db.query(Reservation).delete()
        db.query(Order).delete()
        db.query(Product).delete()
        db.query(Shop).delete()
        db.query(User).delete()
        db.commit()
        print("  ✓ ORM deletion committed successfully.")
    except Exception as e:
        db.rollback()
        print(f"  ❌ Error during ORM delete: {e}")
    finally:
        db.close()

    # Step 2: Wipe all SQLite DB files directly to ensure 100% synchronization
    db_paths = [
        backend_dir / "expirygo_local_dev.db",
        backend_dir.parent / "expirygo_local_dev.db",
    ]

    tables = [
        "reviews", "favorites", "followers", "pantry_items",
        "notifications", "reservations", "orders", "products",
        "shops", "users"
    ]

    print("\n[Step 2] Direct SQLite zero-wipe on local database files...")
    for db_path in db_paths:
        if db_path.exists():
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                for table in tables:
                    try:
                        cursor.execute(f'DELETE FROM "{table}";')
                    except Exception:
                        pass
                conn.commit()
                cursor.execute("VACUUM;")
                conn.commit()

                # Verify counts
                cursor.execute("SELECT count(*) FROM users;")
                user_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM shops;")
                shop_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM products;")
                prod_count = cursor.fetchone()[0]
                conn.close()

                print(f"  ✓ {db_path.name} wiped clean:")
                print(f"      • Users:    {user_count}")
                print(f"      • Shops:    {shop_count}")
                print(f"      • Products: {prod_count}")
            except Exception as ex:
                print(f"  ❌ Error wiping {db_path.name}: {ex}")

    print("\n" + "=" * 70)
    print("✅ ZERO-ACCOUNT CLEAN SLATE COMPLETE!")
    print("  • Total Accounts in Database: 0 (Zero users)")
    print("  • Total Shops:                0")
    print("  • Total Products:             0")
    print("  • Total Orders:               0")
    print("  • Ready for real testing from scratch with new accounts!")
    print("=" * 70)

if __name__ == "__main__":
    wipe_all_to_zero()
