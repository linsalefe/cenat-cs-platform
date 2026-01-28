import sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from app.db.session import SessionLocal
from app.models.student import Student

db = SessionLocal()

existing = db.query(Student).filter(Student.email == "aluno@teste.com").first()
if existing:
    print(f"Aluno já existe! ID: {existing.id}")
else:
    student = Student(
        name="João Silva",
        email="aluno@teste.com",
        phone="83999999999",
        cpf="12345678901",
    )
    db.add(student)
    db.commit()
    print(f"Aluno criado com sucesso! ID: {student.id}")

db.close()
