#!/usr/bin/env python
"""
Bootstrap admin user for the Python backend.
Run this after setting up the database but before starting the API server.
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core import settings, Base
from app.core.security import hash_password
from app.models import Profile

def bootstrap_admin():
    """Create admin user if it doesn't exist"""
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created/verified")
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        admin = db.query(Profile).filter(Profile.username == settings.ADMIN_USERNAME).first()
        
        if admin:
            print(f"✓ Admin user '{settings.ADMIN_USERNAME}' already exists")
            return
        
        # Create admin user
        admin_user = Profile(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            role='admin',
        )
        
        db.add(admin_user)
        db.commit()
        
        print(f"✓ Admin user created successfully")
        print(f"  Username: {settings.ADMIN_USERNAME}")
        print(f"  Email: {settings.ADMIN_EMAIL}")
        print(f"  Password: {settings.ADMIN_PASSWORD}")
        print("\n⚠️  IMPORTANT: Change these credentials in production!")
        
    except Exception as e:
        print(f"✗ Error creating admin user: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == '__main__':
    print("🔧 Bootstrapping Admin User...")
    bootstrap_admin()
    print("\n✅ Bootstrap complete! You can now start the API server.")

