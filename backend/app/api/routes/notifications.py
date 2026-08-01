from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.schemas import MarkAllNotificationsReadResponse, NotificationResponse
from app.services.notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
service = NotificationService()


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user: dict = Depends(get_current_user)):
    return service.list(user["sub"])


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: UUID, user: dict = Depends(get_current_user)):
    result = service.mark_read(user["sub"], str(notification_id))
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return result


@router.patch("/read-all", response_model=MarkAllNotificationsReadResponse)
def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    return {"updated": service.mark_all_read(user["sub"])}
