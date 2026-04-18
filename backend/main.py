from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Literal
import os
from dotenv import load_dotenv
import uvicorn
import sys

# Add src directory to path so we can import vision
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from vision import process_image, base64_to_image

from agents import interpret_fridge, recommend_meal, speak_as_sprite

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

# Original routes
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

# ---------- FuelFlow agent routes ----------

LocationContext = Literal["airport", "campus", "downtown", "suburb", "home", "other"]
NutritionGoal = Literal[
    "high_protein", "low_calorie", "energy_focus", "balanced", "vegetarian", "budget"
]
SpriteOccasion = Literal["recommendation", "nudge", "celebrate", "reassure"]


class LocationInfo(BaseModel):
    context: LocationContext
    lat: float | None = None
    lng: float | None = None
    notes: str | None = None


class Preferences(BaseModel):
    goals: list[NutritionGoal] = Field(default_factory=list)
    dietary_restrictions: list[str] = Field(default_factory=list)
    budget_usd: float | None = None
    time_minutes: int | None = None


class LocationRecRequest(BaseModel):
    location: LocationInfo
    preferences: Preferences
    fridge_data: dict[str, Any] | None = None


class FridgeIngredient(BaseModel):
    name: str
    category: str | None = None
    confidence: float | None = None


class FridgeRequest(BaseModel):
    raw_ingredients: list[FridgeIngredient]
    preferences: Preferences | None = None


class SpriteRequest(BaseModel):
    occasion: SpriteOccasion
    recommendation: dict[str, Any] | None = None
    user_goal: str | None = None
    location_context: str | None = None
    note: str | None = None


@app.post("/api/location-recommendation")
async def location_recommendation(req: LocationRecRequest):
    try:
        return recommend_meal(
            location_context=req.location.model_dump(),
            preferences=req.preferences.model_dump(),
            fridge_data=req.fridge_data,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"agent_failure: {e}")


@app.post("/api/fridge-interpretation")
async def fridge_interpretation(req: FridgeRequest):
    try:
        return interpret_fridge(
            raw_ingredients=[i.model_dump() for i in req.raw_ingredients],
            preferences=req.preferences.model_dump() if req.preferences else None,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"agent_failure: {e}")


@app.post("/api/sprite/speak")
async def sprite_speak(req: SpriteRequest):
    try:
        return speak_as_sprite(
            occasion=req.occasion,
            recommendation=req.recommendation,
            user_goal=req.user_goal,
            location_context=req.location_context,
            note=req.note,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"agent_failure: {e}")


if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
