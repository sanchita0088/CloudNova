import logging
import os


def setup_logging() -> None:
    """
    Configures the root logger once at application startup.

    Centralizing this here (instead of relying on each module's default
    logging.getLogger(__name__) handler) gives us one place to control
    log level/format now, and to swap in structured/JSON logging later
    without touching every service file.

    Level is driven by the LOG_LEVEL env var so it can be tightened in
    production (e.g. WARNING) without a code change.
    """
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Quiet down noisy third-party loggers that don't need INFO-level chatter.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)
