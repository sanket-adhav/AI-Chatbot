from sqlalchemy.orm import Session
from app.models.document import Document

class DocumentRepository:
    @staticmethod
    def get_by_id(db: Session, doc_id: int) -> Document | None:
        return db.query(Document).filter(Document.id == doc_id).first()

    @staticmethod
    def get_user_documents(db: Session, user_id: int) -> list[Document]:
        return db.query(Document).filter(Document.user_id == user_id).all()

    @staticmethod
    def create(db: Session, doc: Document) -> Document:
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def save(db: Session, doc: Document) -> Document:
        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def delete(db: Session, doc: Document) -> None:
        db.delete(doc)
        db.commit()
