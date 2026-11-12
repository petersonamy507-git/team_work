import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/crewdesk")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "72"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
