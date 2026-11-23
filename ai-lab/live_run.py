"""Run a GitHub-Actions-only free-quota image test when explicitly armed."""
from __future__ import annotations
import json
from pathlib import Path
from types import SimpleNamespace
import lab


def run_request(path: Path) -> int:
    request = json.loads(path.read_text(encoding="utf-8"))
    required = {"enabled", "model", "count", "max_neurons", "mobile_only"}
    permitted = required | {"reference_pack"}
    if not required.issubset(request) or set(request) - permitted:
        raise ValueError("live-request.json keys must match documented schema")
    pack_id = request.get("reference_pack")
    if pack_id not in (None, "", "gojo-adult-s1", "gojo-young-s2"):
        raise ValueError("Unsupported official character reference pack")
    if request["enabled"] is not True:
        print("LAB DISARMED: no image inference, website upload or social posting")
        return 0
    if request["model"] not in lab.MODEL_IDS:
        raise ValueError("Invalid model")
    if not isinstance(request["count"], int) or isinstance(request["count"], bool):
        raise ValueError("count must be an integer")
    if not 1 <= request["count"] <= 3:
        raise ValueError("Live image tests allow only 1-3 concepts")
    if not isinstance(request["mobile_only"], bool):
        raise ValueError("mobile_only must be a boolean")
    # A premium Lucid portrait costs far more than a Klein pair. Restrict
    # Lucid to one explicitly requested vertical comparison image at a time.
    if request["model"] == "lucid" and (
        request["count"] != 1 or request["mobile_only"] is not True
    ):
        raise ValueError("Lucid benchmark is limited to one 9:16 portrait")
    if pack_id and (request["model"] != "klein" or request["count"] != 1):
        raise ValueError("Official references are limited to one Klein concept")
    cap = 5200 if request["model"] == "lucid" else 900
    if (
        not isinstance(request["max_neurons"], (int, float))
        or isinstance(request["max_neurons"], bool)
        or not 0 < request["max_neurons"] <= cap
    ):
        raise ValueError(f"This model's per-run maximum is {cap} estimated Neurons")
    return lab.run_generate(SimpleNamespace(
        confirm_free_quota=True,
        model=request["model"],
        count=request["count"],
        max_neurons=request["max_neurons"],
        mobile_only=request["mobile_only"],
        reference_pack=pack_id,
    ))


if __name__ == "__main__":
    raise SystemExit(run_request(Path(__file__).with_name("live-request.json")))
