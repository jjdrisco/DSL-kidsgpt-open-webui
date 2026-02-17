"""
CHILD PROFILE: FastAPI router for child profile management
- Provides CRUD operations for child profiles linked to parent users
- Supports creating, reading, updating, and deleting child profiles
- Includes user authentication and ownership verification
"""

import logging
import secrets
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from open_webui.utils.auth import get_verified_user, get_admin_user, get_password_hash
from open_webui.utils.child_feature_prompts import build_child_system_prompt
from open_webui.models.child_profiles import (
    ChildProfileModel,
    ChildProfileForm,
    ChildProfiles,
)
from open_webui.models.users import UserModel, Users
from open_webui.models.auths import Auths, SignupForm

log = logging.getLogger(__name__)

router = APIRouter()


def generate_passphrase(num_words=4) -> str:
    """Generate a memorable passphrase using random words

    Args:
        num_words: Number of words in the passphrase

    Returns:
        A passphrase like 'happy-tree-blue-mountain-42'
    """
    # Simple word list for passphrase generation
    adjectives = [
        "happy",
        "bright",
        "quick",
        "calm",
        "wise",
        "bold",
        "kind",
        "fair",
        "cool",
        "warm",
    ]
    nouns = [
        "tree",
        "mountain",
        "river",
        "ocean",
        "star",
        "cloud",
        "forest",
        "meadow",
        "valley",
        "peak",
    ]

    words = []
    for i in range(num_words):
        if i % 2 == 0:
            words.append(secrets.choice(adjectives))
        else:
            words.append(secrets.choice(nouns))

    # Add a random 2-digit number for extra security
    number = secrets.randbelow(100)
    words.append(str(number))

    return "-".join(words)


class ChildProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    child_age: Optional[int] = None
    child_gender: Optional[str] = None
    child_characteristics: Optional[str] = None
    # parenting_style removed - now collected in exit survey (migration gg11hh22ii33)
    # Research fields
    is_only_child: Optional[bool] = None
    child_has_ai_use: Optional[str] = None
    child_ai_use_contexts: Optional[list[str]] = None
    parent_llm_monitoring_level: Optional[str] = None
    # "Other" text fields
    child_gender_other: Optional[str] = None
    child_ai_use_contexts_other: Optional[str] = None
    parent_llm_monitoring_other: Optional[str] = None
    session_number: Optional[int] = None
    attempt_number: Optional[int] = None
    is_current: Optional[bool] = None
    created_at: int
    updated_at: int
    child_email: Optional[str] = None
    selected_features: Optional[list[str]] = None
    selected_interface_modes: Optional[list[str]] = None
    generated_password: Optional[str] = None  # Only included on creation


class ChildProfileStatsResponse(BaseModel):
    total_profiles: int
    unique_parents: int


