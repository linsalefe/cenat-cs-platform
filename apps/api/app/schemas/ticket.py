from datetime import datetime
from pydantic import BaseModel
from app.models.ticket import TicketStatus, TicketCategory, TicketPriority


class TicketCreate(BaseModel):
    student_id: int
    category: TicketCategory = TicketCategory.OTHER
    priority: TicketPriority = TicketPriority.MEDIUM
    subject: str | None = None
    message: str | None = None


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    category: TicketCategory | None = None
    priority: TicketPriority | None = None
    subject: str | None = None
    assigned_to_id: int | None = None


class TicketMessageCreate(BaseModel):
    content: str


class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_user_id: int | None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBasic(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None

    class Config:
        from_attributes = True


class UserBasic(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: int
    protocol: str
    student_id: int
    assigned_to_id: int | None
    status: TicketStatus
    category: TicketCategory
    priority: TicketPriority
    subject: str | None
    sla_deadline: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    student: StudentBasic | None = None
    assigned_to: UserBasic | None = None

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    messages: list[TicketMessageResponse] = []
