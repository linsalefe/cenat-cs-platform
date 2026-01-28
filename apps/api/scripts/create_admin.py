import sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash

db = SessionLocal()

# Verifica se já existe
existing = db.query(User).filter(User.email == "admin@cenat.com").first()
if existing:
    print("Admin já existe!")
else:
    admin = User(
        email="admin@cenat.com",
        hashed_password=get_password_hash("admin123"),
        name="Administrador",
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(admin)
    db.commit()
    print("Admin criado com sucesso!")
    print("Email: admin@cenat.com")
    print("Senha: admin123")

db.close()
