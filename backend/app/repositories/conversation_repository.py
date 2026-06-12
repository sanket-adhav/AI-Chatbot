from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.folder import Folder

class ConversationRepository:
    @staticmethod
    def get_by_id(db: Session, conv_id: int) -> Conversation | None:
        return db.query(Conversation).filter(Conversation.id == conv_id).first()

    @staticmethod
    def get_user_conversations(db: Session, user_id: int) -> list[Conversation]:
        return db.query(Conversation).filter(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc()).all()

    @staticmethod
    def create(db: Session, conv: Conversation) -> Conversation:
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def save(db: Session, conv: Conversation) -> Conversation:
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def delete(db: Session, conv: Conversation) -> None:
        db.delete(conv)
        db.commit()

    @staticmethod
    def create_message(db: Session, message: Message) -> Message:
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def get_conversation_messages(db: Session, conv_id: int) -> list[Message]:
        return db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.asc()).all()

    @staticmethod
    def get_message_by_id(db: Session, msg_id: int) -> Message | None:
        return db.query(Message).filter(Message.id == msg_id).first()

    @staticmethod
    def delete_message(db: Session, message: Message) -> None:
        db.delete(message)
        db.commit()

    @staticmethod
    def get_folder_by_id(db: Session, folder_id: int) -> Folder | None:
        return db.query(Folder).filter(Folder.id == folder_id).first()

    @staticmethod
    def get_user_folders(db: Session, user_id: int) -> list[Folder]:
        return db.query(Folder).filter(Folder.user_id == user_id).all()

    @staticmethod
    def create_folder(db: Session, folder: Folder) -> Folder:
        db.add(folder)
        db.commit()
        db.refresh(folder)
        return folder

    @staticmethod
    def delete_folder(db: Session, folder: Folder) -> None:
        db.delete(folder)
        db.commit()
