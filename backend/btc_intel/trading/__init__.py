"""Trading Module v2 — Levels, Fibonacci, Candle Patterns, Setups, Extended Scoring."""

from dataclasses import dataclass, field


@dataclass
class SwingPoint:
    price: float
    type: str  # "high" or "low"
    date: str
    timeframe: str
    percent_move: float = 0.0


@dataclass
class PriceLevel:
    price: float
    type: str  # "support" or "resistance"
    strength: int = 0
    source: list[str] = field(default_factory=list)
    timeframes: list[str] = field(default_factory=list)
    touch_count: int = 0
    last_touch_date: str | None = None
    visible_in_timeframes: int = 1
    coincides_with_fib: bool = False
    fib_level: float | None = None
    is_role_flip: bool = False
    flip_date: str | None = None
    is_high_volume_zone: bool = False
    is_psychological: bool = False
    last_touch_days: int = 999


@dataclass
class Zone:
    price_low: float
    price_high: float
    price_mid: float
    strength: int
    type: str  # "support" or "resistance"
    sources: list[str] = field(default_factory=list)
    touch_count: int = 0
    timeframes: list[str] = field(default_factory=list)
    fib_ratios: list[float] = field(default_factory=list)
    has_gran_nivel: bool = False


@dataclass
class Setup:
    type: str  # "pullback", "breakout", "reversal"
    direction: str  # "LONG", "SHORT"
    entry_zone: dict = field(default_factory=dict)
    description: str = ""
    reliability: str = "medium"  # "high", "medium", "low"


@dataclass
class CandlePattern:
    pattern: str
    direction: str  # "LONG", "SHORT", "NEUTRAL"
    strength: int  # 1-10
    candles: int  # number of candles in pattern


@dataclass
class ExtendedSignal:
    """Full signal with all v2 data."""
    timeframe: str
    direction: str
    base_confidence: float
    bonus_levels: int = 0
    bonus_candles: int = 0
    bonus_onchain: int = 0
    penalties: int = 0
    final_score: int = 0
    classification: str = ""
    setup: Setup | None = None
    candle_pattern: CandlePattern | None = None
    sl: float | None = None
    tp1: float | None = None
    tp2: float | None = None
    sl_method: str = ""
    tp1_method: str = ""
    tp2_method: str = ""
    nearby_levels: list[dict] = field(default_factory=list)
    fib_context: dict = field(default_factory=dict)
