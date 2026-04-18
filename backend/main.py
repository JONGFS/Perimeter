from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
from dotenv import load_dotenv
import uvicorn
import sys

# Add src directory to path so we can import vision
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from vision import process_image_async, base64_to_image, VisionResult

load_dotenv()

app = FastAPI(title="Perimeter API")

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

class ImageAnalysisRequest(BaseModel):
    image: str  # base64 string

@app.post("/api/images/analyze", response_model=VisionResult)
async def analyze_image(request: ImageAnalysisRequest):
    """Analyze a base64-encoded image and return structured food/macro data."""
    try:
        image = base64_to_image(request.image)
        return await process_image_async(image)
    except Exception as e:
        return VisionResult(success=False, error=str(e))

@app.post("/api/images/upload", response_model=VisionResult)
async def upload_and_analyze_image(file: UploadFile = File(...)):
    """Upload an image file and return structured food/macro data."""
    try:
        image_bytes = await file.read()
        return await process_image_async(image_bytes)
    except Exception as e:
        return VisionResult(success=False, error=str(e))

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
