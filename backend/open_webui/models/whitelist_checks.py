"""
WHITELIST CHECKS: Database models for storing prompt comparison and response validation results

This module stores the results of two safety checks:
1. Prompt comparison - comparing child's prompts against system prompts
2. Response validation - validating AI responses against whitelist rules
"""

import time
import uuid
from typing import Optional, List

from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Column, Text, Index, Boolean

from open_webui.internal.db import Base, JSONField, get_db


class PromptComparisonCheck(Base):
    """
    Stores results of comparing a child's prompt against the system prompt
    to detect potential violations before generating a response.
    """

    __tablename__ = "prompt_comparison_check"

    id = Column(Text, primary_key=True)
    user_id = Column(Text, nullable=False)
    child_id = Column(Text, nullable=True)  # Optional child profile link

    # The prompts being compared
    child_prompt = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=False)

    # Analysis results
    is_compliant = Column(Boolean, nullable=False, default=True)
    concern_level = Column(
        Text, nullable=False, default="none"
    )  # none, low, medium, high
    concerns = Column(JSONField, nullable=True)  # List of specific concerns
    reasoning = Column(Text, nullable=True)
    model_used = Column(Text, nullable=True)  # Model used for analysis

    # Metadata
    session_number = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_prompt_check_user_id", "user_id"),
        Index("idx_prompt_check_child_id", "child_id"),
        Index("idx_prompt_check_created_at", "created_at"),
        Index("idx_prompt_check_compliant", "is_compliant", "concern_level"),
    )


class ResponseValidationCheck(Base):
    """
    Stores results of validating an AI response against whitelist rules
    after the response is generated.
    """

    __tablename__ = "response_validation_check"

    id = Column(Text, primary_key=True)
    user_id = Column(Text, nullable=False)
    child_id = Column(Text, nullable=True)  # Optional child profile link

    # The content being validated
    response_text = Column(Text, nullable=False)
    whitelist_system_prompt = Column(Text, nullable=False)
    original_child_prompt = Column(Text, nullable=True)  # For context

    # Validation results
    is_compliant = Column(Boolean, nullable=False, default=True)
    severity = Column(
        Text, nullable=False, default="none"
    )  # none, low, medium, high, critical
    violations = Column(JSONField, nullable=True)  # List of specific violations
    reasoning = Column(Text, nullable=True)
    should_block = Column(Boolean, nullable=False, default=False)
    was_blocked = Column(
        Boolean, nullable=False, default=False
    )  # Whether it was actually blocked
    model_used = Column(Text, nullable=True)  # Model used for validation

    # Metadata
    session_number = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_response_check_user_id", "user_id"),
        Index("idx_response_check_child_id", "child_id"),
        Index("idx_response_check_created_at", "created_at"),
        Index("idx_response_check_compliant", "is_compliant", "severity"),
        Index("idx_response_check_blocked", "should_block", "was_blocked"),
    )


# Pydantic models for API responses
class PromptComparisonCheckModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    child_id: Optional[str] = None
    child_prompt: str
    system_prompt: str
    is_compliant: bool
    concern_level: str
    concerns: Optional[List[str]] = None
    reasoning: Optional[str] = None
    model_used: Optional[str] = None
    session_number: Optional[int] = None
    created_at: int


class ResponseValidationCheckModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    child_id: Optional[str] = None
    response_text: str
    whitelist_system_prompt: str
    original_child_prompt: Optional[str] = None
    is_compliant: bool
    severity: str
    violations: Optional[List[str]] = None
    reasoning: Optional[str] = None
    should_block: bool
    was_blocked: bool
    model_used: Optional[str] = None
    session_number: Optional[int] = None
    created_at: int


# Database table classes
class PromptComparisonChecks:
    """Database operations for prompt comparison checks"""

    def insert_check(
        self,
        user_id: str,
        child_prompt: str,
        system_prompt: str,
        is_compliant: bool,
        concern_level: str,
        concerns: List[str],
        reasoning: str,
        model_used: str,
        child_id: Optional[str] = None,
        session_number: Optional[int] = None,
    ) -> Optional[PromptComparisonCheckModel]:
        """Insert a new prompt comparison check"""
        with get_db() as db:
            id = str(uuid.uuid4())
            ts = int(time.time_ns())

            check = PromptComparisonCheck(
                id=id,
                user_id=user_id,
                child_id=child_id,
                child_prompt=child_prompt,
                system_prompt=system_prompt,
                is_compliant=is_compliant,
                concern_level=concern_level,
                concerns=concerns,
                reasoning=reasoning,
                model_used=model_used,
                session_number=session_number,
                created_at=ts,
            )

            db.add(check)
            db.commit()
            db.refresh(check)
            return PromptComparisonCheckModel.model_validate(check) if check else None

    def get_checks_by_user(
        self, user_id: str, limit: int = 100
    ) -> List[PromptComparisonCheckModel]:
        """Get recent prompt checks for a user"""
        with get_db() as db:
            checks = (
                db.query(PromptComparisonCheck)
                .filter(PromptComparisonCheck.user_id == user_id)
                .order_by(PromptComparisonCheck.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                PromptComparisonCheckModel.model_validate(check) for check in checks
            ]


class ResponseValidationChecks:
    """Database operations for response validation checks"""

    def insert_check(
        self,
        user_id: str,
        response_text: str,
        whitelist_system_prompt: str,
        is_compliant: bool,
        severity: str,
        violations: List[str],
        reasoning: str,
        should_block: bool,
        was_blocked: bool,
        model_used: str,
        original_child_prompt: Optional[str] = None,
        child_id: Optional[str] = None,
        session_number: Optional[int] = None,
    ) -> Optional[ResponseValidationCheckModel]:
        """Insert a new response validation check"""
        with get_db() as db:
            id = str(uuid.uuid4())
            ts = int(time.time_ns())

            check = ResponseValidationCheck(
                id=id,
                user_id=user_id,
                child_id=child_id,
                response_text=response_text,
                whitelist_system_prompt=whitelist_system_prompt,
                original_child_prompt=original_child_prompt,
                is_compliant=is_compliant,
                severity=severity,
                violations=violations,
                reasoning=reasoning,
                should_block=should_block,
                was_blocked=was_blocked,
                model_used=model_used,
                session_number=session_number,
                created_at=ts,
            )

            db.add(check)
            db.commit()
            db.refresh(check)
            return ResponseValidationCheckModel.model_validate(check) if check else None

    def get_checks_by_user(
        self, user_id: str, limit: int = 100
    ) -> List[ResponseValidationCheckModel]:
        """Get recent response validation checks for a user"""
        with get_db() as db:
            checks = (
                db.query(ResponseValidationCheck)
                .filter(ResponseValidationCheck.user_id == user_id)
                .order_by(ResponseValidationCheck.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                ResponseValidationCheckModel.model_validate(check) for check in checks
            ]


# Global instances
PromptComparisonChecksTable = PromptComparisonChecks()
ResponseValidationChecksTable = ResponseValidationChecks()
