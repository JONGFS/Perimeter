from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Literal
import os
from dotenv import load_dotenv
import uvicorn
import sys

# Add src directory to path so we can import vision
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from vision import process_image_async, base64_to_image, VisionResult

from agents import interpret_fridge, recommend_meal, speak_as_sprite, chat_with_sprite

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


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class SpriteChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict[str, Any] | None = None


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


@app.post("/api/sprite/chat")
async def sprite_chat(req: SpriteChatRequest):
    try:
        reply = chat_with_sprite(
            messages=[m.model_dump() for m in req.messages],
            context=req.context,
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"agent_failure: {e}")


if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
