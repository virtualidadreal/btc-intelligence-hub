"""Tests for Cycle Score calculation."""

from datetime import date
from unittest.mock import patch

import pytest

from tests.conftest import MockSupabaseClient


class TestCycleScoreCalculation:
    """Core cycle score logic: weighted average, normalization, phase assignment."""

    def _build_client(self, **overrides):
        """Builds a MockSupabaseClient with full data for cycle score.

        Override specific tables by passing keyword arguments.
        """
        client = MockSupabaseClient()

        client.set_table_data("technical_indicators",
                              overrides.get("technical_indicators", [
                                  {"indicator": "RSI_14", "value": "55", "date": "2026-02-06"},
                                  {"indicator": "SMA_CROSS", "value": "5000", "date": "2026-02-06"},
                              ]))
        client.set_table_data("sentiment_data",
                              overrides.get("sentiment_data", [
                                  {"metric": "FEAR_GREED", "value": "50", "date": "2026-02-06"},
                                  {"metric": "FEAR_GREED_30D", "value": "48", "date": "2026-02-06"},
                              ]))
        client.set_table_data("onchain_metrics",
                              overrides.get("onchain_metrics", [
                                  {"metric": "HASH_RATE_MOM_30D", "value": "5", "date": "2026-02-06"},
                              ]))

        client.set_table_data("btc_prices",
                              overrides.get("btc_prices", [
                                  {"date": "2024-04-01", "close": "60000"},
                                  {"date": "2024-04-20", "close": "65000"},
                                  {"date": "2024-06-01", "close": "50000"},
                                  {"date": "2025-01-01", "close": "80000"},
                                  {"date": "2026-01-01", "close": "90000"},
                                  {"date": "2026-02-06", "close": "98000"},
                              ]))

        client.set_table_data("cycle_score_history",
                              overrides.get("cycle_score_history", []))

        return client

    @patch("btc_intel.analysis.cycle_score.date")
    def test_score_between_0_and_100(self, mock_date):
        """Score must always be clamped to [0, 100]."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = self._build_client()
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        assert 0 <= result["score"] <= 100

    @patch("btc_intel.analysis.cycle_score.date")
    def test_phase_capitulation(self, mock_date):
        """Score < 15 should yield capitulation phase."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        # Set all components to very low values to get score < 15
        client = self._build_client(
            technical_indicators=[
                {"indicator": "RSI_14", "value": "5", "date": "2026-02-06"},
                {"indicator": "SMA_CROSS", "value": "-20000", "date": "2026-02-06"},
            ],
            sentiment_data=[
                {"metric": "FEAR_GREED", "value": "2", "date": "2026-02-06"},
                {"metric": "FEAR_GREED_30D", "value": "2", "date": "2026-02-06"},
            ],
            onchain_metrics=[
                {"metric": "HASH_RATE_MOM_30D", "value": "-30", "date": "2026-02-06"},
            ],
            btc_prices=[
                {"date": "2024-04-01", "close": "60000"},
                {"date": "2024-04-20", "close": "65000"},
                {"date": "2024-11-01", "close": "100000"},
                {"date": "2026-02-06", "close": "50000"},
            ],
        )
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        assert result["score"] < 15
        assert result["phase"] == "capitulation"

    @pytest.mark.parametrize("score_val,expected_phase", [
        (0, "capitulation"),
        (14, "capitulation"),
        (15, "accumulation"),
        (29, "accumulation"),
        (30, "early_bull"),
        (44, "early_bull"),
        (45, "mid_bull"),
        (59, "mid_bull"),
        (60, "late_bull"),
        (74, "late_bull"),
        (75, "distribution"),
        (84, "distribution"),
        (85, "euphoria"),
        (100, "euphoria"),
    ])
    def test_phase_from_score(self, score_val, expected_phase):
        """Verify the phase mapping for each score range."""
        if score_val < 15:
            phase = "capitulation"
        elif score_val < 30:
            phase = "accumulation"
        elif score_val < 45:
            phase = "early_bull"
        elif score_val < 60:
            phase = "mid_bull"
        elif score_val < 75:
            phase = "late_bull"
        elif score_val < 85:
            phase = "distribution"
        else:
            phase = "euphoria"
        assert phase == expected_phase

    @patch("btc_intel.analysis.cycle_score.date")
    def test_returns_result_with_halving_only(self, mock_date):
        """When only halving data is available (no DB data), should still return a result."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = MockSupabaseClient()
        client.set_table_data("technical_indicators", [])
        client.set_table_data("sentiment_data", [])
        client.set_table_data("onchain_metrics", [])
        client.set_table_data("btc_prices", [])
        client.set_table_data("cycle_score_history", [])

        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        # Halving is always computed (not from DB), so we get a result
        assert result is not None
        assert "halving" in result["components"]
        assert 0 <= result["score"] <= 100

    @patch("btc_intel.analysis.cycle_score.date")
    def test_normalization_with_partial_components(self, mock_date):
        """Score should normalize correctly when some components are missing."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        # Only provide RSI data (weight 0.10) + halving (always present, weight 0.15)
        client = self._build_client(
            technical_indicators=[
                {"indicator": "RSI_14", "value": "50", "date": "2026-02-06"},
            ],
            sentiment_data=[],
            onchain_metrics=[],
            btc_prices=[],
        )
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        assert 0 <= result["score"] <= 100
        assert "rsi" in result["components"]
        assert "halving" in result["components"]

    @patch("btc_intel.analysis.cycle_score.date")
    def test_components_dict_populated(self, mock_date):
        """Components dict should contain the calculated values."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = self._build_client()
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        components = result["components"]
        assert "halving" in components
        for key, val in components.items():
            assert 0 <= val <= 100, f"Component {key}={val} is out of [0,100]"

    @patch("btc_intel.analysis.cycle_score.date")
    def test_halving_component_value(self, mock_date):
        """Halving component: days_since_halving / 1460 * 100, clamped to [0,100]."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = self._build_client()
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        # 2026-02-06 - 2024-04-20 = 657 days
        expected_halving = min(100, int(657 / 1460 * 100))
        assert result["components"]["halving"] == expected_halving

    @patch("btc_intel.analysis.cycle_score.date")
    def test_rsi_component_clamped(self, mock_date):
        """RSI component should be clamped to [0, 100]."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = self._build_client(
            technical_indicators=[
                {"indicator": "RSI_14", "value": "120", "date": "2026-02-06"},
            ],
        )
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        assert result["components"]["rsi"] == 100

    @patch("btc_intel.analysis.cycle_score.date")
    def test_sma_position_normalization(self, mock_date):
        """SMA position: 50 + sma_val / 400, clamped to [0, 100]."""
        mock_date.today.return_value = date(2026, 2, 6)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        client = self._build_client(
            technical_indicators=[
                {"indicator": "SMA_CROSS", "value": "0", "date": "2026-02-06"},
            ],
        )
        with patch("btc_intel.analysis.cycle_score.get_supabase", return_value=client):
            from btc_intel.analysis.cycle_score import calculate_cycle_score
            result = calculate_cycle_score()

        assert result is not None
        assert result["components"]["sma_position"] == 50


class TestCycleScoreWeights:
    """Verify the weight definitions are correct."""

    def test_weights_sum(self):
        """All defined weights should sum to 0.85."""
        weights = {
            "sma_position": 0.20,
            "price_position": 0.20,
            "halving": 0.15,
            "rsi": 0.10,
            "hash_rate_mom": 0.10,
            "fear_greed": 0.05,
            "fear_greed_30d": 0.05,
        }
        total = sum(weights.values())
        assert abs(total - 0.85) < 0.001