@router.post("/child-profiles", response_model=ChildProfileResponse)
async def create_child_profile(
    form_data: ChildProfileForm, current_user: UserModel = Depends(get_verified_user)
):
    """Create a new child profile and optionally a user account"""
    log.info(f"[create_child_profile] Received form_data: {form_data}")
    generated_password = None

    try:
        # Determine session_number if not provided
        if form_data.session_number is None:
            existing_profiles = ChildProfiles.get_child_profiles_by_user(
                current_user.id
            )
            if existing_profiles:
                max_session = max(
                    (p.session_number for p in existing_profiles), default=0
                )
                session_number = max_session + 1
            else:
                session_number = 1
        else:
            session_number = form_data.session_number

        # Create the child profile
        child_profile = ChildProfiles.insert_new_child_profile(
            form_data, current_user.id, session_number=session_number
        )
        if not child_profile:
            raise HTTPException(
                status_code=500, detail="Failed to create child profile"
            )

        # Create user account if email is provided
        if form_data.child_email:
            # Check if user with this email already exists
            existing_user = Users.get_user_by_email(form_data.child_email)

            if not existing_user:
                # Generate a secure passphrase
                generated_password = generate_passphrase()

                try:
                    # Create the user account with "child" role
                    child_user = Auths.insert_new_auth(
                        email=form_data.child_email,
                        password=get_password_hash(generated_password),
                        name=form_data.name,
                        role="child",
                    )

                    if child_user:
                        log.info(f"Created child user account: {child_user.email}")
                        log.info(
                            f"Generated password for {child_user.email}: {generated_password}"
                        )
                    else:
                        log.warning(
                            f"Failed to create user account for: {form_data.child_email}"
                        )
                        # Don't fail the whole request, profile is still created
                        generated_password = None
                except Exception as user_err:
                    log.error(f"Error creating child user account: {user_err}")
                    # Don't fail the whole request, profile is still created
                    generated_password = None

        # Sync child user settings.system from selected_features
        log.info(
            "[create_child_profile] child_email=%s, selected_features=%s",
            (form_data.child_email or "")[:30] or None,
            form_data.selected_features,
        )
        if form_data.child_email:
            child_user_to_update = Users.get_user_by_email(form_data.child_email)
            if child_user_to_update:
                prompt = build_child_system_prompt(form_data.selected_features)
                updated = Users.update_user_settings_by_id(
                    child_user_to_update.id, {"system": prompt}
                )
                if updated:
                    log.info(
                        "Synced system prompt for child user %s from profile",
                        form_data.child_email[:30],
                    )
                else:
                    log.warning(
                        "Sync failed: update_user_settings_by_id returned None for child %s",
                        form_data.child_email[:30],
                    )
            else:
                log.warning(
                    "Sync skipped: no user found for child_email=%s",
                    form_data.child_email[:30],
                )

        # Prepare response with generated password (if created)
        response_data = child_profile.model_dump()
        if generated_password:
            response_data["generated_password"] = generated_password

        return ChildProfileResponse(**response_data)
    except HTTPException:
        # Re-raise HTTP exceptions as-is (they already have proper error messages)
        raise
    except Exception as e:
        log.error(f"Error creating child profile: {e}")
        # Include the actual error message in the response for debugging
        error_detail = str(e) if e else "Internal server error"
        raise HTTPException(
            status_code=500, detail=f"Failed to create child profile: {error_detail}"
        )


@router.get("/child-profiles", response_model=List[ChildProfileResponse])
async def get_child_profiles(current_user: UserModel = Depends(get_verified_user)):
    """Get all child profiles for the current user (parents) or own profile (child users)."""
    try:
        if current_user.role == "child":
            log.info(
                "[get_child_profiles] Child user request, email=%s",
                (current_user.email or "")[:30],
            )
            profile = ChildProfiles.get_child_profile_by_child_email(current_user.email)
            if profile:
                log.info(
                    "[get_child_profiles] Found profile id=%s, selected_features=%s",
                    profile.id,
                    getattr(profile, "selected_features", None),
                )
            else:
                log.warning(
                    "[get_child_profiles] No profile found for child email=%s",
                    (current_user.email or "")[:30],
                )
            return [ChildProfileResponse(**profile.model_dump())] if profile else []
        profiles = ChildProfiles.get_child_profiles_by_user(current_user.id)
        return [ChildProfileResponse(**profile.model_dump()) for profile in profiles]
    except Exception as e:
        log.error(f"Error getting child profiles: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/child-profiles/{profile_id}", response_model=ChildProfileResponse)
