import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
from app.services.telemetry_provider import telemetry_provider, is_same_team, _clean_val

def _fetch_single_race_results_with_sprint(season: int, round_number: int):
    driver_map = {}
    try:
        session = telemetry_provider._load_session_results_only(season, round_number, "Race")
        if hasattr(session, "results") and session.results is not None and not session.results.empty:
            for _, res_row in session.results.iterrows():
                d_code = str(_clean_val(res_row.get("Abbreviation") or res_row.get("Driver"), ""))
                res_t_name = str(_clean_val(res_row.get("TeamName"), ""))
                d_num = _clean_val(res_row.get("DriverNumber"), 0)
                try:
                    d_num = int(d_num)
                except (ValueError, TypeError):
                    d_num = 0

                pos = _clean_val(res_row.get("Position") or res_row.get("ClassifiedPosition"))
                pos_text = str(_clean_val(res_row.get("ClassifiedPosition"), "")) if res_row.get("ClassifiedPosition") else (str(int(pos)) if pos is not None else None)
                pts = _clean_val(res_row.get("Points"))
                stat = _clean_val(res_row.get("Status"))
                main_pts = float(pts) if pts is not None else 0.0

                driver_map[d_code] = {
                    "driver_code": d_code,
                    "team_name": res_t_name,
                    "driver_number": d_num,
                    "full_name": _clean_val(res_row.get("FullName")),
                    "position": int(pos) if pos is not None else None,
                    "position_text": pos_text,
                    "points": main_pts,
                    "main_points": main_pts,
                    "sprint_points": 0.0,
                    "status": str(stat) if stat is not None else None,
                }
    except Exception as e:
        print(f"Error race round {round_number}: {e}")

    try:
        sprint_session = telemetry_provider._load_session_results_only(season, round_number, "Sprint")
        if hasattr(sprint_session, "results") and sprint_session.results is not None and not sprint_session.results.empty:
            for _, srow in sprint_session.results.iterrows():
                sd_code = str(_clean_val(srow.get("Abbreviation") or srow.get("Driver"), ""))
                s_pts = _clean_val(srow.get("Points"))
                if s_pts is not None and float(s_pts) > 0:
                    sprint_pts = float(s_pts)
                    if sd_code in driver_map:
                        driver_map[sd_code]["sprint_points"] = sprint_pts
                        driver_map[sd_code]["points"] += sprint_pts
                    else:
                        res_t_name = str(_clean_val(srow.get("TeamName"), ""))
                        d_num = _clean_val(srow.get("DriverNumber"), 0)
                        try:
                            d_num = int(d_num)
                        except (ValueError, TypeError):
                            d_num = 0
                        driver_map[sd_code] = {
                            "driver_code": sd_code,
                            "team_name": res_t_name,
                            "driver_number": d_num,
                            "full_name": _clean_val(srow.get("FullName")),
                            "position": None,
                            "position_text": None,
                            "points": sprint_pts,
                            "main_points": 0.0,
                            "sprint_points": sprint_pts,
                            "status": "Sprint",
                        }
    except Exception:
        pass

    return list(driver_map.values())


async def test_full():
    print("Testing 2023 for Red Bull...")
    total_pts_2023 = 0
    for r in range(1, 23):
        res_list = _fetch_single_race_results_with_sprint(2023, r)
        for d in res_list:
            if is_same_team("Oracle Red Bull Racing", d["team_name"]):
                total_pts_2023 += d["points"]
    print(f"2023 Red Bull Total Points (Main + Sprint): {total_pts_2023}")

    print("Testing 2024 for Red Bull...")
    total_pts_2024 = 0
    for r in range(1, 25):
        res_list = _fetch_single_race_results_with_sprint(2024, r)
        for d in res_list:
            if is_same_team("Oracle Red Bull Racing", d["team_name"]):
                total_pts_2024 += d["points"]
    print(f"2024 Red Bull Total Points (Main + Sprint): {total_pts_2024}")

if __name__ == "__main__":
    asyncio.run(test_full())
