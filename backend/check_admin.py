from app.db.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"ID is {u.id}, Email is {u.email}, Role is {u.role}")

admin = db.query(User).filter(User.role == "admin").first()
if admin:
    print(f"Admin found: {admin.email}")
else:
    print("Admin not found in DB")
