import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()

user = db.query(User).filter(User.email == "admin@cenat.com.br").first()

if user:
    user.hashed_password = get_password_hash("admin123")
    db.commit()
    print("✅ Senha resetada!")
    print("Email: admin@cenat.com.br")
    print("Senha: admin123")
else:
    print("❌ Usuário admin não encontrado")

db.close()
