import logging
from typing import Dict, Any

from app.schemas.incidents import IncidentResponse
from app.services.rca_strategies import (
    RCAStrategy,
    MockRCAStrategy,
    OllamaRCAStrategy,
    GeminiRCAStrategy,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIAnalysisService:
    """
    Orchestrates the Root Cause Analysis pipeline.

    Responsibility here is deliberately narrow: pick an RCAStrategy once
    at startup, and fall back to the mock strategy if the chosen strategy
    fails at request time.

    Selection order:
      1. Gemini  — if GEMINI_API_KEY is set and the SDK initialises.
      2. Ollama  — if the local Ollama instance is reachable.
      3. Mock    — canned per-incident-type responses (always available).

    The actual RCA-generation logic (prompt building, RAG retrieval,
    canned responses) lives in rca_strategies.py.
    """

    def __init__(self):
        self._strategy: RCAStrategy = self._select_strategy()

    def _select_strategy(self) -> RCAStrategy:
        # --- 1. Try Gemini (highest priority) ---
        if settings.GEMINI_API_KEY:
            try:
                logger.info(
                    f"GEMINI_API_KEY is set. Initializing GeminiRCAStrategy "
                    f"(model: {GeminiRCAStrategy.MODEL_NAME})..."
                )
                strategy = GeminiRCAStrategy()
                logger.info(
                    "AIAnalysisService: Gemini strategy initialized successfully."
                )
                return strategy
            except Exception as e:
                logger.warning(
                    f"Failed to initialize Gemini strategy: {e}. "
                    "Falling through to Ollama."
                )

        # --- 2. Try Ollama (second priority) ---
        try:
            logger.info(
                f"Initializing ChatOllama on {settings.OLLAMA_BASE_URL} "
                f"with model {settings.OLLAMA_MODEL}..."
            )
            strategy = OllamaRCAStrategy()

            # Lightweight check to verify the local Ollama instance is active
            import requests
            response = requests.get(
                f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=1.0
            )
            if response.status_code == 200:
                logger.info(
                    "AIAnalysisService: Local Ollama service is reachable. "
                    "Ollama LLM initialized successfully."
                )
                return strategy
            else:
                logger.warning(
                    f"AIAnalysisService: Local Ollama service returned status "
                    f"{response.status_code}. Falling through to mock."
                )
        except Exception as e:
            logger.warning(
                f"Failed to initialize ChatOllama or reach local service: {e}. "
                "Falling through to mock."
            )

        # --- 3. Mock fallback (always works) ---
        logger.info("AIAnalysisService: Using MockRCAStrategy (fallback).")
        return MockRCAStrategy()

    def analyze(self, incident: IncidentResponse) -> Dict[str, Any]:
        """
        Runs the RCA pipeline on the given incident. Returns a structured
        dict with root_cause, confidence_score, recovery_steps, and
        incident_report. Falls back to the mock strategy if the active
        strategy fails for any reason at request time.
        """
        logger.info(f"Starting RCA analysis for incident: {incident.id}")

        if isinstance(self._strategy, MockRCAStrategy):
            logger.info("Using mock RCA response (no LLM connection available).")
            return self._strategy.generate(incident)

        try:
            result = self._strategy.generate(incident)
            logger.info(
                f"RCA analysis completed for {incident.id} | "
                f"confidence={result.get('confidence_score')}"
            )
            return result
        except Exception as e:
            logger.error(f"LLM invocation failed: {e}. Falling back to mock.")
            return MockRCAStrategy().generate(incident)


# Global singleton instance
ai_service = AIAnalysisService()
