#!/usr/bin/env python3
"""Structured JSON wrapper around the vendored equity-research-skill dcf.py.

dcf.py is kept byte for byte as upstream ships it. This runner imports its
functions, runs the full CLI flow (dcf.run) to capture the human readable
transcript, and returns the same numbers as JSON for the UI.

Usage:
    python3 runner.py --config assumptions.json   # JSON on stdout
    python3 runner.py --demo                      # uses dcf.DEMO
    echo '{...}' | python3 runner.py              # assumptions on stdin
"""
import contextlib, io, json, os, re, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dcf  # noqa: E402

CALIBRATE_EN = {
    "显著低估": "significantly undervalued",
    "低估": "undervalued",
    "合理": "fairly valued",
    "高估": "overvalued",
    "显著高估": "significantly overvalued",
}


def _quiet(fn, *args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        out = fn(*args)
    return out, buf.getvalue()


def _num(s):
    return float(s.replace(",", ""))


def value(cfg):
    shares, nd = cfg["shares"], cfg.get("net_debt", 0.0)
    wacc, g, price = cfg["wacc"], cfg["terminal_g"], cfg.get("price")
    # Full upstream CLI flow first: validates inputs and yields the transcript.
    _, transcript = _quiet(dcf.run, cfg)

    out = {"engine": "dcf.py (vendored from rollingSirius/equity-research-skill)",
           "python": sys.version.split()[0], "price": price, "ranges": []}

    scs = cfg.get("scenarios") or []
    if scs:
        res, weighted = {}, 0.0
        for sc in scs:
            r = dcf.dcf_value(sc, wacc, g, shares, nd)
            res[sc["name"]] = {"prob": sc.get("prob", 0.0), "per_share": r["per_share"],
                               "ev": r["ev"], "tv_share": r["tv_share"],
                               "exit_pfcf": r["exit_pfcf"], "tv_warning": r["tv_share"] > 0.80}
            weighted += sc.get("prob", 0.0) * r["per_share"]
        vals = [v["per_share"] for v in res.values()]
        out["scenarios"] = res
        out["weighted"] = weighted
        out["ranges"].append({"id": "dcf", "method": "Scenario DCF (bear to bull)",
                              "low": min(vals), "high": max(vals), "mid": weighted})

    sens = cfg.get("sensitivity")
    if sens and scs:
        sc = next(s for s in scs if s["name"] == sens["scenario"])
        grid = [[dcf.dcf_value(sc, w, gg, shares, nd)["per_share"] for gg in sens["g"]]
                for w in sens["wacc"]]
        flat = [v for row in grid for v in row]
        out["sensitivity"] = {"scenario": sens["scenario"], "wacc": sens["wacc"], "g": sens["g"], "grid": grid}
        out["ranges"].append({"id": "sens", "method": f"DCF sensitivity (WACC x g, {sens['scenario']})",
                              "low": min(flat), "high": max(flat), "mid": statistics.median(flat)})

    rev = cfg.get("reverse")
    if rev and price:
        r = dcf.reverse_dcf(price, shares, nd, wacc, g, rev["interim_fcf"],
                            rev["steady_margins"], rev.get("base_revenue"))
        out["reverse"] = r

    if cfg.get("pvgo"):
        p = cfg["pvgo"]
        r = p.get("r", wacc)
        zg = p["earnings_ps"] / r
        pvgo_res, _ = _quiet(dcf.run_pvgo, p, cfg)
        out["pvgo"] = {"zero_growth_ps": zg, "pvgo_ps": (price or 0) - zg, "pvgo_pct": pvgo_res["pvgo_pct"]}

    if cfg.get("epv"):
        e = cfg["epv"]
        epv_res, _ = _quiet(dcf.run_epv, e)
        lo_hi = sorted(v for v in (epv_res["epv_ps"], epv_res["growth_ps"]) if v is not None)
        out["epv"] = {**epv_res, "asset_ps": (e["asset_value"] / e["shares"]) if e.get("asset_value") else None}
        out["ranges"].append({"id": "epv", "method": "EPV to franchise growth (Greenwald)",
                              "low": lo_hi[0], "high": lo_hi[-1], "mid": epv_res["epv_ps"]})

    if cfg.get("eva"):
        e = cfg["eva"]
        base, _ = _quiet(dcf.run_eva, e, cfg)
        lo, _ = _quiet(dcf.run_eva, {**e, "wacc": e.get("wacc", wacc) + 0.01}, cfg)
        hi, _ = _quiet(dcf.run_eva, {**e, "wacc": e.get("wacc", wacc) - 0.01}, cfg)
        trio = sorted([lo["per_share"], base["per_share"], hi["per_share"]])
        out["eva"] = {"per_share": base["per_share"], "low": trio[0], "high": trio[-1]}
        out["ranges"].append({"id": "eva", "method": "EVA / residual income (WACC +/-1pt)",
                              "low": trio[0], "high": trio[-1], "mid": base["per_share"]})

    if cfg.get("montecarlo"):
        mc, text = _quiet(dcf.run_montecarlo, cfg["montecarlo"], cfg)
        m = re.search(r"P10 ([\d,.\-]+) \| P25 ([\d,.\-]+) \| P50 ([\d,.\-]+) \| P75 ([\d,.\-]+) \| P90 ([\d,.\-]+)", text)
        q = [_num(x) for x in m.groups()] if m else [mc["p50"]] * 5
        out["montecarlo"] = {"p10": q[0], "p25": q[1], "p50": q[2], "p75": q[3], "p90": q[4],
                             "mean": mc["mean"], "p_loss": mc.get("p_loss"), "n": cfg["montecarlo"].get("n", 2000)}
        out["ranges"].append({"id": "mc", "method": "Monte Carlo DCF (P10 to P90)",
                              "low": q[0], "high": q[4], "mid": q[2]})

    if out["ranges"]:
        lo = cfg.get("range_low") or statistics.median(r["low"] for r in out["ranges"])
        hi = cfg.get("range_high") or statistics.median(r["high"] for r in out["ranges"])
        out["composite"] = {"low": lo, "high": hi,
                            "rule": "given in assumptions" if cfg.get("range_low") else "median of method lows and highs"}
        if price:
            label = dcf.calibrate(price, lo, hi)
            out["calibrate"] = {"label_zh": label, "label": CALIBRATE_EN[label]}
            if not cfg.get("range_low"):
                # Re-run the calibrate section of the upstream transcript with the derived range.
                _, tail = _quiet(dcf.run, {**cfg, "range_low": round(lo, 2), "range_high": round(hi, 2)})
                transcript = tail

    out["transcript"] = transcript
    return out


def main(argv):
    if "--demo" in argv:
        cfg = dcf.DEMO
    elif "--config" in argv:
        with open(argv[argv.index("--config") + 1]) as f:
            cfg = json.load(f)
    else:
        cfg = json.load(sys.stdin)
    try:
        print(json.dumps({"ok": True, "result": value(cfg)}, ensure_ascii=False))
    except (ValueError, KeyError, TypeError, ZeroDivisionError) as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
