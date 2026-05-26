"""Unit tests for domain types used in test generation.

Tests BoundedInt, ChoiceSet, and Constant domain abstractions.
"""

import pytest
from skills.lib.workflow.types import BoundedInt, ChoiceSet, Constant


class TestBoundedInt:
    """Tests for BoundedInt domain type."""

    def test_normal_range(self):
        """BoundedInt(1, 3) yields [1, 2, 3]."""
        domain = BoundedInt(1, 3)
        assert list(domain) == [1, 2, 3]

    def test_single_value(self):
        """BoundedInt(5, 5) yields [5] (single value)."""
        domain = BoundedInt(5, 5)
        assert list(domain) == [5]

    def test_larger_range(self):
        """BoundedInt(1, 5) yields [1, 2, 3, 4, 5]."""
        domain = BoundedInt(1, 5)
        assert list(domain) == [1, 2, 3, 4, 5]

    def test_validation_lo_greater_than_hi(self):
        """BoundedInt(5, 1) raises ValueError."""
        with pytest.raises(ValueError, match="lo \\(5\\) must be <= hi \\(1\\)"):
            BoundedInt(5, 1)

    def test_hashable(self):
        """BoundedInt is hashable (frozen)."""
        domain = BoundedInt(1, 5)
        assert hash(domain) is not None
        # Can be used in sets
        domain_set = {BoundedInt(1, 5), BoundedInt(1, 5)}
        assert len(domain_set) == 1

    def test_negative_range(self):
        """BoundedInt works with negative bounds."""
        domain = BoundedInt(-3, 0)
        assert list(domain) == [-3, -2, -1, 0]


class TestChoiceSet:
    """Tests for ChoiceSet domain type."""

    def test_multiple_choices(self):
        """ChoiceSet(("a", "b")) yields ["a", "b"]."""
        domain = ChoiceSet(("a", "b"))
        assert list(domain) == ["a", "b"]

    def test_single_choice(self):
        """ChoiceSet with single choice."""
        domain = ChoiceSet(("only",))
        assert list(domain) == ["only"]

    def test_hashable(self):
        """ChoiceSet is hashable (frozen)."""
        domain = ChoiceSet(("a", "b"))
        assert hash(domain) is not None
        # Can be used in sets
        domain_set = {ChoiceSet(("a", "b")), ChoiceSet(("a", "b"))}
        assert len(domain_set) == 1

    def test_numeric_choices(self):
        """ChoiceSet works with non-string values."""
        domain = ChoiceSet((1, 2, 3))
        assert list(domain) == [1, 2, 3]

    def test_mixed_type_choices(self):
        """ChoiceSet preserves order and types."""
        domain = ChoiceSet(("full", "quick"))
        assert list(domain) == ["full", "quick"]


class TestConstant:
    """Tests for Constant domain type."""

    def test_single_value(self):
        """Constant(42) yields [42]."""
        domain = Constant(42)
        assert list(domain) == [42]

    def test_none_value(self):
        """Constant with None value."""
        domain = Constant(None)
        assert list(domain) == [None]

    def test_string_value(self):
        """Constant works with string values."""
        domain = Constant("test")
        assert list(domain) == ["test"]

    def test_hashable(self):
        """Constant is hashable (frozen) when value is hashable."""
        domain = Constant(42)
        assert hash(domain) is not None
        # Can be used in sets
        domain_set = {Constant(42), Constant(42)}
        assert len(domain_set) == 1

    def test_complex_value(self):
        """Constant can hold tuples (hashable complex values)."""
        domain = Constant((1, 2, 3))
        assert list(domain) == [(1, 2, 3)]
