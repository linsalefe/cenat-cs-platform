import sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from app.db.session import SessionLocal
from app.models.student import Student

db = SessionLocal()

existing = db.query(Student).filter(Student.email == "luizabeder@outlook.com").first()
if existing:
    print(f"Aluno já existe! ID: {existing.id}")
else:
    student = Student(
        name="Luiza Eder",
        email="luizabeder@outlook.com",
        phone="",
    )
    db.add(student)
    db.commit()
    print(f"Aluno criado com sucesso! ID: {student.id}")

db.close()
