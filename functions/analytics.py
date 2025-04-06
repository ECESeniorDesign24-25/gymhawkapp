import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from sklearn.linear_model import SGDClassifier
import pickle
from google.cloud import storage
from consts import *
import os

# global logistic regression model
model = SGDClassifier(loss="log_loss")
model_initialized = False
last_fit_date = None


def save_model():
    """
    serialze and upload to cloud storage
    """
    global model, model_initialized
    print("Saving model")
    with open(MODEL_FILENAME, "wb") as f:
        pickle.dump((model, model_initialized), f)
    storage_client = storage.Client()
    bucket = storage_client.bucket(MODEL_BUCKET)
    blob = bucket.blob(MODEL_FILENAME)
    blob.upload_from_filename(MODEL_FILENAME)
    os.remove(MODEL_FILENAME)
    print("Model saved.")


def load_model():
    """
    load model from cloud storage
    """
    global model, model_initialized
    print("Loading model")
    storage_client = storage.Client()
    bucket = storage_client.bucket(MODEL_BUCKET)
    blob = bucket.blob(MODEL_FILENAME)
    if blob.exists():
        blob.download_to_filename(MODEL_FILENAME)
        with open(MODEL_FILENAME, "rb") as f:
            model_loaded, initialized = pickle.load(f)
            model = model_loaded
            model_initialized = initialized
        print("Model loaded.")
    else:
        print("No saved model found.")


# load model from cloud storage to memory
load_model()


def prepare_features(timestamp):
    """
    timestamp to cyclical features for hour and day-of-week
    """
    if isinstance(timestamp, str):
        dt = datetime.fromisoformat(timestamp)
    else:
        dt = timestamp

    hour = dt.hour + dt.minute / 60.0
    sin_hour = np.sin(2 * np.pi * hour / 24)
    cos_hour = np.cos(2 * np.pi * hour / 24)

    dow = dt.weekday()
    sin_dow = np.sin(2 * np.pi * dow / 7)
    cos_dow = np.cos(2 * np.pi * dow / 7)
    return np.array([sin_hour, cos_hour, sin_dow, cos_dow])


def update_model(data):
    """
    online update of model with new datapoint
    """
    global model, model_initialized, last_fit_date
    print("Updating model")
    # if its been more than 1 day since last fit, reinitialize model
    if not last_fit_date or data["timestamp"].iloc[0] - last_fit_date > timedelta(
        days=1
    ):
        print("Reinitializing model")
        last_fit_date = data["timestamp"].iloc[0]
        model = SGDClassifier(loss="log_loss")
        model_initialized = False

    X = []
    y = []
    for _, row in data.iterrows():
        features = prepare_features(row["timestamp"])
        X.append(features)

        # on = 1, off = 0
        label = 1 if row["state"] == "on" else 0
        y.append(label)
    X = np.array(X)
    y = np.array(y)

    # initalize if not already
    if not model_initialized:
        model.partial_fit(X, y, classes=np.array([0, 1]))
        model_initialized = True
        last_fit_date = data["timestamp"].iloc[0]
    else:
        model.partial_fit(X, y)
        last_fit_date = data["timestamp"].iloc[0]

    save_model()


def predict_15_minute_intervals(target_date):
    """
    predict probability of usage for next 15 minute interval
    """
    print("Predicting 15 minute intervals")
    time_slots = []
    probabilities = []
    current_time = datetime.combine(target_date, datetime.min.time())
    end_time = current_time + timedelta(days=1)

    # predict in 15 minute intervals
    while current_time < end_time:
        features = prepare_features(current_time)
        prob_on = model.predict_proba([features])[0][1]
        time_slots.append(current_time)
        probabilities.append(prob_on)
        current_time += timedelta(minutes=15)

    df = pd.DataFrame({"time": time_slots, "prob_on": probabilities})
    df.to_csv("probabilities.csv", index=False)
    return df


def predict(target_date, predict_peak_hours=False):
    """
    predict time with lowest probability of usage and/or peak and off-peak hours
    """
    print("Predicting")
    df = predict_15_minute_intervals(target_date)
    df_optimal = df[df["prob_on"] < 0.5]
    if df_optimal.empty:
        return None, None

    if not predict_peak_hours:
        # find time with lowest probability of usage
        best_slot = df_optimal.loc[df_optimal["prob_on"].idxmin()]
        return best_slot["time"], best_slot["prob_on"]

    if predict_peak_hours:
        # find peak and off-peak hours (percentile based for now)
        peak_threshold = df["prob_on"].quantile(0.75)
        off_peak_threshold = df["prob_on"].quantile(0.25)

        peak_df = df[df["prob_on"] >= peak_threshold]
        off_peak_df = df[df["prob_on"] <= off_peak_threshold]

        peak_intervals = peak_df["time"].tolist()
        off_peak_intervals = off_peak_df["time"].tolist()
        return peak_intervals, off_peak_intervals
