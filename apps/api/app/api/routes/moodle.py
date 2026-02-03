from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.models.user import User
from app.integrations import moodle

router = APIRouter(prefix="/moodle", tags=["moodle"])


@router.get("/test")
async def test_connection(current_user: User = Depends(get_current_user)):
    """Testa conexão com o Moodle"""
    try:
        courses = await moodle.get_all_courses()
        return {
            "status": "ok",
            "courses_count": len(courses),
            "courses": [{"id": c["id"], "name": c["fullname"]} for c in courses[:5]]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{email}")
async def get_moodle_user(email: str, current_user: User = Depends(get_current_user)):
    """Busca usuário do Moodle por email"""
    try:
        user = await moodle.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado no Moodle")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/courses")
async def get_user_courses(user_id: int, current_user: User = Depends(get_current_user)):
    """Busca cursos do usuário no Moodle"""
    try:
        courses = await moodle.get_user_courses(user_id)
        return {"user_id": user_id, "courses": courses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/course/{course_id}/completion")
async def get_course_completion(
    user_id: int, 
    course_id: int, 
    current_user: User = Depends(get_current_user)
):
    """Busca progresso do usuário em um curso"""
    try:
        completion = await moodle.get_course_completion(user_id, course_id)
        return completion
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/course/{course_id}/grades")
async def get_course_grades(
    user_id: int, 
    course_id: int, 
    current_user: User = Depends(get_current_user)
):
    """Busca notas do usuário em um curso"""
    try:
        grades = await moodle.get_user_grades(user_id, course_id)
        return grades
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-students")
async def sync_students(current_user: User = Depends(get_current_user)):
    """Sincroniza todos os alunos ativos do Moodle"""
    try:
        from app.jobs.sync_students import sync_students_from_moodle_async
        result = await sync_students_from_moodle_async()
        return {
            "status": "ok",
            "message": "Sincronização concluída",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-signals")
async def sync_signals(current_user: User = Depends(get_current_user)):
    """Captura sinais do Moodle (progresso, notas, último acesso) para cálculo de risco"""
    try:
        from app.jobs.sync_moodle_signals import sync_moodle_signals
        result = await sync_moodle_signals()
        return {"status": "ok", "message": "Sinais capturados", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
