import secrets
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student
from app.models.feedback import Feedback, FeedbackType, FeedbackTrigger, get_nps_category, get_csat_category


def generate_token() -> str:
    """Gera token único para resposta"""
    return secrets.token_urlsafe(32)


def create_feedback_request(
    db: Session,
    student_id: int,
    feedback_type: FeedbackType,
    trigger: FeedbackTrigger,
    reference_type: str | None = None,
    reference_id: int | None = None,
) -> Feedback:
    """Cria uma solicitação de feedback"""
    
    feedback = Feedback(
        student_id=student_id,
        feedback_type=feedback_type,
        trigger=trigger,
        reference_type=reference_type,
        reference_id=reference_id,
        token=generate_token(),
    )
    
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    return feedback


def submit_feedback(
    db: Session,
    token: str,
    score: int,
    comment: str | None = None,
) -> Feedback | None:
    """Registra resposta de feedback"""
    
    feedback = db.query(Feedback).filter(Feedback.token == token).first()
    
    if not feedback:
        return None
    
    if feedback.answered_at:
        return feedback  # Já respondido
    
    # Valida score
    if feedback.feedback_type == FeedbackType.NPS:
        if score < 0 or score > 10:
            raise ValueError("NPS deve ser entre 0 e 10")
    elif feedback.feedback_type == FeedbackType.CSAT:
        if score < 1 or score > 5:
            raise ValueError("CSAT deve ser entre 1 e 5")
    
    feedback.score = score
    feedback.comment = comment
    feedback.answered_at = datetime.utcnow()
    
    db.commit()
    db.refresh(feedback)
    
    return feedback


def get_nps_summary(db: Session, days: int = 30) -> dict:
    """Calcula NPS dos últimos X dias"""
    
    cutoff = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    cutoff = cutoff - timedelta(days=days)
    
    feedbacks = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.NPS,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).all()
    
    if not feedbacks:
        return {
            "nps_score": None,
            "total_responses": 0,
            "promoters": 0,
            "passives": 0,
            "detractors": 0,
            "promoters_pct": 0,
            "detractors_pct": 0,
        }
    
    promoters = sum(1 for f in feedbacks if f.score >= 9)
    passives = sum(1 for f in feedbacks if 7 <= f.score <= 8)
    detractors = sum(1 for f in feedbacks if f.score <= 6)
    
    total = len(feedbacks)
    promoters_pct = (promoters / total) * 100
    detractors_pct = (detractors / total) * 100
    nps_score = promoters_pct - detractors_pct
    
    return {
        "nps_score": round(nps_score, 1),
        "total_responses": total,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "promoters_pct": round(promoters_pct, 1),
        "detractors_pct": round(detractors_pct, 1),
    }


def get_csat_summary(db: Session, days: int = 30) -> dict:
    """Calcula CSAT dos últimos X dias"""
    
    cutoff = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    cutoff = cutoff - timedelta(days=days)
    
    feedbacks = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.CSAT,
        Feedback.answered_at >= cutoff,
        Feedback.score.isnot(None),
    ).all()
    
    if not feedbacks:
        return {
            "csat_score": None,
            "total_responses": 0,
            "satisfied": 0,
            "neutral": 0,
            "dissatisfied": 0,
            "average_score": None,
        }
    
    satisfied = sum(1 for f in feedbacks if f.score >= 4)
    neutral = sum(1 for f in feedbacks if f.score == 3)
    dissatisfied = sum(1 for f in feedbacks if f.score <= 2)
    
    total = len(feedbacks)
    csat_score = (satisfied / total) * 100
    average = sum(f.score for f in feedbacks) / total
    
    return {
        "csat_score": round(csat_score, 1),
        "total_responses": total,
        "satisfied": satisfied,
        "neutral": neutral,
        "dissatisfied": dissatisfied,
        "average_score": round(average, 2),
    }
