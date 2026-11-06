
import hashlib
import io

import cv2
import numpy as np

from PIL import (
    Image,
    ImageOps,
    ImageStat,
    UnidentifiedImageError,
)


ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000


def calculate_sha256(file_bytes: bytes) -> str:
    """Calculate the exact SHA-256 fingerprint of the uploaded file."""
    return hashlib.sha256(file_bytes).hexdigest()


def calculate_perceptual_hash(gray_image: np.ndarray) -> str:
    """
    Generate a 64-bit perceptual hash of the whole image.

    This supports duplicate and visually similar image comparisons.
    It is not a facial biometric or identity-matching algorithm.
    """
    resized = cv2.resize(
        gray_image,
        (32, 32),
        interpolation=cv2.INTER_AREA
    )

    resized = np.float32(resized)
    dct_image = cv2.dct(resized)

    low_frequency = dct_image[:8, :8]
    values = low_frequency.flatten()

    median_value = np.median(values[1:])

    bits = values > median_value

    hash_value = 0

    for bit in bits:
        hash_value = (hash_value << 1) | int(bit)

    return f"{hash_value:016x}"


def analyse_image(file_bytes: bytes) -> dict:
    """Perform image validation and non-identifying forensic analysis."""

    # 1. Validate uploaded bytes.
    if not file_bytes:
        raise ValueError("Empty image file.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("Image exceeds the 10 MB limit.")

    # 2. Safely open and validate the image.
    try:
        image = Image.open(io.BytesIO(file_bytes))

        image.verify()

        image = Image.open(io.BytesIO(file_bytes))
        image.load()

    except (
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
    ):
        raise ValueError("Invalid or unsupported image.")

    if image.format not in ALLOWED_FORMATS:
        raise ValueError("Unsupported image format.")

    original_format = image.format
    exif_data = image.getexif()
    exif_count = len(exif_data)

    # 3. Check dimensions before processing.
    original_width, original_height = image.size

    if original_width < 32 or original_height < 32:
        raise ValueError("Image dimensions are too small.")

    if original_width * original_height > MAX_PIXELS:
        raise ValueError("Image dimensions exceed processing limits.")

    # 4. Correct image orientation using EXIF information.
    image = ImageOps.exif_transpose(image).convert("RGB")

    width, height = image.size

    image_array = np.array(image)

    # 5. Convert to grayscale for image analysis.
    gray = cv2.cvtColor(
        image_array,
        cv2.COLOR_RGB2GRAY
    )

    # 6. Calculate image quality indicators.
    laplacian_variance = float(
        cv2.Laplacian(gray, cv2.CV_64F).var()
    )

    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))

    if laplacian_variance < 50:
        sharpness_status = "Low sharpness"

    elif laplacian_variance < 150:
        sharpness_status = "Moderate sharpness"

    else:
        sharpness_status = "High sharpness"

    if brightness < 60:
        lighting_status = "Underexposed"

    elif brightness > 200:
        lighting_status = "Potentially overexposed"

    else:
        lighting_status = "Normal brightness range"

    # 7. Detect visible frontal faces.
    cascade_path = (
        cv2.data.haarcascades
        + "haarcascade_frontalface_default.xml"
    )

    face_cascade = cv2.CascadeClassifier(cascade_path)

    if face_cascade.empty():
        raise RuntimeError("OpenCV face detector could not be loaded.")

    detected_faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )

    face_locations = []

    for x, y, w, h in detected_faces:
        face_area = int(w * h)
        image_area = int(width * height)

        face_locations.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "area_pixels": face_area,
            "image_area_percentage": round(
                (face_area / image_area) * 100,
                2
            )
        })

    # 8. Calculate whole-image perceptual fingerprint.
    perceptual_hash = calculate_perceptual_hash(gray)

    # 9. Extract basic image metadata.
    metadata = {
        "exif_present": exif_count > 0,
        "exif_fields_available": exif_count,
        "orientation_corrected": (
            original_width != width
            or original_height != height
        )
    }

    # 10. Return structured investigation results.
    return {
        "file": {
            "format": original_format,
            "width": width,
            "height": height,
            "size_bytes": len(file_bytes)
        },

        "integrity": {
            "sha256": calculate_sha256(file_bytes),
            "perceptual_hash": perceptual_hash,
            "perceptual_hash_method": "64-bit DCT image hash"
        },

        "quality": {
            "blur_indicator": round(laplacian_variance, 2),
            "sharpness_assessment": sharpness_status,
            "brightness": round(brightness, 2),
            "lighting_assessment": lighting_status,
            "contrast": round(contrast, 2)
        },

        "face_analysis": {
            "faces_detected": len(face_locations),
            "locations": face_locations,
            "method": "OpenCV Haar Cascade",
            "identity_matching": False
        },

        "metadata": metadata,

        "limitations": [
            "Face detection does not identify a person.",
            "Face detection may miss profiles, occluded faces and low-quality images.",
            "Perceptual hashes compare whole-image appearance, not facial identity.",
            "Blur, brightness and contrast are diagnostic indicators.",
            "Missing EXIF metadata does not establish manipulation.",
            "This analysis does not establish image authenticity."
        ]
    }
