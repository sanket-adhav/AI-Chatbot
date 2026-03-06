from app.db.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"ID: {u.id}, Username: {u.username}, Email: {u.email}, Avatar: {u.avatar_url}")
