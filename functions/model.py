import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import pickle
import os
import google.cloud.storage as storage
import dotenv

dotenv.load_dotenv()


# feature extraction
def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour
    df["minute"] = df["timestamp"].dt.minute
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    return df


class RandomForestModel:
    def __init__(self, load_model: bool = True):
        # load model if it exists otherwise create new one
        if load_model:
            self.load(os.environ.get("MODEL_FILENAME"))
        else:
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
            self.label_encoder = LabelEncoder()
            self.thing_id_encoder = LabelEncoder()

        self.X_features = ["encoded_thing_id", "hour", "minute", "day_of_week"]
        self.y_feature = "encoded_state"
        self.TEST_RATIO = 0.2
        self.n_datapoints = 0

    # split into test and train sets
    def _split_data(
        self, X: pd.DataFrame, y: pd.Series
    ) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
        test_size = int(len(X) * self.TEST_RATIO)

        X_train = X[:-test_size]
        X_test = X[-test_size:]
        y_train = y[:-test_size]
        y_test = y[-test_size:]

        return X_train, X_test, y_train, y_test

    # prepare data for training
    def _prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        df = extract_features(df)

        # 30 min intervals either :00 or :30
        df["hour_slot"] = df["timestamp"].dt.floor("30min")
        df["hour_slot"] = df["hour_slot"].apply(
            lambda x: x.replace(minute=0) if x.minute < 30 else x.replace(minute=30)
        )

        # assume state is on if on in any interval
        df = (
            df.groupby(["thing_id", "hour_slot"])
            .agg(
                {
                    "state": lambda x: "on" if "on" in x.values else "off",
                    "hour": "first",
                    "minute": "first",
                    "day_of_week": "first",
                }
            )
            .reset_index()
        )

        # Rename columns for clarity
        df = df.rename(columns={"hour_slot": "timestamp"})

        # Encode categorical variables
        df["encoded_state"] = self.label_encoder.fit_transform(df["state"])
        df["encoded_thing_id"] = self.thing_id_encoder.fit_transform(df["thing_id"])

        # break up X and y
        X = df[self.X_features]
        y = df[self.y_feature]

        # split into test/train
        X_train, X_test, y_train, y_test = self._split_data(X, y)
        return X_train, X_test, y_train, y_test

    # save model to GCP bucket
    def save(self, file_name: str):
        print("Serializing and saving model to GCP")
        data_to_save = {
            "model": self.model,
            "label_encoder": self.label_encoder,
            "thing_id_encoder": self.thing_id_encoder,
        }

        with open(file_name, "wb") as f:
            pickle.dump(data_to_save, f)

        storage_client = storage.Client()
        bucket = storage_client.bucket(os.environ.get("MODEL_BUCKET"))
        blob = bucket.blob(file_name)
        blob.upload_from_filename(file_name)
        os.remove(file_name)
        print(f"Model saved to {os.environ.get('MODEL_BUCKET')}")

    # load model from GCP bucket
    def load(self, file_name: str):
        print(f"Loading {file_name} from {os.environ.get('MODEL_BUCKET')}")
        storage_client = storage.Client()
        bucket = storage_client.bucket(os.environ.get("MODEL_BUCKET"))
        blob = bucket.blob(file_name)
        blob.download_to_filename(file_name)
        try:
            with open(file_name, "rb") as f:
                save_data = pickle.load(f)
                self.model = save_data["model"]
                self.label_encoder = save_data["label_encoder"]
                self.thing_id_encoder = save_data["thing_id_encoder"]
                os.remove(file_name)
                print(f"{file_name} loaded from {os.environ.get('MODEL_BUCKET')}")
        except Exception as e:
            print(
                f"Error loading {file_name} from {os.environ.get('MODEL_BUCKET')}: {e}"
            )

    # train the model
    def train(self, df: pd.DataFrame) -> float:
        print("Starting training")

        # prepare data for training
        X_train, X_test, y_train, y_test = self._prepare_data(df)

        # set number of datapoints trained on
        self.n_datapoints = len(X_train)

        # train the model
        self.model.fit(X_train, y_train)

        # save the model
        self.save(os.environ.get("MODEL_FILENAME"))

        # evaluate the model

        acc = self.evaluate(df)
        print(f"Training finished: {acc}")

        return acc

    # predict the state of a machine at a given time
    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # encode thing_id
        if "thing_id" in df.columns:
            df["encoded_thing_id"] = self.thing_id_encoder.transform(df["thing_id"])

        # extract features for prediction
        df = extract_features(df)

        # get predictions and probabilities
        predictions = self.model.predict(df[self.X_features])
        probabilities = self.model.predict_proba(df[self.X_features])

        # create result dataframe
        result = df.copy()
        result["predicted_state"] = self.label_encoder.inverse_transform(predictions)
        result["probability_on"] = probabilities[:, 1]  # Probability of being 'on'

        return result

    # get accuracy for trianing run
    def evaluate(self, df: pd.DataFrame) -> float:
        # prepare data for evaluation
        X_train, X_test, y_train, y_test = self._prepare_data(df)

        # evaluate the model
        return self.model.score(X_test, y_test)

    # predict the hours of the day that the machine is most or least likely to be on
    def predict_hours(
        self,
        df: pd.DataFrame,
        date: str,
        start_time: str,
        end_time: str,
        peak: bool = True,
        gym_open_time: str = "06:00:00",
        gym_close_time: str = "19:00:00",
    ) -> list:
        date_obj = pd.to_datetime(date)
        min_time = pd.to_datetime(start_time).time()
        max_time = pd.to_datetime(end_time).time()

        predicted_states = self.predict(df)

        # filter inside time window
        time_mask = (
            (predicted_states["timestamp"].dt.date == date_obj.date())
            & (predicted_states["timestamp"].dt.time >= min_time)
            & (predicted_states["timestamp"].dt.time <= max_time)
            & (
                predicted_states["timestamp"].dt.time
                >= pd.to_datetime(gym_open_time).time()
            )
            & (
                predicted_states["timestamp"].dt.time
                <= pd.to_datetime(gym_close_time).time()
            )
        )
        filtered_states = predicted_states[time_mask]

        # sort by time first, then probability
        sorted_states = filtered_states.sort_values(
            ["timestamp", "probability_on"], ascending=[False, not peak]
        )

        timestamps = sorted_states.head(3)["timestamp"]

        # convert to UTC
        if timestamps.dt.tz is None:
            timestamps = timestamps.dt.tz_localize("UTC")

        return (
            timestamps.dt.strftime("%Y-%m-%dT%H:%M:%S.%f")
            .str[:-3]
            .str.cat(["Z"] * len(timestamps))
            .tolist()
        )
