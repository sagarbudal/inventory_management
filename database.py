from sqlalchemy import create_engine, Column, Integer, Float, String, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

Base = declarative_base()

class Video(Base):
    __tablename__ = 'videos'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    unique_code = Column(String, unique=True, nullable=False)
    duration = Column(Float, nullable=False)  # in minutes
    status = Column(String, default='not uploaded')  # 'uploaded' or 'not uploaded'
    category = Column(String, nullable=False)

class Equipment(Base):
    __tablename__ = 'equipment'
    
    id = Column(Integer, primary_key=True)
    equipment_name = Column(String, unique=True, nullable=False)
    total_quantity = Column(Integer, nullable=False)
    available_quantity = Column(Integer, nullable=False)

class Assignment(Base):
    __tablename__ = 'assignments'
    
    assignment_id = Column(Integer, primary_key=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False)
    user_name = Column(String, nullable=False)
    checkout_date = Column(String, nullable=False)  # YYYY-MM-DD
    status = Column(String, default='Out')  # 'Out' or 'Returned'
    
    # Relationship to ease details retrieval
    equipment = relationship("Equipment", backref="assignments")

# Database initialization helper
DATABASE_URL = "sqlite:///videomanager.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
