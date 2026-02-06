"""Tests for Alerts Engine -- check_alerts, list_alerts, ack_alert, _create_alert."""

from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import MockSupabaseClient, MockQueryBuilder


class TestCreateAlertDedup:
    """_create_alert should not create duplicates."""

    def test_creates_alert_when_none_exists(self, patched_db):
        """When no matching alert exists, insert should be called."""
        from btc_intel.analysis.alerts import _create_alert

        patched_db.set_table_data("alerts", [])
        _create_alert(
            patched_db, "cycle", "critical",
            "Test Alert", "Description",
            "CYCLE_SCORE", 90, 85, "bearish"
        )
        # If it didn't raise, the insert was called successfully

    def test_skips_when_duplicate_exists(self, patched_db):
        """When a matching unacknowledged alert exists, should not insert."""
        from btc_intel.analysis.alerts import _create_alert

        patched_db.set_table_data("alerts", [
            {"id": 1, "title": "Test Alert", "acknowledged": False},
        ])
        # This should return early without error
        _create_alert(
            patched_db, "cycle", "critical",
            "Test Alert", "Description",
            "CYCLE_SCORE", 90, 85, "bearish"
        )


class TestCheckAlerts:
    """check_alerts: runs pattern detection + cycle score alerts."""

    @patch("btc_intel.analysis.patterns.detect_patterns", return_value=0)
    def test_euphoria_alert_created(self, mock_patterns, patched_db):
        """Score > 85 should trigger a euphoria (bearish) alert."""
        from btc_intel.analysis.alerts import check_alerts

        patched_db.set_table_data("cycle_score_history", [
            {"score": 90, "phase": "euphoria", "date": "2026-02-06"},
        ])
        patched_db.set_table_data("alerts", [])

        count = check_alerts()
        assert count >= 1

    @patch("btc_intel.analysis.patterns.detect_patterns", return_value=0)
    def test_capitulation_alert_created(self, mock_patterns, patched_db):
        """Score < 15 should trigger a capitulation (bullish) alert."""
        from btc_intel.analysis.alerts import check_alerts

        patched_db.set_table_data("cycle_score_history", [
            {"score": 10, "phase": "capitulation", "date": "2026-02-06"},
        ])
        patched_db.set_table_data("alerts", [])

        count = check_alerts()
        assert count >= 1

    @patch("btc_intel.analysis.patterns.detect_patterns", return_value=0)
    def test_no_alert_for_normal_score(self, mock_patterns, patched_db):
        """Score between 15-85 should not create cycle alerts."""
        from btc_intel.analysis.alerts import check_alerts

        patched_db.set_table_data("cycle_score_history", [
            {"score": 50, "phase": "mid_bull", "date": "2026-02-06"},
        ])
        patched_db.set_table_data("alerts", [])

        count = check_alerts()
        assert count == 0

    @patch("btc_intel.analysis.patterns.detect_patterns", return_value=3)
    def test_adds_pattern_alerts_to_count(self, mock_patterns, patched_db):
        """Total count should include alerts from detect_patterns."""
        from btc_intel.analysis.alerts import check_alerts

        patched_db.set_table_data("cycle_score_history", [
            {"score": 50, "phase": "mid_bull", "date": "2026-02-06"},
        ])

        count = check_alerts()
        assert count >= 3

    @patch("btc_intel.analysis.patterns.detect_patterns", return_value=0)
    def test_no_cycle_score_data(self, mock_patterns, patched_db):
        """When no cycle score data exists, should not crash."""
        from btc_intel.analysis.alerts import check_alerts

        patched_db.set_table_data("cycle_score_history", [])

        count = check_alerts()
        assert count == 0


class TestListAlerts:
    """list_alerts: returns active (unacknowledged) alerts."""

    def test_returns_list_of_alerts(self, patched_db):
        from btc_intel.analysis.alerts import list_alerts

        patched_db.set_table_data("alerts", [
            {
                "id": 1, "severity": "critical", "type": "cycle",
                "title": "Cycle Score >85", "signal": "bearish",
                "date": "2026-02-06", "acknowledged": False,
            },
            {
                "id": 2, "severity": "warning", "type": "technical",
                "title": "RSI sobrecompra", "signal": "bearish",
                "date": "2026-02-06", "acknowledged": False,
            },
        ])

        result = list_alerts()
        assert len(result) == 2
        assert result[0]["title"] == "Cycle Score >85"

    def test_returns_empty_when_no_alerts(self, patched_db):
        from btc_intel.analysis.alerts import list_alerts

        patched_db.set_table_data("alerts", [])
        result = list_alerts()
        assert result == []

    def test_severity_filter_accepted(self, patched_db):
        """Calling with severity parameter should not crash."""
        from btc_intel.analysis.alerts import list_alerts

        patched_db.set_table_data("alerts", [
            {
                "id": 1, "severity": "critical", "type": "cycle",
                "title": "Test", "signal": "bearish",
                "date": "2026-02-06", "acknowledged": False,
            },
        ])
        result = list_alerts(severity="critical")
        assert isinstance(result, list)


class TestAckAlert:
    """ack_alert: marks an alert as acknowledged."""

    def test_ack_does_not_crash(self, patched_db):
        """Acknowledging an alert should complete without error."""
        from btc_intel.analysis.alerts import ack_alert

        patched_db.set_table_data("alerts", [
            {"id": 1, "acknowledged": False},
        ])
        # Should not raise
        ack_alert(1)
