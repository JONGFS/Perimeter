from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
from dotenv import load_dotenv
import uvicorn
import sys

# Add src directory to path so we can import vision
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from vision import process_image, base64_to_image

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
    extract_items: bool = True
    analyze_macros: bool = True

class ImageAnalysisResponse(BaseModel):
    success: bool
    items: dict = None
    macros: dict = None
    error: str = None

# Image processing routes
@app.post("/api/images/analyze", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageAnalysisRequest):
    """
    Analyze image (base64) to extract items and macros.
    
    Expected request:
    {
        "image": "base64_encoded_image",
        "extract_items": true,
        "analyze_macros": true
    }
    """
    try:
        # Convert base64 to image
        image = base64_to_image(request.image)
        
        # Process the image
        result = process_image(
            image,
            extract_items=request.extract_items,
            analyze_macros=request.analyze_macros
        )
        
        return ImageAnalysisResponse(
            success=result["success"],
            items=result["items"],
            macros=result["macros"],
            error=result["error"]
        )
    except Exception as e:
        return ImageAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/images/upload")
async def upload_and_analyze_image(
    file: UploadFile = File(...),
    extract_items: bool = Form(True),
    analyze_macros: bool = Form(True)
):
    """
    Upload image file and analyze to extract items and macros.
    """
    try:
        image_bytes = await file.read()
        
        # Process the image
        result = process_image(
            image_bytes,
            extract_items=extract_items,
            analyze_macros=analyze_macros
        )
        
        return {
            "success": result["success"],
            "items": result["items"],
            "macros": result["macros"],
            "error": result["error"],
            "filename": file.filename
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
