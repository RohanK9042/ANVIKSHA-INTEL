
import base64
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    PROJECT_ROOT
    / "backend"
    / "models"
    / "face_landmarker.task"
)

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_FACES = 5

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode


# --------------------------------------------------
# FACIAL MESH CONNECTIONS
# Selected contours for analytical visualisation
# --------------------------------------------------


# --------------------------------------------------
# OFFICIAL MEDIAPIPE FACIAL MESH CONNECTIONS
# --------------------------------------------------

from mediapipe.tasks.python.vision import FaceLandmarksConnections

FACE_MESH = FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION

FEATURE_CONNECTION_GROUPS = [
    FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL,
    FaceLandmarksConnections.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarksConnections.FACE_LANDMARKS_LEFT_EYEBROW,
    FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_EYEBROW,
    FaceLandmarksConnections.FACE_LANDMARKS_LEFT_IRIS,
    FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_IRIS,
    FaceLandmarksConnections.FACE_LANDMARKS_LIPS,
    FaceLandmarksConnections.FACE_LANDMARKS_NOSE,
]


# --------------------------------------------------
# HELPER: CONVERT NORMALISED LANDMARKS TO PIXELS
# --------------------------------------------------

def landmark_to_pixel(landmark, width, height):
    x = int(landmark.x * width)
    y = int(landmark.y * height)

    return (
        max(0, min(width - 1, x)),
        max(0, min(height - 1, y))
    )


# --------------------------------------------------
# HELPER: HEAD ORIENTATION ESTIMATION
# Uses approximate generic facial geometry.
# This is an estimate, not biometric identification.
# --------------------------------------------------


# --------------------------------------------------
# HEAD POSE ESTIMATION
# --------------------------------------------------

def estimate_head_pose(landmarks, width, height):
    """
    Estimate head orientation using selected facial landmarks.

    Returns pitch, yaw and roll in degrees, together
    with a reprojection-error diagnostic.

    This is an approximate geometric estimate, not
    a biometric identification measurement.
    """

    # Stable facial reference landmarks.
    landmark_indices = [1, 152, 33, 263, 61, 291]

    image_points = np.array(
        [
            landmark_to_pixel(
                landmarks[index],
                width,
                height
            )
            for index in landmark_indices
        ],
        dtype=np.float64
    )

    # Generic 3D reference face geometry.
    model_points = np.array(
        [
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0)
        ],
        dtype=np.float64
    )

    focal_length = float(max(width, height))

    camera_matrix = np.array(
        [
            [focal_length, 0, width / 2],
            [0, focal_length, height / 2],
            [0, 0, 1]
        ],
        dtype=np.float64
    )

    distortion = np.zeros((4, 1), dtype=np.float64)

    try:
        success, rotation_vector, translation_vector = (
            cv2.solvePnP(
                model_points,
                image_points,
                camera_matrix,
                distortion,
                flags=cv2.SOLVEPNP_ITERATIVE
            )
        )

        if not success:
            return {
                "available": False,
                "reason": "Pose estimation failed."
            }

        rotation_matrix, _ = cv2.Rodrigues(
            rotation_vector
        )

        # Extract Euler angles in degrees.
        angles = cv2.RQDecomp3x3(
            rotation_matrix
        )[0]

        pitch = float(angles[0])
        yaw = float(angles[1])
        roll = float(angles[2])

        # Calculate reprojection error.
        projected_points, _ = cv2.projectPoints(
            model_points,
            rotation_vector,
            translation_vector,
            camera_matrix,
            distortion
        )

        projected_points = projected_points.reshape(-1, 2)

        reprojection_error = float(
            np.mean(
                np.linalg.norm(
                    projected_points - image_points,
                    axis=1
                )
            )
        )

        # A large error means the generic 3D face model
        # does not adequately explain the observed image.
        reliable = (
            np.isfinite(pitch)
            and np.isfinite(yaw)
            and np.isfinite(roll)
            and np.isfinite(reprojection_error)
            and reprojection_error <= 15.0
            and abs(pitch) <= 90
            and abs(yaw) <= 90
            and abs(roll) <= 90
        )

        return {
            "available": True,
            "pitch_degrees": round(pitch, 2),
            "yaw_degrees": round(yaw, 2),
            "roll_degrees": round(roll, 2),
            "reprojection_error_pixels": round(
                reprojection_error, 2
            ),
            "reliable": reliable,
            "assessment": (
                "Provisional geometric estimate"
                if reliable
                else "Unreliable estimate - review image and calibration"
            ),
            "method": "OpenCV solvePnP with generic 3D facial geometry",
            "calibration": "Approximate camera intrinsics"
        }

    except (cv2.error, ValueError, IndexError):
        return {
            "available": False,
            "reason": "Unable to calculate head orientation."
        }

