"""
Rotas para gestão de cursos Moodle.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import get_current_user
from app.services.moodle_courses import (
    get_all_courses,
    get_course_enrollments,
    get_course_contents,
    get_course_assignments,
    get_all_upcoming_assignments,
)

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("")
async def list_courses(current_user=Depends(get_current_user)):
    """Lista todos os cursos com total de alunos e professores."""
    courses = await get_all_courses()

    result = []
    for course in courses:
        try:
            enrollment = await get_course_enrollments(course["id"])
            course["total_students"] = len(enrollment["students"])
            course["total_teachers"] = len(enrollment["teachers"])
            course["teachers"] = [t["fullname"] for t in enrollment["teachers"]]
        except Exception:
            course["total_students"] = 0
            course["total_teachers"] = 0
            course["teachers"] = []

        result.append(course)

    return result


@router.get("/calendar")
async def get_calendar(current_user=Depends(get_current_user)):
    """Retorna todas as atividades futuras de todos os cursos."""
    assignments = await get_all_upcoming_assignments()
    return {
        "total": len(assignments),
        "assignments": assignments,
    }


@router.get("/{course_id}")
async def get_course_detail(course_id: int, current_user=Depends(get_current_user)):
    """Retorna detalhes do curso: alunos, professores, conteúdo, atividades."""
    try:
        enrollment = await get_course_enrollments(course_id)
        contents = await get_course_contents(course_id)
        assignments = await get_course_assignments(course_id)

        # Resumo de tipos de módulos
        module_types = {}
        for section in contents:
            for m in section["modules"]:
                t = m["modname"]
                module_types[t] = module_types.get(t, 0) + 1

        return {
            "course_id": course_id,
            "students": enrollment["students"],
            "teachers": enrollment["teachers"],
            "total_students": len(enrollment["students"]),
            "total_teachers": len(enrollment["teachers"]),
            "sections": contents,
            "total_sections": len(contents),
            "assignments": assignments,
            "total_assignments": len(assignments),
            "module_types": module_types,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
