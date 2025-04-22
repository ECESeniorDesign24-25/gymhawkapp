import pytest
import json
import pandas as pd
from main import getTimeseries, fetchMostRecentVarFromDb, peakHoursHelper


def time_checker(timestamp1, timestamp2):
    timestamp1 = pd.to_datetime(timestamp1)
    timestamp2 = pd.to_datetime(timestamp2)
    return timestamp1 >= timestamp2


@pytest.mark.d1_green
def test_d1_green_state_timeseries():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    start_time = "2025-04-22T01:35:02.007Z"
    variable = "state"
    timeseries = json.loads(getTimeseries(thing_id, start_time, variable))

    try:
        assert timeseries is not None, (
            f"d1GreenTestGetStateTimeseries | Response is None: {timeseries}"
        )
        assert len(timeseries) > 0, (
            f"d1GreenTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert timeseries[0].get("state") is not None, (
            f"d1GreenTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert time_checker(timeseries[0]["timestamp"], start_time), (
            f"d1GreenTestGetStateTimeseries | Response is not after start time: {timeseries}"
        )
    except Exception as e:
        print(f"d1GreenTestGetStateTimeseries | Error: {e}")
        assert False, f"d1GreenTestGetStateTimeseries | Error: {e}"


@pytest.mark.d2_green
def test_d2_green_state_timeseries():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    start_time = "2025-04-22T01:35:02.007Z"
    variable = "state"
    timeseries = json.loads(getTimeseries(thing_id, start_time, variable))

    try:
        assert timeseries is not None, (
            f"d2GreenTestGetStateTimeseries | Response is None: {timeseries}"
        )
        assert len(timeseries) > 0, (
            f"d2GreenTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert timeseries[0].get("state") is not None, (
            f"d2GreenTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert time_checker(timeseries[0]["timestamp"], start_time), (
            f"d2GreenTestGetStateTimeseries | Response is not after start time: {timeseries}"
        )
    except Exception as e:
        print(f"d2GreenTestGetStateTimeseries | Error: {e}")
        assert False, f"d2GreenTestGetStateTimeseries | Error: {e}"


@pytest.mark.d1_blue
def test_d1_blue_state_timeseries():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    start_time = "2025-04-22T01:35:02.007Z"
    variable = "state"
    timeseries = json.loads(getTimeseries(thing_id, start_time, variable))

    try:
        assert timeseries is not None, (
            f"d1BlueTestGetStateTimeseries | Response is None: {timeseries}"
        )
        assert len(timeseries) > 0, (
            f"d1BlueTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert timeseries[0].get("state") is not None, (
            f"d1BlueTestGetStateTimeseries | Response is empty: {timeseries}"
        )
        assert time_checker(timeseries[0]["timestamp"], start_time), (
            f"d1BlueTestGetStateTimeseries | Response is not after start time: {timeseries}"
        )
    except Exception as e:
        print(f"d1BlueTestGetStateTimeseries | Error: {e}")
        assert False, f"d1BlueTestGetStateTimeseries | Error: {e}"


@pytest.mark.unknown
def test_unknown_state_timeseries():
    thing_id = "unknown"
    start_time = "2025-04-22T01:35:02.007Z"
    variable = "state"
    try:
        timeseries = json.loads(getTimeseries(thing_id, start_time, variable))
        assert len(timeseries) == 0, (
            f"UnknownTestGetStateTimeseries | Response is not None: {timeseries}"
        )
    except Exception as e:
        print(f"UnknownTestGetStateTimeseries | Error: {e}")
        assert False, f"UnknownTestGetStateTimeseries | Error: {e}"


@pytest.mark.d1_blue
def test_d1_blue_out_of_range():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    start_time = "2026-04-22T01:35:02.007Z"
    variable = "state"
    try:
        timeseries = json.loads(getTimeseries(thing_id, start_time, variable))
        assert len(timeseries) == 0, (
            f"d1BlueTestGetStateTimeseries | Response is not None: {timeseries}"
        )
    except Exception as e:
        print(f"d1BlueTestGetStateTimeseries | Error: {e}")
        assert False, f"d1BlueTestGetStateTimeseries | Error: {e}"


