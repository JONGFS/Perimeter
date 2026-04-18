from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
from dotenv import load_dotenv
import uvicorn

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Item(BaseModel):
    name: str

class ItemResponse(BaseModel):
    id: int
    name: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str

# Routes
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/items", response_model=list[ItemResponse])
async def get_items():
    return [
        {"id": 1, "name": "Item One"},
        {"id": 2, "name": "Item Two"},
    ]

@app.post("/api/items", response_model=ItemResponse, status_code=201)
async def create_item(item: Item):
    return {
        "id": int(datetime.utcnow().timestamp() * 1000),
        "name": item.name
    }

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
