import os
import base64
import io
from typing import Union
from pathlib import Path
from dotenv import load_dotenv
import PIL.Image
import google.generativeai as genai

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure the Generative AI API
genai.configure(api_key=GEMINI_API_KEY)


def base64_to_image(base64_string: str) -> PIL.Image.Image:
    """Convert base64 string to PIL Image."""
    image_data = base64.b64decode(base64_string)
    return PIL.Image.open(io.BytesIO(image_data))


def image_to_base64(image_input: Union[str, PIL.Image.Image]) -> str:
    """Convert image file or PIL Image to base64 string."""
    if isinstance(image_input, str):
        # It's a file path
        with open(image_input, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
    else:
        # It's a PIL Image object
        img_byte_arr = io.BytesIO()
        image_input.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        return base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")


def extract_items_from_image(image_input: Union[str, PIL.Image.Image, bytes]) -> dict:
    """
    Extract items and their quantities from image using Gemini.
    
    Args:
        image_input: Image file path, PIL Image object, or bytes
    
    Returns:
        Dict with extracted items and quantities
    """
    model = genai.GenerativeModel(model_name="gemini-1.5-flash")
    
    # Handle different input types
    if isinstance(image_input, str):
        img = PIL.Image.open(image_input)
    elif isinstance(image_input, bytes):
        img = PIL.Image.open(io.BytesIO(image_input))
    else:
        img = image_input
    
    prompt = """Analyze this image and extract the following information:
1. List all visible items/objects
2. For each item, provide the quantity if visible
3. Estimate nutritional macros if it's food (protein, carbs, fats)
4. List any labels or text visible in the image

Return the data in a structured format."""
    
    response = model.generate_content([prompt, img])
    return {
        "extraction": response.text,
        "success": True
    }


def analyze_nutrition_macros(image_input: Union[str, PIL.Image.Image, bytes]) -> dict:
    """
    Analyze nutritional information and macros from food image.
    
    Args:
        image_input: Image file path, PIL Image object, or bytes
    
    Returns:
        Dict with macro analysis (protein, carbs, fats, calories)
    """
    model = genai.GenerativeModel(model_name="gemini-1.5-flash")
    
    # Handle different input types
    if isinstance(image_input, str):
        img = PIL.Image.open(image_input)
    elif isinstance(image_input, bytes):
        img = PIL.Image.open(io.BytesIO(image_input))
    else:
        img = image_input
    
    prompt = """Analyze the food in this image and provide:
1. Food identification and portion size estimation
2. Estimated macronutrients:
   - Protein (grams)
   - Carbohydrates (grams)
   - Fats (grams)
   - Fiber (grams)
3. Estimated calories
4. Confidence level (high/medium/low)

Format as JSON if possible."""
    
    response = model.generate_content([prompt, img])
    return {
        "macros": response.text,
        "success": True
    }


def process_image(
    image_input: Union[str, PIL.Image.Image, bytes],
    extract_items: bool = True,
    analyze_macros: bool = True
) -> dict:
    """
    Full image processing pipeline.
    
    Args:
        image_input: Image file path, PIL Image object, or bytes from frontend
        extract_items: Whether to extract items
        analyze_macros: Whether to analyze nutrition macros
    
    Returns:
        Dict with all analysis results
    """
    results = {
        "success": False,
        "items": None,
        "macros": None,
        "error": None
    }
    
    try:
        if extract_items:
            results["items"] = extract_items_from_image(image_input)
        
        if analyze_macros:
            results["macros"] = analyze_nutrition_macros(image_input)
        
        results["success"] = True
        
    except Exception as e:
        results["error"] = str(e)
    
    return results