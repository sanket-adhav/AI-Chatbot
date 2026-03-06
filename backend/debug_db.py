from sqlalchemy import create_engine, text, inspect
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_and_fix_db():
    print(f"Connecting to DB: {settings.database_url}")
    engine = create_engine(settings.database_url)
    inspector = inspect(engine)

    # Check agents
    if inspector.has_table("agents"):
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM agents")).scalar()
            print(f"Agents count: {count}")
    else:
        print("Table 'agents' does not exist!")

    # Check conversations
    if inspector.has_table("conversations"):
        columns = [c["name"] for c in inspector.get_columns("conversations")]
        print(f"Conversations columns: {columns}")

        if "user_id" not in columns:
            print("Adding user_id column to conversations table...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE conversations ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                conn.execute(text("CREATE INDEX ix_conversations_user_id ON conversations (user_id)"))
                conn.commit()
            print("Column added successfully.")
        else:
            print("user_id column already exists.")
    else:
        print("Table 'conversations' does not exist!")

if __name__ == "__main__":
    check_and_fix_db()
