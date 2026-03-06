from app.db.database import SessionLocal
from app.models.user import User
import json

db = SessionLocal()
user = db.query(User).filter(User.username.like("jetski_user%")).first()
if user:
    print(f"User found: {user.username}")
    print(f"Avatar URL: {user.avatar_url}")
    print(f"Theme: {user.theme_preference}")
else:
    print("User not found")
