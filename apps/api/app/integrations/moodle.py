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


async def get_all_active_users() -> list:
    """Busca todos os usuários ativos do Moodle (não suspensos e não deletados)"""
    result = await call_moodle("core_user_get_users", {
        "criteria[0][key]": "suspended",
        "criteria[0][value]": "0"
    })
    
    users = result.get("users", []) if isinstance(result, dict) else []
    
    # Filtra apenas usuários ativos e com email válido
    active_users = [
        u for u in users 
        if u.get("confirmed", 0) == 1 
        and not u.get("deleted", False)
        and u.get("email")
        and "@" in u.get("email", "")
    ]
    
    return active_users


async def get_enrolled_users_in_course(course_id: int) -> list:
    """Busca todos os alunos matriculados em um curso específico"""
    result = await call_moodle("core_enrol_get_enrolled_users", {
        "courseid": str(course_id)
    })
    return result or []


async def get_all_enrolled_students() -> list:
    """
    Busca todos os alunos que estão matriculados em pelo menos um curso.
    Retorna lista de alunos ativos com email e telefone.
    """
    # Primeiro busca todos os cursos
    courses = await get_all_courses()
    
    # Set para evitar duplicatas (aluno pode estar em vários cursos)
    students_dict = {}
    
    for course in courses:
        course_id = course.get("id")
        if not course_id or course_id == 1:  # Ignora curso padrão do Moodle
            continue
        
        try:
            enrolled = await get_enrolled_users_in_course(course_id)
            
            for user in enrolled:
                user_id = user.get("id")
                
                # Ignora se já processou ou se é admin/guest
                if user_id in students_dict:
                    continue
                if user.get("username") in ["admin", "guest"]:
                    continue
                
                # Só pega usuários ativos
                if user.get("suspended", False):
                    continue
                
                email = user.get("email", "")
                if not email or "@" not in email:
                    continue
                
                students_dict[user_id] = {
                    "id": user_id,
                    "username": user.get("username"),
                    "firstname": user.get("firstname", ""),
                    "lastname": user.get("lastname", ""),
                    "fullname": user.get("fullname", f"{user.get('firstname', '')} {user.get('lastname', '')}".strip()),
                    "email": email,
                    "phone": user.get("phone1") or user.get("phone2") or "",
                }
        except Exception as e:
            print(f"Erro ao buscar alunos do curso {course_id}: {e}")
            continue
    
    return list(students_dict.values())
