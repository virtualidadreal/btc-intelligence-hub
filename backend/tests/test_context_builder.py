"""Tests for Context Builder -- each scope returns valid string output."""

from datetime import date
from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import MockSupabaseClient


def _build_full_mock_client() -> MockSupabaseClient:
    """Creates a MockSupabaseClient with data for all formatter sections."""
    client = MockSupabaseClient()

    client.set_table_data("btc_prices", [
        {"date": "2026-02-06", "close": "98000"},
        {"date": "2026-02-05", "close": "97000"},
        {"date": "2026-01-30", "close": "92000"},
        {"date": "2026-01-06", "close": "85000"},
    ])

    client.set_table_data("cycle_score_history", [
        {"date": "2026-02-06", "score": 62, "phase": "mid_bull"},
        {"date": "2026-02-05", "score": 60, "phase": "mid_bull"},
    ])

    client.set_table_data("technical_indicators", [
        {"indicator": "RSI_14", "date": "2026-02-06", "value": 55.3, "signal": "bullish"},
        {"indicator": "SMA_CROSS", "date": "2026-02-06", "value": 5000, "signal": "bullish"},
        {"indicator": "MACD", "date": "2026-02-06", "value": 120, "signal": "bullish"},
        {"indicator": "BB_UPPER", "date": "2026-02-06", "value": 102000, "signal": "neutral"},
        {"indicator": "BB_LOWER", "date": "2026-02-06", "value": 88000, "signal": "neutral"},
        {"indicator": "ATR_14", "date": "2026-02-06", "value": 3500, "signal": "neutral"},
        {"indicator": "CORR_BTC_SPX_30D", "date": "2026-02-06", "value": 0.45},
        {"indicator": "CORR_BTC_GOLD_30D", "date": "2026-02-06", "value": 0.12},
        {"indicator": "CORR_BTC_DXY_30D", "date": "2026-02-06", "value": -0.35},
        {"indicator": "CORR_BTC_SPX_90D", "date": "2026-02-06", "value": 0.50},
        {"indicator": "CORR_BTC_GOLD_90D", "date": "2026-02-06", "value": 0.20},
        {"indicator": "CORR_BTC_DXY_90D", "date": "2026-02-06", "value": -0.40},
    ])

    client.set_table_data("sentiment_data", [
        {"metric": "FEAR_GREED", "date": "2026-02-06", "value": "65"},
        {"metric": "FEAR_GREED_30D", "date": "2026-02-06", "value": "58.5"},
    ])

    client.set_table_data("onchain_metrics", [
        {"metric": "HASH_RATE_MOM_30D", "date": "2026-02-06", "value": 5.2, "signal": "bullish"},
        {"metric": "NVT_RATIO", "date": "2026-02-06", "value": 72.5, "signal": "neutral"},
    ])

    client.set_table_data("alerts", [])
    client.set_table_data("conclusions", [])
    client.set_table_data("events", [])

    return client


# Patch paths for the lazy imports in formatters.py
_CONFLUENCE_PATCH = "btc_intel.analysis.confluence_detector.detect_confluences"
_RISK_PATCH = "btc_intel.analysis.risk.analyze_risk"
_CYCLES_PATCH = "btc_intel.analysis.cycles.analyze_cycles"

_CONFLUENCE_RETURN = {
    "confluences": [],
    "bullish_count": 3,
    "bearish_count": 1,
    "neutral_count": 2,
}
_RISK_RETURN = {
    "current_drawdown": -5,
    "volatility_30d": 3.2,
    "sharpe_365d": 1.5,
    "var_95": -8,
}
_CYCLES_RETURN = {
    "cycle_number": 4,
    "last_halving": "2024-04-20",
    "days_since_halving": 657,
    "halving_price": 65000,
    "current_price": 98000,
    "roi_since_halving": 50.77,
    "comparisons": {},
}


class TestBuildContextSummary:
    """scope='summary' should produce a concise overview."""

    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_summary_returns_string(self, _mock_confl):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="summary")

        assert isinstance(result, str)
        assert len(result) > 0

    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_summary_contains_header(self, _mock_confl):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="summary")

        assert "Resumen" in result

    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_summary_contains_price(self, _mock_confl):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="summary")

        assert "98,000" in result or "98000" in result

    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_summary_contains_cycle_score(self, _mock_confl):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="summary")

        assert "Cycle Score" in result
        assert "62" in result


class TestBuildContextMorning:
    """scope='morning' should include summary + changes and events."""

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_morning_returns_string(self, _mock_confl, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="morning")

        assert isinstance(result, str)
        assert len(result) > 0

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_morning_contains_header(self, _mock_confl, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="morning")

        assert "Morning Briefing" in result

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    @patch(_CONFLUENCE_PATCH, return_value=_CONFLUENCE_RETURN)
    def test_morning_includes_changes_section(self, _mock_confl, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="morning")

        assert "Cambios desde Ayer" in result


class TestBuildContextDeep:
    """scope='deep' should include detailed data for a specific area."""

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    def test_deep_technical_returns_string(self, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="deep", area="technical")

        assert isinstance(result, str)
        assert "TECHNICAL" in result

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    def test_deep_onchain(self, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="deep", area="onchain")

        assert isinstance(result, str)
        assert "ONCHAIN" in result

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    def test_deep_unknown_area(self, _mock_risk):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="deep", area="unknown_area")

        assert isinstance(result, str)
        assert "desconocida" in result.lower() or "unknown_area" in result.lower()

    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    def test_deep_defaults_to_technical(self, _mock_risk):
        """When area is None, deep should default to 'technical'."""
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="deep")

        assert isinstance(result, str)
        assert "TECHNICAL" in result

    @patch(_CYCLES_PATCH, return_value=_CYCLES_RETURN)
    @patch(_RISK_PATCH, return_value=_RISK_RETURN)
    def test_deep_cycle(self, _mock_risk, _mock_cycles):
        """Deep cycle area should include cycle analysis detail."""
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="deep", area="cycle")

        assert isinstance(result, str)
        assert "CYCLE" in result


class TestBuildContextCompare:
    """scope='compare' should show two periods side by side."""

    def test_compare_returns_string(self):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="compare", period1="2025-12-01", period2="2026-02-06")

        assert isinstance(result, str)
        assert "Comparativa" in result

    def test_compare_includes_periods(self):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="compare", period1="2025-12-01", period2="2026-02-06")

        assert "2025-12-01" in result
        assert "2026-02-06" in result

    def test_compare_defaults_periods(self):
        """When no periods specified, should use today - 30d and today."""
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="compare")

        assert isinstance(result, str)
        assert "Comparativa" in result


class TestBuildContextUnknownScope:
    """Unknown scopes should return an error message."""

    def test_unknown_scope(self):
        client = _build_full_mock_client()
        with patch("btc_intel.db.get_supabase", return_value=client):
            from btc_intel.context.builder import build_context
            result = build_context(scope="nonexistent")

        assert "desconocido" in result.lower() or "nonexistent" in result.lower()
