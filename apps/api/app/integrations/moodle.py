import os
from dotenv import load_dotenv
import httpx

load_dotenv()

MOODLE_URL = os.getenv("MOODLE_URL", "")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN", "")


async def call_moodle(function: str, params: dict = None) -> dict:
    """Chama uma função da API do Moodle"""
    url = f"{MOODLE_URL}/webservice/rest/server.php"
    
    data = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": function,
        "moodlewsrestformat": "json",
        **(params or {})
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, data=data)
        
        # Debug
        if response.status_code != 200:
            raise Exception(f"HTTP {response.status_code}: {response.text[:200]}")
        
        try:
            result = response.json()
        except:
            raise Exception(f"Invalid JSON response: {response.text[:200]}")
        
        if isinstance(result, dict) and "exception" in result:
            raise Exception(f"Moodle error: {result.get('message', result)}")
        
        return result


async def get_user_by_email(email: str) -> dict | None:
    """Busca usuário do Moodle por email"""
    result = await call_moodle("core_user_get_users_by_field", {
        "field": "email",
        "values[0]": email
    })
    
    if result and len(result) > 0:
        return result[0]
    return None


async def get_user_by_id(user_id: int) -> dict | None:
    """Busca usuário do Moodle por ID"""
    result = await call_moodle("core_user_get_users_by_field", {
        "field": "id",
        "values[0]": str(user_id)
    })
    
    if result and len(result) > 0:
        return result[0]
    return None


async def get_user_courses(user_id: int) -> list:
    """Busca cursos em que o usuário está matriculado"""
    result = await call_moodle("core_enrol_get_users_courses", {
        "userid": str(user_id)
    })
    return result or []


async def get_course_completion(user_id: int, course_id: int) -> dict:
    """Busca status de conclusão das atividades de um curso"""
    result = await call_moodle("core_completion_get_activities_completion_status", {
        "userid": str(user_id),
        "courseid": str(course_id)
    })
    return result or {}


async def get_user_grades(user_id: int, course_id: int) -> dict:
    """Busca notas do usuário em um curso"""
    result = await call_moodle("gradereport_user_get_grade_items", {
        "userid": str(user_id),
        "courseid": str(course_id)
    })
    return result or {}


async def get_all_courses() -> list:
    """Busca todos os cursos"""
    result = await call_moodle("core_course_get_courses")
    return result or []
