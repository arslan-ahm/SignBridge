"""Turn MediaPipe hand landmarks into the flat feature vector our model expects.

21 landmarks x (x, y) for a single hand = 42 numbers, made wrist-relative and
scale-normalized (see normalize_vector) so the model learns actual letter
shapes instead of where in the frame the hand happens to sit or how big it
appears. We switched to this after cross-dataset testing showed the earlier
raw-coordinate model scored 99.68% on its own held-out split but only ~20%
on a genuinely independent dataset -- classic overfitting to one dataset's
framing. website/js/app.js intentionally sends RAW (unnormalized) landmarks
and lets backend/api/app.py's /predict-vector call normalize_vector() below
-- normalization lives in exactly one place so the JS and Python copies can
never drift apart.
"""
VECTOR_LENGTH = 42


def feature_columns():
    columns = []
    for i in range(21):
        columns.extend([f"x{i}", f"y{i}"])
    return columns


def normalize_vector(flat_xy):
    """flat_xy: 42 raw numbers [x0,y0,x1,y1,...,x20,y20]. Returns the same
    shape, translated so the wrist (landmark 0) is the origin and scaled by
    the farthest landmark's distance from the wrist, so the result doesn't
    depend on the hand's position in frame or its size/distance from camera."""
    import numpy as np

    pts = np.asarray(flat_xy, dtype=np.float64).reshape(21, 2)
    wrist = pts[0].copy()
    pts = pts - wrist

    scale = float(np.linalg.norm(pts, axis=1).max())
    if scale < 1e-6:
        scale = 1.0
    pts = pts / scale

    return pts.reshape(-1).tolist()


def landmarks_to_vector(hand_landmarks_list, handedness_list=None):
    """hand_landmarks_list: list of hands, each a list of 21 landmark objects
    with .x/.y attributes (as returned by hand_landmarker.detect_in_*). Uses
    the first detected hand only, matching the single-hand training data."""
    if not hand_landmarks_list:
        return [0.0] * VECTOR_LENGTH

    hand = hand_landmarks_list[0]
    flat = []
    for lm in hand:
        flat.extend([lm.x, lm.y])
    return normalize_vector(flat)
