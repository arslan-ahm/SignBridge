"""Shared landmark-to-feature conversion, used by collection, training, and the live app.

Keeping this in one place matters: collection, training, and inference must
normalize landmarks identically or the trained model will see different
numbers at inference time than it saw during training.
"""

NUM_HANDS = 2
NUM_POINTS = 21
COORDS = 3
VECTOR_LENGTH = NUM_HANDS * NUM_POINTS * COORDS  # 126


def _normalize_single_hand(landmarks):
    """Make one hand's landmarks translation- and scale-invariant.

    Wrist (landmark 0) becomes the origin; coordinates are scaled by the
    hand's own size. This is what lets the model recognize a sign whether
    it's signed close to the camera or far away.
    """
    xs = [p.x for p in landmarks]
    ys = [p.y for p in landmarks]
    zs = [p.z for p in landmarks]

    origin_x, origin_y, origin_z = xs[0], ys[0], zs[0]
    shifted = [(x - origin_x, y - origin_y, z - origin_z) for x, y, z in zip(xs, ys, zs)]

    scale = max((x ** 2 + y ** 2) ** 0.5 for x, y, _ in shifted) or 1.0

    flat = []
    for x, y, z in shifted:
        flat.extend([x / scale, y / scale, z / scale])
    return flat


def landmarks_to_vector(hand_landmarks_list, handedness_list=None):
    """Convert a MediaPipe Tasks HandLandmarker result into a fixed-length feature vector.

    Expects the *Tasks API* shapes (mediapipe>=1.0, `mediapipe.tasks.python.vision.HandLandmarker`):
      hand_landmarks_list: result.hand_landmarks -> list[list[landmark]], each landmark has .x .y .z
      handedness_list:     result.handedness -> list[list[Category]], each Category has .category_name

    Always returns a VECTOR_LENGTH-long list: left-hand slot first, then
    right-hand slot, zero-filled when a hand isn't visible. Fixed slot order
    (rather than "first detected hand, second detected hand") matters for
    two-handed signs, so a sign doesn't get scrambled if MediaPipe happens to
    report the hands in a different order between frames.
    """
    vector = [0.0] * VECTOR_LENGTH

    if not hand_landmarks_list:
        return vector

    for idx, hand_landmarks in enumerate(hand_landmarks_list):
        slot = idx
        if handedness_list and idx < len(handedness_list):
            label = handedness_list[idx][0].category_name  # "Left" / "Right"
            slot = 0 if label == "Left" else 1
        elif idx > 1:
            continue

        if slot > 1:
            continue

        normalized = _normalize_single_hand(hand_landmarks)
        start = slot * NUM_POINTS * COORDS
        vector[start:start + NUM_POINTS * COORDS] = normalized

    return vector


def feature_columns():
    return [f"f{i}" for i in range(VECTOR_LENGTH)]
