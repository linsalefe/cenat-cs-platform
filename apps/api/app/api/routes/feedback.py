from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.feedback import Feedback, FeedbackType, FeedbackTrigger, get_nps_category, get_csat_category
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    student_id: int
    feedback_type: FeedbackType
    trigger: FeedbackTrigger = FeedbackTrigger.MANUAL
    reference_type: str | None = None
    reference_id: int | None = None


class FeedbackSubmit(BaseModel):
    score: int
    comment: str | None = None


@router.post("/request")
def create_feedback_request(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria uma solicitação de feedback para um aluno"""
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    feedback = feedback_service.create_feedback_request(
        db=db,
        student_id=data.student_id,
        feedback_type=data.feedback_type,
        trigger=data.trigger,
        reference_type=data.reference_type,
        reference_id=data.reference_id,
    )
    
    # URL para resposta (ajustar domínio em produção)
    response_url = f"/feedback/respond/{feedback.token}"
    
    return {
        "id": feedback.id,
        "student_id": feedback.student_id,
        "feedback_type": feedback.feedback_type.value,
        "token": feedback.token,
        "response_url": response_url,
    }


@router.get("/respond/{token}")
def get_feedback_form(token: str, db: Session = Depends(get_db)):
    """Retorna dados do feedback para exibir formulário (público)"""
    feedback = db.query(Feedback).filter(Feedback.token == token).first()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")
    
    student = db.query(Student).filter(Student.id == feedback.student_id).first()
    
    return {
        "id": feedback.id,
        "feedback_type": feedback.feedback_type.value,
        "student_name": student.name if student else "Aluno",
        "already_answered": feedback.answered_at is not None,
        "reference_type": feedback.reference_type,
        "reference_id": feedback.reference_id,
    }


@router.post("/respond/{token}")
def submit_feedback(
    token: str,
    data: FeedbackSubmit,
    db: Session = Depends(get_db),
):
    """Submete resposta de feedback (público)"""
    try:
        feedback = feedback_service.submit_feedback(
            db=db,
            token=token,
            score=data.score,
            comment=data.comment,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")
    
    # Retorna categoria da resposta
    if feedback.feedback_type == FeedbackType.NPS:
        category = get_nps_category(feedback.score)
    else:
        category = get_csat_category(feedback.score)
    
    return {
        "status": "success",
        "message": "Obrigado pelo seu feedback!",
        "category": category,
    }


@router.get("/nps/summary")
def get_nps_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna resumo do NPS"""
    return feedback_service.get_nps_summary(db, days)


@router.get("/csat/summary")
def get_csat_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna resumo do CSAT"""
    return feedback_service.get_csat_summary(db, days)


@router.get("/list")
def list_feedbacks(
    feedback_type: FeedbackType | None = None,
    answered: bool | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista feedbacks"""
    query = db.query(Feedback).join(Student)
    
    if feedback_type:
        query = query.filter(Feedback.feedback_type == feedback_type)
    
    if answered is not None:
        if answered:
            query = query.filter(Feedback.answered_at.isnot(None))
        else:
            query = query.filter(Feedback.answered_at.is_(None))
    
    feedbacks = query.order_by(Feedback.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": f.id,
            "student_id": f.student_id,
            "student_name": f.student.name,
            "feedback_type": f.feedback_type.value,
            "trigger": f.trigger.value,
            "score": f.score,
            "comment": f.comment,
            "sent_at": f.sent_at.isoformat() if f.sent_at else None,
            "answered_at": f.answered_at.isoformat() if f.answered_at else None,
        }
        for f in feedbacks
    ]


@router.post("/send-nps/{student_id}")
async def send_nps_whatsapp(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envia NPS via WhatsApp para um aluno"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    
    if not student.phone:
        raise HTTPException(status_code=400, detail="Aluno sem telefone cadastrado")
    
    # Cria feedback
    feedback = feedback_service.create_feedback_request(
        db=db,
        student_id=student_id,
        feedback_type=FeedbackType.NPS,
        trigger=FeedbackTrigger.MANUAL,
    )
    
    # Envia WhatsApp
    from app.integrations.whatsapp_meta import send_message
    
    message = f"""Olá {student.name}! 👋

Queremos saber sua opinião sobre o CENAT!

Em uma escala de 0 a 10, o quanto você recomendaria o CENAT para um amigo ou colega?

Responda aqui: https://cs.cenat.com.br/feedback/{feedback.token}

Obrigado! 💙"""
    
    try:
        await send_message(student.phone, message)
        return {"status": "sent", "feedback_id": feedback.id}
    except Exception as e:
        return {"status": "error", "error": str(e), "feedback_id": feedback.id}
