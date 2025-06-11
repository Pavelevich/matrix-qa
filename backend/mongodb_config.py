import motor.motor_asyncio
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import bcrypt
import base64
from cryptography.fernet import Fernet

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/matrix_qa")
JWT_SECRET = os.getenv("JWT_SECRET", "matrix_jwt_secret_key_for_authentication")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "matrix_encryption_key_32chars_length")

def get_encryption_key():
    key = ENCRYPTION_KEY.encode()
    if len(key) != 32:
        key = base64.urlsafe_b64encode(key[:32].ljust(32, b'_'))
    return key


client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
database = client.matrix_qa


users_collection = database.users
history_collection = database.history


fernet = Fernet(get_encryption_key())

def encrypt_api_key(api_key):
    return fernet.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key):
    return fernet.decrypt(encrypted_key.encode()).decode()

async def initialize_admin_user():

    admin = await users_collection.find_one({"username": "admin"})
    if not admin:

        hashed_password = bcrypt.hashpw("admin".encode(), bcrypt.gensalt()).decode()
        await users_collection.insert_one({
            "username": "admin",
            "password": hashed_password,
            "role": "admin",
            "linked_models": [],
            "history": []
        })
        print("✅ User admin created with password admin")

async def connect_to_mongodb():
    try:
        await client.admin.command('ping')
        print("✅ Connection to MongoDB established")
        await initialize_admin_user()
        return True
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        return False