# --------------------------------------------------
# HELPER: FACE IMAGE QUALITY
# --------------------------------------------------

def analyse_face_quality(gray, x, y, w, h):

    crop = gray[y:y + h, x:x + w]

    if crop.size == 0:
        return {
            "blur_indicator": None,
            "brightness": None,
            "assessment": "Unable to assess"
        }

    blur = float(
        cv2.Laplacian(crop, cv2.CV_64F).var()
    )

    brightness = float(np.mean(crop))

    if blur < 50:
        sharpness = "Low"

    elif blur < 150:
        sharpness = "Moderate"

    else:
        sharpness = "High"

    if brightness < 60:
        lighting = "Underexposed"

    elif brightness > 200:
        lighting = "Potentially overexposed"

    else:
        lighting = "Normal brightness range"

    return {
        "blur_indicator": round(blur, 2),
        "sharpness": sharpness,
        "brightness": round(brightness, 2),
        "lighting": lighting
    }


# --------------------------------------------------
# HELPER: DRAW FACIAL LANDMARK OVERLAYS
# --------------------------------------------------

# --------------------------------------------------
# DRAW FULL FACIAL MESH AND FEATURE OVERLAYS
# --------------------------------------------------

def draw_face_landmarks(
    image,
    landmarks,
    width,
    height
):
    """
    Draw the official MediaPipe facial tessellation
    and highlighted facial feature connections.
    """

    overlay = image.copy()

    # 1. Draw all 2556 facial tessellation connections.
    for connection in FACE_MESH:

        start = landmark_to_pixel(
            landmarks[connection.start],
            width,
            height
        )

        end = landmark_to_pixel(
            landmarks[connection.end],
            width,
            height
        )

        cv2.line(
            overlay,
            start,
            end,
            (65, 170, 105),
            1,
            cv2.LINE_AA
        )

    # 2. Blend the fine mesh with the original image.
    cv2.addWeighted(
        overlay,
        0.65,
        image,
        0.35,
        0,
        image
    )

    # 3. Highlight important facial regions.
    for group in FEATURE_CONNECTION_GROUPS:

        for connection in group:

            start = landmark_to_pixel(
                landmarks[connection.start],
                width,
                height
            )

            end = landmark_to_pixel(
                landmarks[connection.end],
                width,
                height
            )

            cv2.line(
                image,
                start,
                end,
                (40, 255, 150),
                2,
                cv2.LINE_AA
            )

    # 4. Draw landmark points.
    for landmark in landmarks:

        px, py = landmark_to_pixel(
            landmark,
            width,
            height
        )

        cv2.circle(
            image,
            (px, py),
            1,
            (60, 255, 170),
            -1,
            cv2.LINE_AA
        )



# --------------------------------------------------
# MAIN FACE INTELLIGENCE FUNCTION
# --------------------------------------------------

