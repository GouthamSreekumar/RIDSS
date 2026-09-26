"""
Background job script for Data Retention Pruning.
Deletes AuditLog and LoginHistory rows older than the configured retention window (if set).
Logs execution + record count to AuditLog under action='retention_pruning_executed'.

Run via CLI:
    python -m scripts.prune_retention
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.services.retention import run_retention_pruning_job

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def main():
    logger.info("Starting RIDSS data retention pruning background job...")
    async with AsyncSessionLocal() as db:
        res = await run_retention_pruning_job(db)
        logger.info(
            "Pruning background job completed. Pruned: %d audit logs, %d login history records.",
            res["audit_logs_pruned"],
            res["login_history_pruned"],
        )


if __name__ == "__main__":
    asyncio.run(main())
