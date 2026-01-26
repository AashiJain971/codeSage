"""
Authentication middleware for Supabase JWT verification
"""
import os
from typing import Optional
from fastapi import Header, HTTPException, Depends
from supabase import create_client, Client
from dotenv import load_dotenv
import jwt
from jwt import PyJWTError

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Initialize Supabase client for auth verification
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception as e:
        print(f"❌ Failed to initialize Supabase auth client: {e}")


async def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Verify Supabase JWT token and return user_id
    
    Args:
        authorization: Bearer token from Authorization header
        
    Returns:
        user_id: UUID of authenticated user
        
    Raises:
        HTTPException: If token is invalid or missing
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header"
        )
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected 'Bearer <token>'"
        )
    
    token = parts[1]
    
    try:
        # Decode JWT token
        # Supabase uses HS256 algorithm with JWT_SECRET
        if SUPABASE_JWT_SECRET:
            # Verify with JWT secret if available
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Fallback: decode without verification (less secure)
            # This should only be used in development
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
        
        # Extract user_id from token payload
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing user ID"
            )
        
        return user_id
        
    except PyJWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Token verification failed: {str(e)}"
        )


async def get_current_user(user_id: str = Depends(verify_token)) -> str:
    """
    Dependency to get current authenticated user
    
    Args:
        user_id: User ID from verified token
        
    Returns:
        user_id: UUID of authenticated user
    """
    return user_id
