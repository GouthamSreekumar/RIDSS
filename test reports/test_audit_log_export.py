"""
Test script for Feature 4: Date-scoped Audit Log export & search filtering.
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.api.v1.endpoints.audit_logs import export_audit_logs_csv, search_audit_logs


async def main():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).limit(1))
        admin_user = user_res.scalar_one_or_none()
        assert admin_user is not None, "No user found in DB"

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        print(f"Testing single-day search and CSV export for date: {today_str}")

        # 1. Search audit logs with date_from = today_str and date_to = today_str
        logs = await search_audit_logs(
            action=None,
            entity_type=None,
            user_id=None,
            search=None,
            date_from=today_str,
            date_to=today_str,
            skip=0,
            limit=100,
            db=db,
            _current_user=admin_user,
        )

        print(f"Found {len(logs)} audit log entries for today ({today_str}).")
        for log in logs:
            log_date_str = log.created_at.strftime("%Y-%m-%d")
            assert log_date_str == today_str, f"Log date {log_date_str} mismatch with target date {today_str}!"

        # 2. Export CSV for today
        csv_resp = await export_audit_logs_csv(
            action=None,
            entity_type=None,
            user_id=None,
            search=None,
            date_from=today_str,
            date_to=today_str,
            db=db,
            _current_user=admin_user,
        )


        csv_body = csv_resp.body.decode("utf-8")
        csv_lines = csv_body.strip().split("\n")
        print(f"CSV exported successfully. Header + {len(csv_lines) - 1} data row(s).")
        assert len(csv_lines) >= 1
        assert "Log ID,Timestamp,User ID,User Email,Action,Entity Type,Entity ID,IP Address,Details" in csv_lines[0]

        print("\nSUCCESS: Date-scoped Audit Log export & search backend test passed!")


if __name__ == "__main__":
    asyncio.run(main())
