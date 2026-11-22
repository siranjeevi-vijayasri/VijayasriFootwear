import numpy as np
import pytest
from app import _suggest_landmarks

def make_foot_mask():
    cv2 = pytest.importorskip("cv2")
    mask = np.zeros((600, 400), dtype=np.uint8)
    cv2.ellipse(mask, (200, 300), (72, 190), 0, 0, 360, 1, -1)
    cv2.ellipse(mask, (200, 150), (78, 85), 0, 0, 360, 1, -1)
    cv2.ellipse(mask, (200, 480), (55, 65), 0, 0, 360, 1, -1)
    return mask

def test_landmark_coordinates_are_normalized():
    result = _suggest_landmarks(make_foot_mask())
    assert set(result) == {"toe", "heel", "right_width", "left_width"}
    for point in result.values():
        assert 0 <= point["x"] <= 1
        assert 0 <= point["y"] <= 1

def test_toe_is_above_heel_for_portrait_capture():
    result = _suggest_landmarks(make_foot_mask())
    assert result["toe"]["y"] < result["heel"]["y"]
    assert result["left_width"]["x"] < result["right_width"]["x"]