async def get_child_profile_by_id(
    profile_id: str, current_user: UserModel = Depends(get_verified_user)
):
    """Get a specific child profile"""
    try:
        profile = ChildProfiles.get_child_profile_by_id(profile_id, current_user.id)
        if not profile:
            raise HTTPException(status_code=404, detail="Child profile not found")

        return ChildProfileResponse(**profile.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error getting child profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/child-profiles/{profile_id}", response_model=ChildProfileResponse)
async def update_child_profile(
    profile_id: str,
    form_data: ChildProfileForm,
    current_user: UserModel = Depends(get_verified_user),
):
    """Update a child profile"""
    try:
        profile = ChildProfiles.update_child_profile_by_id(
            profile_id, current_user.id, form_data
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Child profile not found")

        # Sync child user settings.system from selected_features
        child_email = form_data.child_email or getattr(profile, "child_email", None)
        selected = form_data.selected_features or getattr(
            profile, "selected_features", None
        )
        log.info(
            "[update_child_profile] child_email=%s selected_features=%s",
            (child_email or "")[:30] or None,
            selected,
        )
        if child_email:
            child_user_to_update = Users.get_user_by_email(child_email)
            if child_user_to_update:
                prompt = build_child_system_prompt(selected)
                log.info(
                    "[update_child_profile] building prompt for child %s, prompt_len=%d",
                    child_email[:30],
                    len(prompt) if prompt else 0,
                )
                updated_user = Users.update_user_settings_by_id(
                    child_user_to_update.id, {"system": prompt}
                )
                if updated_user:
                    s = getattr(updated_user, "settings", None)
                    sys_val = (
                        (
                            s.get("system", "")
                            if isinstance(s, dict)
                            else getattr(s, "system", "")
                        )
                        if s
                        else ""
                    )
                    log.info(
                        "[update_child_profile] settings populated for child %s, system prompt len=%d",
                        child_email[:30],
                        len(sys_val),
                    )
                else:
                    log.warning(
                        "[update_child_profile] update_user_settings_by_id returned None for child %s",
                        child_email[:30],
                    )
            else:
                log.warning(
                    "[update_child_profile] no user found for child_email=%s",
                    (child_email or "")[:30],
                )

        # Also sync to parent's settings so preview mode picks up the new prompt immediately
        parent_prompt = build_child_system_prompt(selected)
        Users.update_user_settings_by_id(current_user.id, {"system": parent_prompt})
        log.info(
            "[update_child_profile] synced system prompt to parent %s",
            current_user.id[:8],
        )

        return ChildProfileResponse(**profile.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error updating child profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/child-profiles/{profile_id}")
async def delete_child_profile(
    profile_id: str, current_user: UserModel = Depends(get_verified_user)
):
    """Delete a child profile"""
    try:
        success = ChildProfiles.delete_child_profile(profile_id, current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Child profile not found")

        return {"message": "Child profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error deleting child profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/child-profiles/{profile_id}/apply-preview")
async def apply_preview_settings(
    profile_id: str,
    current_user: UserModel = Depends(get_verified_user),
):
    """Apply a child profile's system prompt to the requesting parent's settings.

    Used when a parent enters preview mode: builds the child's whitelist prompt
    from selected_features and writes it to the parent's own settings.system so
    the LLM enforces the same constraints the child would see.
    """
    profile = ChildProfiles.get_child_profile_by_id(profile_id, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Child profile not found")

    prompt = build_child_system_prompt(getattr(profile, "selected_features", None))
    Users.update_user_settings_by_id(current_user.id, {"system": prompt})
    log.info(
        "[apply_preview_settings] synced system prompt to parent %s for child profile %s",
        current_user.id[:8],
        profile_id[:8],
    )
    return {"system": prompt}


@router.get("/child-profiles/stats", response_model=ChildProfileStatsResponse)
async def get_child_profile_stats(current_user: UserModel = Depends(get_verified_user)):
    """Get child profile statistics (admin only)"""
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        stats = ChildProfiles.get_child_profile_stats()
        return ChildProfileStatsResponse(**stats)
    except Exception as e:
        log.error(f"Error getting child profile stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/child-profiles/admin/{user_id}", response_model=List[ChildProfileResponse]
)
async def get_child_profiles_for_user(
    user_id: str, admin_user: UserModel = Depends(get_admin_user)
):
    """Admin endpoint to get child profiles for a specific user"""
    try:
        profiles = ChildProfiles.get_child_profiles_by_user(user_id)
        return [ChildProfileResponse(**profile.model_dump()) for profile in profiles]
    except Exception as e:
        log.error(f"Error getting child profiles for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
