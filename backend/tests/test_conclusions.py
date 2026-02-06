"""Tests for Conclusions Manager -- create, list, validate, archive, score, refine."""

from unittest.mock import patch

import pytest

from tests.conftest import MockSupabaseClient


class TestCreateConclusion:
    """create() should build a record with snapshot and insert it."""

    def test_create_returns_conclusion(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="BTC shows strength above 95k support.",
            title="Mid-bull momentum",
            category="technical",
            confidence=7,
            tags="bull,support",
        )
        assert result is not None
        assert "id" in result
        assert result["title"] == "Mid-bull momentum"

    def test_create_clamps_confidence_high(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="Test content",
            title="Test title",
            confidence=15,  # Should clamp to 10
        )
        assert result is not None
        assert result.get("confidence", 0) <= 10

    def test_create_clamps_confidence_low(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="Test content",
            title="Test title",
            confidence=-5,  # Should clamp to 1
        )
        assert result is not None
        assert result.get("confidence", 0) >= 1

    def test_create_parses_tags(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="Test content",
            title="Test title",
            tags="cycle, momentum, bull",
        )
        assert result is not None
        tags = result.get("tags", [])
        assert len(tags) == 3
        assert "cycle" in tags
        assert "momentum" in tags

    def test_create_no_tags(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="Test content",
            title="Test title",
            tags=None,
        )
        assert result is not None
        assert result.get("tags") == []

    def test_create_default_category(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(
            content="Test",
            title="Test",
        )
        assert result is not None
        assert result.get("category") == "general"

    def test_create_captures_data_snapshot(self, patched_db):
        from btc_intel.conclusions.manager import create

        result = create(content="Test", title="Snapshot test")
        assert result is not None
        snapshot = result.get("data_snapshot", {})
        # The mock DB has btc_prices data, so snapshot should have btc_price
        assert "btc_price" in snapshot


class TestListConclusions:
    """list_conclusions() returns filtered conclusions."""

    def test_list_returns_data(self, patched_db):
        from btc_intel.conclusions.manager import list_conclusions

        result = list_conclusions()
        assert isinstance(result, list)
        assert len(result) >= 1

    def test_list_empty(self, patched_db):
        from btc_intel.conclusions.manager import list_conclusions

        # Override the conclusions table to have no active items
        patched_db.set_table_data("conclusions", [])
        result = list_conclusions()
        assert result == []

    def test_list_filters_by_status(self, patched_db):
        """Only active conclusions should be returned by default."""
        from btc_intel.conclusions.manager import list_conclusions

        patched_db.set_table_data("conclusions", [
            {"id": 1, "status": "active", "title": "Active one",
             "date": "2026-02-06", "category": "technical",
             "confidence": 7, "tags": [], "validated_outcome": None,
             "created_at": "2026-02-06T10:00:00"},
            {"id": 2, "status": "archived", "title": "Archived one",
             "date": "2026-02-05", "category": "technical",
             "confidence": 5, "tags": [], "validated_outcome": None,
             "created_at": "2026-02-05T10:00:00"},
        ])
        result = list_conclusions()
        assert len(result) == 1
        assert result[0]["title"] == "Active one"

    def test_list_with_category_filter(self, patched_db):
        from btc_intel.conclusions.manager import list_conclusions

        result = list_conclusions(category="technical")
        assert isinstance(result, list)

    def test_list_with_limit(self, patched_db):
        from btc_intel.conclusions.manager import list_conclusions

        result = list_conclusions(limit=5)
        assert isinstance(result, list)


class TestValidateConclusion:
    """validate() marks a conclusion as correct/incorrect/partial."""

    def test_validate_correct(self, patched_db):
        from btc_intel.conclusions.manager import validate

        patched_db.set_table_data("conclusions", [
            {"id": 1, "title": "Test", "validated_outcome": None},
        ])
        result = validate(1, "correct")
        assert result is not None
        assert result.get("validated_outcome") == "correct"

    def test_validate_incorrect(self, patched_db):
        from btc_intel.conclusions.manager import validate

        patched_db.set_table_data("conclusions", [
            {"id": 1, "title": "Test", "validated_outcome": None},
        ])
        result = validate(1, "incorrect")
        assert result.get("validated_outcome") == "incorrect"

    def test_validate_partial(self, patched_db):
        from btc_intel.conclusions.manager import validate

        patched_db.set_table_data("conclusions", [
            {"id": 1, "title": "Test", "validated_outcome": None},
        ])
        result = validate(1, "partial")
        assert result.get("validated_outcome") == "partial"

    def test_validate_invalid_outcome(self, patched_db):
        from btc_intel.conclusions.manager import validate

        result = validate(1, "maybe")
        assert result == {}

    def test_validate_sets_date(self, patched_db):
        from btc_intel.conclusions.manager import validate

        patched_db.set_table_data("conclusions", [
            {"id": 1, "title": "Test", "validated_outcome": None},
        ])
        result = validate(1, "correct")
        assert result.get("validated_at") is not None


class TestArchiveConclusion:
    """archive() sets status to archived."""

    def test_archive_does_not_crash(self, patched_db):
        from btc_intel.conclusions.manager import archive

        patched_db.set_table_data("conclusions", [
            {"id": 1, "status": "active"},
        ])
        # Should not raise
        archive(1)


class TestRefineConclusion:
    """refine() creates a new version linked to the original."""

    def test_refine_creates_new_record(self, patched_db):
        from btc_intel.conclusions.manager import refine

        patched_db.set_table_data("conclusions", [
            {
                "id": 1, "title": "Original", "content": "Old content",
                "category": "technical", "confidence": 7,
                "source": "claude", "tags": ["bull"],
            },
        ])

        result = refine(1, "Updated analysis with new data.")
        assert result is not None
        assert "id" in result
        assert "[Refinamiento]" in result.get("title", "")

    def test_refine_nonexistent_returns_empty(self, patched_db):
        """When conclusion_id does not match any record, return {}."""
        from btc_intel.conclusions.manager import refine

        # The table has a record with id=1, but we query for id=999.
        # Since our mock's eq filter will match on "id"==999, which
        # is not present, the select returns empty -> function returns {}.
        patched_db.set_table_data("conclusions", [
            {"id": 1, "title": "Exists", "content": "Content",
             "category": "technical", "confidence": 5,
             "source": "claude", "tags": []},
        ])
        result = refine(999, "New content")
        assert result == {}

    def test_refine_preserves_parent_metadata(self, patched_db):
        from btc_intel.conclusions.manager import refine

        patched_db.set_table_data("conclusions", [
            {
                "id": 5, "title": "Parent", "content": "Content",
                "category": "onchain", "confidence": 8,
                "source": "user", "tags": ["mining", "hash"],
            },
        ])

        result = refine(5, "Refined content")
        assert result is not None
        assert result.get("category") == "onchain"
        assert result.get("confidence") == 8
        assert result.get("parent_id") == 5


class TestScoreConclusions:
    """score() calculates prediction accuracy."""

    def test_score_no_validated(self, patched_db):
        """When no conclusions have validated_outcome, return total=0."""
        from btc_intel.conclusions.manager import score

        # All conclusions have validated_outcome == None, so neq(None) filters them out
        patched_db.set_table_data("conclusions", [
            {"validated_outcome": None, "confidence": 5, "category": "general"},
        ])
        result = score()
        assert result["total"] == 0

    def test_score_all_correct(self, patched_db):
        from btc_intel.conclusions.manager import score

        patched_db.set_table_data("conclusions", [
            {"validated_outcome": "correct", "confidence": 7, "category": "technical"},
            {"validated_outcome": "correct", "confidence": 8, "category": "technical"},
        ])

        result = score()
        assert result["total"] == 2
        assert result["correct"] == 2
        assert result["accuracy"] == 100.0

    def test_score_mixed_outcomes(self, patched_db):
        from btc_intel.conclusions.manager import score

        patched_db.set_table_data("conclusions", [
            {"validated_outcome": "correct", "confidence": 7, "category": "technical"},
            {"validated_outcome": "partial", "confidence": 5, "category": "sentiment"},
            {"validated_outcome": "incorrect", "confidence": 3, "category": "technical"},
            {"validated_outcome": "incorrect", "confidence": 4, "category": "onchain"},
        ])

        result = score()
        assert result["total"] == 4
        assert result["correct"] == 1
        assert result["partial"] == 1
        assert result["incorrect"] == 2
        # accuracy = (1 + 0.5*1) / 4 * 100 = 37.5
        assert result["accuracy"] == 37.5

    def test_score_by_category(self, patched_db):
        from btc_intel.conclusions.manager import score

        patched_db.set_table_data("conclusions", [
            {"validated_outcome": "correct", "confidence": 7, "category": "technical"},
            {"validated_outcome": "incorrect", "confidence": 5, "category": "sentiment"},
        ])

        result = score()
        assert "technical" in result["by_category"]
        assert "sentiment" in result["by_category"]
        assert result["by_category"]["technical"]["correct"] == 1
        assert result["by_category"]["sentiment"]["incorrect"] == 1
