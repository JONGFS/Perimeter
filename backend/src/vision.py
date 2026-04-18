import os
import base64
import io
import json
from typing import Union, Optional
from pathlib import Path
from dotenv import load_dotenv
import PIL.Image
import google.genai as genai
import asyncio
from pydantic import BaseModel

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)


# --- Response models ---

class FoodItem(BaseModel):
    name: str
    quantity: Optional[str] = None
    portion_size: Optional[str] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    calories: Optional[float] = None

class MacroTotals(BaseModel):
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    calories: float

class VisionResult(BaseModel):
    success: bool
    food_items: list[FoodItem] = []
    total_macros: Optional[MacroTotals] = None
    visible_labels: list[str] = []
    non_food_items: list[str] = []
    confidence: str = "low"
    notes: Optional[str] = None
    error: Optional[str] = None


# --- Image helpers ---

def base64_to_image(base64_string: str) -> PIL.Image.Image:
    image_data = base64.b64decode(base64_string)
    return PIL.Image.open(io.BytesIO(image_data))


def image_to_base64(image_input: Union[str, PIL.Image.Image]) -> str:
    if isinstance(image_input, str):
        with open(image_input, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    img_byte_arr = io.BytesIO()
    image_input.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)
    return base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")


def _load_image(image_input: Union[str, PIL.Image.Image, bytes]) -> PIL.Image.Image:
    if isinstance(image_input, str):
        return PIL.Image.open(image_input)
    if isinstance(image_input, bytes):
        return PIL.Image.open(io.BytesIO(image_input))
    return image_input


# --- Core vision call ---

_PROMPT = """Analyze this image and return ONLY a valid JSON object (no markdown, no explanation).

Schema:
{
  "food_items": [
    {
      "name": "string",
      "quantity": "string or null",
      "portion_size": "string or null (e.g. '1 cup', '200g')",
      "protein_g": number or null,
      "carbs_g": number or null,
      "fat_g": number or null,
      "fiber_g": number or null,
      "calories": number or null
    }
  ],
  "total_macros": {
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "calories": number
  },
  "visible_labels": ["string"],
  "non_food_items": ["string"],
  "confidence": "high" | "medium" | "low",
  "notes": "string or null"
}

Rules:
- Include ALL visible food items with individual macro estimates
- Sum all food macros into total_macros
- visible_labels: any text/brand names readable in the image
- non_food_items: non-food objects visible (e.g. laptop, plate, bottle)
- confidence: how certain you are about the nutritional estimates
- If no food is visible, return empty food_items and null total_macros
"""


def _analyze_image(image_input: Union[str, PIL.Image.Image, bytes]) -> VisionResult:
    img = _load_image(image_input)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[_PROMPT, img],
    )

    raw = response.text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    data = json.loads(raw)

    food_items = [FoodItem(**item) for item in data.get("food_items", [])]

    total_macros = None
    if data.get("total_macros"):
        total_macros = MacroTotals(**data["total_macros"])

    return VisionResult(
        success=True,
        food_items=food_items,
        total_macros=total_macros,
        visible_labels=data.get("visible_labels", []),
        non_food_items=data.get("non_food_items", []),
        confidence=data.get("confidence", "low"),
        notes=data.get("notes"),
    )


# --- Public API ---

async def process_image_async(
    image_input: Union[str, PIL.Image.Image, bytes],
) -> VisionResult:
    """Analyze image and return structured VisionResult. Use this in FastAPI routes."""
    try:
        return await asyncio.to_thread(_analyze_image, image_input)
    except Exception as e:
        return VisionResult(success=False, error=str(e))


def process_image(
    image_input: Union[str, PIL.Image.Image, bytes],
) -> VisionResult:
    """Synchronous wrapper — do NOT call from inside a running event loop (FastAPI)."""
    return asyncio.run(process_image_async(image_input))


# --- CLI test entry point ---

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python vision.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"Error: image not found: {image_path}")
        sys.exit(1)

    print(f"Processing: {image_path}\n")
    result = process_image(image_path)

    if result.error:
        print(f"Error: {result.error}")
        sys.exit(1)

    print("=" * 60)
    print("FOOD ITEMS")
    print("=" * 60)
    if result.food_items:
        for item in result.food_items:
            qty = f" x{item.quantity}" if item.quantity else ""
            portion = f" ({item.portion_size})" if item.portion_size else ""
            print(f"  {item.name}{qty}{portion}")
            if item.calories is not None:
                print(f"    Calories: {item.calories} kcal  |  P: {item.protein_g}g  C: {item.carbs_g}g  F: {item.fat_g}g  Fiber: {item.fiber_g}g")
    else:
        print("  No food items detected.")

    if result.total_macros:
        print("\n" + "=" * 60)
        print("TOTALS")
        print("=" * 60)
        m = result.total_macros
        print(f"  Calories: {m.calories} kcal")
        print(f"  Protein:  {m.protein_g}g")
        print(f"  Carbs:    {m.carbs_g}g")
        print(f"  Fat:      {m.fat_g}g")
        print(f"  Fiber:    {m.fiber_g}g")

    if result.visible_labels:
        print(f"\nLabels seen: {', '.join(result.visible_labels)}")
    if result.non_food_items:
        print(f"Other items: {', '.join(result.non_food_items)}")
    print(f"\nConfidence: {result.confidence}")
    if result.notes:
        print(f"Notes: {result.notes}")
