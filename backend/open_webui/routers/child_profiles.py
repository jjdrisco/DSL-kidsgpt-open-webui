"""
CHILD PROFILE: FastAPI router for child profile management
- Provides CRUD operations for child profiles linked to parent users
- Supports creating, reading, updating, and deleting child profiles
- Includes user authentication and ownership verification
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from open_webui.utils.auth import get_verified_user, get_admin_user
from open_webui.models.child_profiles import (
    ChildProfileModel,
    ChildProfileForm,
    WhitelistUpdateForm,
    ChildProfiles,
)
from open_webui.models.users import UserModel

log = logging.getLogger(__name__)

router = APIRouter()


class ChildProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    child_age: Optional[str] = None
    child_gender: Optional[str] = None
    child_characteristics: Optional[str] = None
    # parenting_style removed - now collected in exit survey (migration gg11hh22ii33)
    # Research fields
    is_only_child: Optional[bool] = None
    child_has_ai_use: Optional[str] = None
    child_ai_use_contexts: Optional[list[str]] = None
    parent_llm_monitoring_level: Optional[str] = None
    child_internet_use_frequency: Optional[str] = (
        None  # '1'–'8' matching exit survey scale
    )
    # "Other" text fields
    child_gender_other: Optional[str] = None
    child_ai_use_contexts_other: Optional[str] = None
    parent_llm_monitoring_other: Optional[str] = None
    session_id: Optional[str] = None
    attempt_number: Optional[int] = None
    is_current: Optional[bool] = None
    created_at: int
    updated_at: int
    child_email: Optional[str] = None
    # Whitelist / feature control
    selected_features: Optional[list[str]] = None
    selected_interface_modes: Optional[list[str]] = None


class ChildProfileStatsResponse(BaseModel):
    total_profiles: int
    unique_parents: int


@router.post("/child-profiles", response_model=ChildProfileResponse)
async def create_child_profile(
    form_data: ChildProfileForm, current_user: UserModel = Depends(get_verified_user)
):
    """Create a new child profile"""
    try:
        # Resolve session_id from payload or current user session.
        session_id = (
            form_data.session_id or current_user.current_session_id or "unknown"
        )

        child_profile = ChildProfiles.insert_new_child_profile(
            form_data, current_user.id, session_id=session_id
        )
        if not child_profile:
            raise HTTPException(
                status_code=500, detail="Failed to create child profile"
            )

        return ChildProfileResponse(**child_profile.model_dump())
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


@router.get("/child-profiles/my-whitelist")
async def get_my_whitelist(
    current_user: UserModel = Depends(get_verified_user),
):
    """Return the whitelist for the currently logged-in child user.

    Replicates the middleware lookup: match child_email against the parent's
    profiles, fall back to the parent's current (is_current=True) profile.
    Non-child callers receive an empty list.
    """
    if current_user.role != "child" or not current_user.parent_id:
        return {"whitelist_items": []}

    try:
        profile = ChildProfiles.get_child_profile_by_child_email(
            current_user.parent_id, current_user.email
        )
        if not profile:
            profile = ChildProfiles.get_current_child_profile(current_user.parent_id)
        items = []
        if profile and profile.selected_features:
            items = profile.selected_features
        return {"whitelist_items": items}
    except Exception as e:
        log.error(f"Error fetching whitelist for child {current_user.id}: {e}")
        return {"whitelist_items": []}


@router.get("/child-profiles", response_model=List[ChildProfileResponse])
async def get_child_profiles(current_user: UserModel = Depends(get_verified_user)):
    """Get all child profiles for the current user"""
    try:
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


@router.patch(
    "/child-profiles/{profile_id}/whitelist", response_model=ChildProfileResponse
)
async def patch_child_profile_whitelist(
    profile_id: str,
    form_data: WhitelistUpdateForm,
    current_user: UserModel = Depends(get_verified_user),
):
    """Replace the whitelist (selected_features) for a child profile."""
    try:
        profile = ChildProfiles.update_selected_features(
            profile_id, current_user.id, form_data.whitelist_items
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Child profile not found")
        return ChildProfileResponse(**profile.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error updating whitelist for profile {profile_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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
