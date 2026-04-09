import time
from typing import Optional
from sqlalchemy import Column, String, Text, BigInteger, Boolean, JSON
from open_webui.internal.db import Base, get_db
from pydantic import BaseModel, ConfigDict


class ConsentForm(Base):
    __tablename__ = "consent_form"

    id = Column(String, primary_key=True)
    slug = Column(String, unique=True, nullable=False)
    study_ids = Column(JSON, nullable=False, default=list)
    version = Column(String, nullable=False, default="1.0.0")
    title = Column(String, nullable=False)
    pi_name = Column(String, nullable=True)
    irb_number = Column(String, nullable=True)
    body_html = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    effective_date = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class ConsentFormModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    study_ids: list[str]
    version: str
    title: str
    pi_name: Optional[str] = None
    irb_number: Optional[str] = None
    body_html: str
    is_active: bool
    effective_date: Optional[int] = None
    created_at: int
    updated_at: int


class ConsentFormCreate(BaseModel):
    slug: str
    study_ids: list[str]
    version: str = "1.0.0"
    title: str
    pi_name: Optional[str] = None
    irb_number: Optional[str] = None
    body_html: str
    is_active: bool = True
    effective_date: Optional[int] = None


class ConsentFormUpdate(BaseModel):
    slug: Optional[str] = None
    study_ids: Optional[list[str]] = None
    version: Optional[str] = None
    title: Optional[str] = None
    pi_name: Optional[str] = None
    irb_number: Optional[str] = None
    body_html: Optional[str] = None
    is_active: Optional[bool] = None
    effective_date: Optional[int] = None


class ConsentFormTable:
    def get_by_study_id(self, study_id: str) -> Optional[ConsentFormModel]:
        """Find an active consent form that includes the given study_id."""
        with get_db() as db:
            forms = db.query(ConsentForm).filter(ConsentForm.is_active == True).all()
            for form in forms:
                ids = form.study_ids if isinstance(form.study_ids, list) else []
                if study_id in ids:
                    return ConsentFormModel.model_validate(form)
            return None

    def get_all(self) -> list[ConsentFormModel]:
        """Get all consent forms (active and inactive)."""
        with get_db() as db:
            forms = db.query(ConsentForm).order_by(ConsentForm.created_at.desc()).all()
            return [ConsentFormModel.model_validate(f) for f in forms]

    def get_by_id(self, form_id: str) -> Optional[ConsentFormModel]:
        with get_db() as db:
            form = db.query(ConsentForm).filter_by(id=form_id).first()
            return ConsentFormModel.model_validate(form) if form else None

    def create(self, form_data: ConsentFormCreate) -> ConsentFormModel:
        import uuid

        now = int(time.time())
        form = ConsentForm(
            id=str(uuid.uuid4()),
            slug=form_data.slug,
            study_ids=form_data.study_ids,
            version=form_data.version,
            title=form_data.title,
            pi_name=form_data.pi_name,
            irb_number=form_data.irb_number,
            body_html=form_data.body_html,
            is_active=form_data.is_active,
            effective_date=form_data.effective_date,
            created_at=now,
            updated_at=now,
        )
        with get_db() as db:
            db.add(form)
            db.commit()
            db.refresh(form)
            return ConsentFormModel.model_validate(form)

    def update(
        self, form_id: str, update_data: ConsentFormUpdate
    ) -> Optional[ConsentFormModel]:
        with get_db() as db:
            form = db.query(ConsentForm).filter_by(id=form_id).first()
            if not form:
                return None
            updates = update_data.model_dump(exclude_unset=True)
            updates["updated_at"] = int(time.time())
            for key, value in updates.items():
                setattr(form, key, value)
            db.commit()
            db.refresh(form)
            return ConsentFormModel.model_validate(form)

    def deactivate(self, form_id: str) -> bool:
        """Deactivate a consent form. Never hard-delete — audit records reference these."""
        with get_db() as db:
            form = db.query(ConsentForm).filter_by(id=form_id).first()
            if not form:
                return False
            form.is_active = False
            form.updated_at = int(time.time())
            db.commit()
            return True


ConsentForms = ConsentFormTable()
