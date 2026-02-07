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
    result = await call_moodle("core_user_get_users_by_field", {
        "field": "email",
        "values[0]": email
    })
    if result and len(result) > 0:
        return result[0]
    return None


async def get_user_by_id(user_id: int) -> dict | None:
    result = await call_moodle("core_user_get_users_by_field", {
        "field": "id",
        "values[0]": str(user_id)
    })
    if result and len(result) > 0:
        return result[0]
    return None


async def get_user_courses(user_id: int) -> list:
    result = await call_moodle("core_enrol_get_users_courses", {
        "userid": str(user_id)
    })
    return result or []


async def get_course_completion(user_id: int, course_id: int) -> dict:
    result = await call_moodle("core_completion_get_activities_completion_status", {
        "userid": str(user_id),
        "courseid": str(course_id)
    })
    return result or {}


async def get_user_grades(user_id: int, course_id: int) -> dict:
    result = await call_moodle("gradereport_user_get_grade_items", {
        "userid": str(user_id),
        "courseid": str(course_id)
    })
    return result or {}


async def get_all_courses() -> list:
    result = await call_moodle("core_course_get_courses")
    return result or []


async def get_all_active_users() -> list:
    result = await call_moodle("core_user_get_users", {
        "criteria[0][key]": "suspended",
        "criteria[0][value]": "0"
    })
    users = result.get("users", []) if isinstance(result, dict) else []
    return [
        u for u in users
        if u.get("confirmed", 0) == 1
        and not u.get("deleted", False)
        and u.get("email")
        and "@" in u.get("email", "")
    ]


async def get_enrolled_users_in_course(course_id: int) -> list:
    result = await call_moodle("core_enrol_get_enrolled_users", {
        "courseid": str(course_id)
    })
    return result or []


async def get_all_enrolled_students() -> list:
    """
    Busca todos os alunos matriculados em pelo menos um curso.
    Captura firstaccess, customfields (documentos) e curso principal.
    """
    courses = await get_all_courses()
    
    # Filtra cursos reais (ignora site e teste)
    real_courses = [c for c in courses if c.get("id", 0) > 1 and c.get("id") != 10]
    
    students_dict = {}
    
    for course in real_courses:
        course_id = course.get("id")
        course_name = course.get("fullname", "")
        
        try:
            enrolled = await get_enrolled_users_in_course(course_id)
            
            for user in enrolled:
                user_id = user.get("id")
                
                if user.get("username") in ["admin", "guest"]:
                    continue
                if user.get("suspended", False):
                    continue
                
                email = user.get("email", "")
                if not email or "@" not in email:
                    continue
                
                if user_id not in students_dict:
                    # Conta documentos dos customfields
                    custom_fields = user.get("customfields", [])
                    doc_fields = ["cpf", "rg", "historico_escolar", "diploma", "comprovante_de_residencia"]
                    docs_count = 0
                    for cf in custom_fields:
                        if cf.get("shortname") in doc_fields and cf.get("value") and str(cf["value"]) != "0":
                            docs_count += 1
                    
                    students_dict[user_id] = {
                        "id": user_id,
                        "username": user.get("username"),
                        "firstname": user.get("firstname", ""),
                        "lastname": user.get("lastname", ""),
                        "fullname": user.get("fullname", f"{user.get('firstname', '')} {user.get('lastname', '')}".strip()),
                        "email": email,
                        "phone": user.get("phone1") or user.get("phone2") or "",
                        "firstaccess": user.get("firstaccess", 0),
                        "lastaccess": user.get("lastaccess", 0),
                        "documents_count": docs_count,
                        "documents_total": len(doc_fields),
                        "courses": [],
                    }
                
                # Adiciona curso à lista do aluno
                students_dict[user_id]["courses"].append({
                    "id": course_id,
                    "name": course_name,
                })
        except Exception as e:
            print(f"Erro ao buscar alunos do curso {course_id}: {e}")
            continue
    
    # Define curso principal (primeiro curso da lista)
    for student in students_dict.values():
        if student["courses"]:
            student["primary_course_id"] = student["courses"][0]["id"]
            student["primary_course_name"] = student["courses"][0]["name"]
        else:
            student["primary_course_id"] = None
            student["primary_course_name"] = None
    
    return list(students_dict.values())