def analyse_faces(file_bytes: bytes) -> dict:
    """
    Analyse visible facial geometry in an image.

    Provides:
    - Face count
    - Facial landmarks
    - Bounding boxes
    - Approximate head orientation
    - Face-region quality indicators
    - Annotated image

    Does not identify individuals or match identities.
    """

    # 1. Validate input.
    if not file_bytes:
        raise ValueError("Empty image file.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("Image exceeds the 10 MB limit.")

    if not MODEL_PATH.is_file():
        raise RuntimeError(
            f"Face Landmarker model not found: {MODEL_PATH}"
        )

    # 2. Decode image.
    image_array = np.frombuffer(
        file_bytes,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise ValueError("Invalid or unsupported image.")

    height, width = image.shape[:2]

    if width < 32 or height < 32:
        raise ValueError("Image dimensions are too small.")

    if width * height > 25_000_000:
        raise ValueError("Image exceeds pixel processing limits.")

    rgb_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB
    )

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_image
    )

    # 3. Configure MediaPipe.
    options = FaceLandmarkerOptions(
        base_options=BaseOptions(
            model_asset_path=str(MODEL_PATH)
        ),
        running_mode=RunningMode.IMAGE,
        num_faces=MAX_FACES,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # 4. Run actual model inference.
    with FaceLandmarker.create_from_options(options) as detector:

        result = detector.detect(mp_image)

    annotated = image.copy()

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    face_results = []

    # 5. Process every detected face.
    for face_number, landmarks in enumerate(
        result.face_landmarks,
        start=1
    ):

        if len(landmarks) < 468:
            continue

        pixel_points = [
            landmark_to_pixel(
                point,
                width,
                height
            )
            for point in landmarks
        ]

        x_coordinates = [point[0] for point in pixel_points]
        y_coordinates = [point[1] for point in pixel_points]

        x_min = min(x_coordinates)
        y_min = min(y_coordinates)
        x_max = max(x_coordinates)
        y_max = max(y_coordinates)

        face_width = x_max - x_min
        face_height = y_max - y_min

        face_area = face_width * face_height
        image_area = width * height

        # 6. Draw facial landmarks.
        draw_face_landmarks(
            annotated,
            landmarks,
            width,
            height
        )

        # 7. Draw bounding box.
        cv2.rectangle(
            annotated,
            (x_min, y_min),
            (x_max, y_max),
            (60, 220, 120),
            2
        )

        label = f"FACE {face_number}"

        cv2.putText(
            annotated,
            label,
            (x_min, max(20, y_min - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (60, 220, 120),
            2,
            cv2.LINE_AA
        )

        # 8. Estimate head orientation.
        head_pose = estimate_head_pose(
            landmarks,
            width,
            height
        )

        # 9. Assess image quality.
        quality = analyse_face_quality(
            gray,
            x_min,
            y_min,
            face_width,
            face_height
        )

        # 10. Return landmark coordinates.
        landmark_data = []

        for index, point in enumerate(landmarks):

            landmark_data.append({
                "index": index,
                "x": round(float(point.x), 6),
                "y": round(float(point.y), 6),
                "z": round(float(point.z), 6)
            })

        face_results.append({

            "face_number": face_number,

            "bounding_box": {
                "x": x_min,
                "y": y_min,
                "width": face_width,
                "height": face_height
            },

            "image_area_percentage": round(
                (face_area / image_area) * 100,
                2
            ),

            "landmark_count": len(landmarks),

            "landmarks": landmark_data,

            "head_pose": head_pose,

            "quality": quality,

            "visibility_note": (
                "Landmark detection succeeded. "
                "Occlusion is not reliably determined "
                "by this analysis."
            )
        })

    # 11. Encode annotated image.
    success, encoded_image = cv2.imencode(
        ".jpg",
        annotated,
        [cv2.IMWRITE_JPEG_QUALITY, 90]
    )

    if not success:
        raise RuntimeError(
            "Could not encode annotated image."
        )

    annotated_base64 = base64.b64encode(
        encoded_image.tobytes()
    ).decode("utf-8")

    # 12. Return structured investigation result.
    return {

        "image": {
            "width": width,
            "height": height,
            "size_bytes": len(file_bytes)
        },

        "face_analysis": {
            "faces_detected": len(face_results),
            "model": "MediaPipe Face Landmarker",
            "landmark_model": "478-point facial landmark model",
            "faces": face_results
        },

        "visualisation": {
            "format": "JPEG",
            "encoding": "base64",
            "image": annotated_base64
        },

        "limitations": [
            "Face detection does not identify a person.",
            "Landmark geometry is not a facial identity template.",
            "Head orientation is an approximate geometric estimate.",
            "Occlusion cannot be reliably established from landmarks alone.",
            "Quality indicators are diagnostic measurements.",
            "This analysis does not establish image authenticity."
        ]
    }
