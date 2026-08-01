"""Turn MediaPipe hand landmarks into the flat feature vector our model expects.

Matches extract_landmarks.py exactly: 21 landmarks x (x, y) for a single hand,
raw MediaPipe-normalized image coordinates (no wrist-relative re-centering) --
the model was trained on vectors built this way, so inference must build them
the same way to avoid a train/serve mismatch.
"""
VECTOR_LENGTH = 42


def feature_columns():
    columns = []
    for i in range(21):
        columns.extend([f"x{i}", f"y{i}"])
    return columns


def landmarks_to_vector(hand_landmarks_list, handedness_list=None):
    """hand_landmarks_list: list of hands, each a list of 21 landmark objects
    with .x/.y attributes (as returned by hand_landmarker.detect_in_*). Uses
    the first detected hand only, matching the single-hand training data."""
    if not hand_landmarks_list:
        return [0.0] * VECTOR_LENGTH

    hand = hand_landmarks_list[0]
    vector = []
    for lm in hand:
        vector.extend([lm.x, lm.y])
    return vector
