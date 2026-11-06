
import os
from pathlib import Path

from dotenv import load_dotenv
from cryptography.fernet import Fernet, InvalidToken

# Locate the AEGIS_INTEL project root
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Load the encryption key from the project's .env file
load_dotenv(PROJECT_ROOT / ".env")

ENCRYPTION_KEY = os.getenv("AEGIS_ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    raise RuntimeError(
        "AEGIS_ENCRYPTION_KEY is missing from the .env file."
    )

try:
    cipher = Fernet(ENCRYPTION_KEY.encode("ascii"))
except (ValueError, TypeError) as error:
    raise RuntimeError("The AEGIS encryption key is invalid.") from error


def encrypt_bytes(data: bytes) -> bytes:
    """Encrypt evidence bytes."""
    return cipher.encrypt(data)


def decrypt_bytes(encrypted_data: bytes) -> bytes:
    """Decrypt evidence bytes."""
    return cipher.decrypt(encrypted_data)