@pytest.mark.d1_blue
def test_d1_blue_get_device_state():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    variable = "state"
    state = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    try:
        assert state is not None, (
            f"d1BlueTestGetDeviceState | Response is None: {state}"
        )
        assert state[0].get("state") is not None, (
            f"d1BlueTestGetDeviceState | Response is empty: {state}"
        )
        assert state[0].get("timestamp") is not None, (
            f"d1BlueTestGetDeviceState | Response is empty: {state}"
        )
    except Exception as e:
        print(f"d1BlueTestGetDeviceState | Error: {e}")
        assert False, f"d1BlueTestGetDeviceState | Error: {e}"


@pytest.mark.d1_green
def test_d1_green_get_device_state():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    variable = "state"
    state = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    try:
        assert state is not None, (
            f"d1GreenTestGetDeviceState | Response is None: {state}"
        )
        assert state[0].get("state") is not None, (
            f"d1GreenTestGetDeviceState | Response is empty: {state}"
        )
        assert state[0].get("timestamp") is not None, (
            f"d1GreenTestGetDeviceState | Response is empty: {state}"
        )
    except Exception as e:
        print(f"d1GreenTestGetDeviceState | Error: {e}")
        assert False, f"d1GreenTestGetDeviceState | Error: {e}"


@pytest.mark.d2_green
def test_d2_green_get_device_state():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    variable = "state"
    state = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    try:
        assert state is not None, (
            f"d2GreenTestGetDeviceState | Response is None: {state}"
        )
        assert state[0].get("state") is not None, (
            f"d2GreenTestGetDeviceState | Response is empty: {state}"
        )
        assert state[0].get("timestamp") is not None, (
            f"d2GreenTestGetDeviceState | Response is empty: {state}"
        )
    except Exception as e:
        print(f"d2GreenTestGetDeviceState | Error: {e}")
        assert False, f"d2GreenTestGetDeviceState | Error: {e}"


@pytest.mark.unknown
def test_unknown_get_device_state():
    thing_id = "unknown"
    variable = "state"
    state = fetchMostRecentVarFromDb(thing_id, variable, "machine_states")
    try:
        assert state == [], (
            f"UnknownTestGetDeviceState | Response is not empty: {state}"
        )
    except Exception as e:
        print(f"UnknownTestGetDeviceState | Error: {e}")
        assert False, f"UnknownTestGetDeviceState | Error: {e}"


@pytest.mark.d1_green
def test_d1_green_get_peak_hours():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    date = "2025-04-22"
    start_time = "2025-04-22T06:00:00.000Z"
    end_time = "2025-04-22T19:00:00.000Z"
    peak = True
    hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    assert hours is not None, f"d1GreenTestGetPeakHours | Response is None: {hours}"
    assert len(hours) == 3, f"d1GreenTestGetPeakHours | Response is not 3: {hours}"

    for hour in hours:
        assert time_checker(hour, start_time), (
            f"d1GreenTestGetPeakHours | Timestamp is not after start time: {hour}"
        )
        assert time_checker(end_time, hour), (
            f"d1GreenTestGetPeakHours | Timestamp is not before end time: {hour}"
        )


@pytest.mark.d2_green
def test_d2_green_get_peak_hours():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    date = "2025-04-22"
    start_time = "2025-04-22T06:00:00.000Z"
    end_time = "2025-04-22T19:00:00.000Z"
    peak = True
    hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    assert hours is not None, f"d2GreenTestGetPeakHours | Response is None: {hours}"
    assert len(hours) == 0, f"d2GreenTestGetPeakHours | Response is not 3: {hours}"


@pytest.mark.d1_blue
def test_d1_blue_get_peak_hours():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    date = "2025-04-22"
    start_time = "2025-04-22T06:00:00.000Z"
    end_time = "2025-04-22T19:00:00.000Z"
    peak = True
    hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    assert hours is not None, f"d1BlueTestGetPeakHours | Response is None: {hours}"
    assert len(hours) == 3, f"d1BlueTestGetPeakHours | Response is not 3: {hours}"

    for hour in hours:
        assert time_checker(hour, start_time), (
            f"d1BlueTestGetPeakHours | Timestamp is not after start time: {hour}"
        )
        assert time_checker(end_time, hour), (
            f"d1BlueTestGetPeakHours | Timestamp is not before end time: {hour}"
        )
