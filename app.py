import pickle

import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# ── Brand list ─────────────────────────────────────────────────────────────
BRANDS = [
    "ADATA",
    "Corsair",
    "Crucial",
    "G.Skill",
    "GeIL",
    "HyperX",
    "Kingston",
    "Klevv",
    "Lexar",
    "Micron",
    "Mushkin",
    "OLOy",
    "Patriot",
    "PNY",
    "Samsung",
    "Silicon Power",
    "SK Hynix",
    "TeamGroup",
    "Thermaltake",
    "Transcend",
    "V-Color",
    "XPG",
    "Generic / Off-Brand",
    "Other",
]

# ── Load model once at startup ─────────────────────────────────────────────
with open("ram_price_model.pkl", "rb") as f:
    payload = pickle.load(f)

model = payload["model"]
preprocessor = payload["preprocessor"]
classes = payload["classes"]
feat_info = payload["features"]


# ── Helper ─────────────────────────────────────────────────────────────────
def predict_price_range(form_data: dict):
    df = pd.DataFrame(
        [
            {
                "capacity_gb": float(form_data.get("capacity_gb", 0)),
                "bus_speed_mhz": float(form_data.get("bus_speed_mhz", 0)),
                "demand_ratio": float(form_data.get("demand_ratio", 0.5)),
                "has_discount": int(form_data.get("has_discount", 0)),
                "ram_generation": form_data.get("ram_generation", "DDR4"),
                "condition_clean": form_data.get("condition_clean", "Used"),
                "unit_type": form_data.get("unit_type", "Single"),
                "brand": form_data.get("brand", "Other"),
                "is_ecc": int(form_data.get("is_ecc", 0)),
                "is_sodimm": int(form_data.get("is_sodimm", 0)),
                "is_gaming": int(form_data.get("is_gaming", 0)),
                "is_us_listing": int(form_data.get("is_us_listing", 1)),
                "is_bulk_server": int(form_data.get("is_bulk_server", 0)),
            }
        ]
    )

    X_proc = preprocessor.transform(df)
    pred = model.predict(X_proc)[0]
    probs = model.predict_proba(X_proc)[0]

    return {
        "prediction": pred,
        "probabilities": {cls: round(float(p) * 100, 2) for cls, p in zip(classes, probs)},
        "confidence": round(float(probs.max()) * 100, 2),
    }


# ── Routes ─────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    error = None

    if request.method == "POST":
        try:
            result = predict_price_range(request.form)
        except Exception as e:
            error = str(e)

    return render_template(
        "index.html",
        result=result,
        error=error,
        classes=classes,
        payload=payload,
        brands=BRANDS,  # ← new
    )


# ── JSON API ───────────────────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
def api_predict():
    try:
        data = request.get_json(force=True)
        result = predict_price_range(data)
        return jsonify({"status": "ok", **result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


# ── API: expose brand list for external use ────────────────────────────────
@app.route("/api/brands", methods=["GET"])
def api_brands():
    return jsonify({"brands": BRANDS})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
