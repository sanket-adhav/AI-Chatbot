from app.db.database import SessionLocal
from app.models.agent import Agent
from app.models.conversation import Conversation

db = SessionLocal()
user_id = 13 # Admin user from previous context

agent = Agent(name="TestCascadingDeleteAgent", description="desc", instruction_template="inst", user_id=user_id, is_public=False)
db.add(agent)
db.commit()
db.refresh(agent)
print("Created Agent:", agent.id)

conv = Conversation(title="Test Conv", agent_id=agent.id, user_id=user_id)
db.add(conv)
db.commit()
db.refresh(conv)
print("Created Conv:", conv.id)

db.delete(agent)
try:
    db.commit()
    print("Agent & Conv deleted successfully (Cascade OK)")
except Exception as e:
    db.rollback()
    print("Delete failed:", e)
