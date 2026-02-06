"""Shared fixtures for BTC Intelligence Hub tests.

Provides a mock Supabase client that simulates table queries without
requiring a real database connection.  The MockQueryBuilder performs
basic eq/neq filtering so tests can set_table_data with mixed records
and have queries return the correct subset.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers to build a fluent mock that mimics the Supabase query builder
# ---------------------------------------------------------------------------

class MockQueryBuilder:
    """Simulates the Supabase chained query API (.select().eq().order()...).

    Supports basic eq/neq filtering against the in-memory data so that
    queries like .eq("indicator", "RSI_14") only return matching rows.
    """

    def __init__(self, data: list[dict] | None = None):
        self._data = list(data) if data is not None else []
        self._filters_eq: list[tuple[str, object]] = []
        self._filters_neq: list[tuple[str, object]] = []

    def _clone(self) -> "MockQueryBuilder":
        """Return a shallow copy that shares the same data list."""
        c = MockQueryBuilder(self._data)
        c._filters_eq = list(self._filters_eq)
        c._filters_neq = list(self._filters_neq)
        return c

    # -- chaining methods that just return self --

    def select(self, *_a, **_kw):
        return self

    def eq(self, field, value):
        c = self._clone()
        c._filters_eq.append((field, value))
        return c

    def neq(self, field, value):
        c = self._clone()
        c._filters_neq.append((field, value))
        return c

    def gte(self, *_a, **_kw):
        return self

    def lte(self, *_a, **_kw):
        return self

    def order(self, *_a, **_kw):
        return self

    def limit(self, *_a, **_kw):
        return self

    # -- mutating methods --

    def insert(self, record, **_kw):
        result = {**record, "id": 1, "created_at": "2026-02-06T00:00:00"}
        c = self._clone()
        c._data = [result]
        c._filters_eq = []
        c._filters_neq = []
        return c

    def update(self, fields, **_kw):
        c = self._clone()
        filtered = c._apply_filters()
        if filtered:
            c._data = [{**filtered[0], **fields}]
        else:
            c._data = [fields]
        c._filters_eq = []
        c._filters_neq = []
        return c

    def upsert(self, record, **_kw):
        c = self._clone()
        c._data = [record]
        c._filters_eq = []
        c._filters_neq = []
        return c

    # -- terminal --

    def _apply_filters(self) -> list[dict]:
        result = self._data
        for field, value in self._filters_eq:
            result = [r for r in result if r.get(field) == value]
        for field, value in self._filters_neq:
            result = [r for r in result if r.get(field) != value]
        return result

    def execute(self):
        resp = MagicMock()
        resp.data = self._apply_filters()
        return resp


class MockSupabaseClient:
    """A configurable mock that routes table names to MockQueryBuilder instances.

    Usage in tests:
        client = MockSupabaseClient()
        client.set_table_data("btc_prices", [{"date": "2026-02-06", "close": "100000"}])
        result = client.table("btc_prices").select("*").execute()
        assert result.data[0]["close"] == "100000"
    """

    def __init__(self):
        self._tables: dict[str, list[dict]] = {}

    def set_table_data(self, table_name: str, data: list[dict]):
        self._tables[table_name] = data

    def table(self, name: str) -> MockQueryBuilder:
        return MockQueryBuilder(self._tables.get(name, []))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db():
    """Returns a MockSupabaseClient instance pre-loaded with sensible defaults."""
    client = MockSupabaseClient()

    # Default price data
    client.set_table_data("btc_prices", [
        {"date": "2026-02-06", "close": "98000"},
        {"date": "2026-02-05", "close": "97000"},
        {"date": "2026-01-30", "close": "92000"},
        {"date": "2026-01-06", "close": "85000"},
    ])

    # Cycle score history
    client.set_table_data("cycle_score_history", [
        {"date": "2026-02-06", "score": 62, "phase": "mid_bull"},
        {"date": "2026-02-05", "score": 60, "phase": "mid_bull"},
    ])

    # Technical indicators
    client.set_table_data("technical_indicators", [
        {"indicator": "RSI_14", "date": "2026-02-06", "value": "55.3", "signal": "bullish"},
        {"indicator": "SMA_CROSS", "date": "2026-02-06", "value": "5000", "signal": "bullish"},
        {"indicator": "MACD", "date": "2026-02-06", "value": "120", "signal": "bullish"},
    ])

    # Sentiment data
    client.set_table_data("sentiment_data", [
        {"metric": "FEAR_GREED", "date": "2026-02-06", "value": "65"},
        {"metric": "FEAR_GREED_30D", "date": "2026-02-06", "value": "58.5"},
    ])

    # On-chain metrics
    client.set_table_data("onchain_metrics", [
        {"metric": "HASH_RATE_MOM_30D", "date": "2026-02-06", "value": "5.2", "signal": "bullish"},
    ])

    # Alerts (empty by default)
    client.set_table_data("alerts", [])

    # Conclusions
    client.set_table_data("conclusions", [
        {
            "id": 1,
            "date": "2026-02-06",
            "title": "BTC in mid-bull phase",
            "content": "Based on cycle analysis, BTC is in mid-bull territory.",
            "category": "technical",
            "confidence": 7,
            "source": "claude",
            "tags": ["cycle", "bull"],
            "status": "active",
            "data_snapshot": {"btc_price": 98000, "cycle_score": 62},
            "validated_outcome": None,
            "created_at": "2026-02-06T10:00:00",
        },
    ])

    return client


@pytest.fixture
def patched_db(mock_db):
    """Patches get_supabase everywhere it has been imported.

    Because each module does ``from btc_intel.db import get_supabase``,
    patching only ``btc_intel.db.get_supabase`` does NOT affect modules
    that already hold a local reference.  We patch every tested module's
    local binding so they all return the mock client.
    """
    targets = [
        "btc_intel.db.get_supabase",
        "btc_intel.analysis.alerts.get_supabase",
        "btc_intel.analysis.cycle_score.get_supabase",
        "btc_intel.analysis.patterns.get_supabase",
        "btc_intel.conclusions.manager.get_supabase",
        "btc_intel.context.builder.get_supabase",
    ]
    patches = [patch(t, return_value=mock_db) for t in targets]
    for p in patches:
        p.start()
    yield mock_db
    for p in patches:
        p.stop()
