import pytest
import json
import pandas as pd
from main import (
    getTimeseries,
    fetchMostRecentVarFromDb,
    peakHoursHelper,
    getLastLat,
    getLastLong,
    getLastUsedTimeHelper,
    addTimeStepUtil,
    getTotalUsageUtil,
    getDailyUsageUtil,
    getDailyPercentagesUtil,
    getHourlyPercentagesUtil,
)


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


@pytest.mark.d1_green2
def test_d1_green2_state_timeseries():
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


@pytest.mark.d1_green2
def test_d1_green2_get_device_state():
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
        # Convert hour to datetime for comparison
        hour_dt = pd.to_datetime(hour)
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        assert hour_dt >= start_dt, (
            f"d1GreenTestGetPeakHours | Timestamp is not after start time: {hour}"
        )
        assert hour_dt <= end_dt, (
            f"d1GreenTestGetPeakHours | Timestamp is not before end time: {hour}"
        )
        # Check if hour is between 6am and 7pm
        hour_time = hour_dt.time()
        assert (
            hour_time >= pd.to_datetime("06:00:00").time()
            and hour_time <= pd.to_datetime("19:00:00").time()
        ), f"d1GreenTestGetPeakHours | Timestamp is not within gym hours: {hour}"


@pytest.mark.d1_green2
def test_d1_green2_get_peak_hours():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    date = "2025-04-22"
    start_time = "2025-04-22T06:00:00.000Z"
    end_time = "2025-04-22T19:00:00.000Z"
    peak = True
    hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    assert hours is not None, f"d2GreenTestGetPeakHours | Response is None: {hours}"
    assert len(hours) >= 0, (
        f"d2GreenTestGetPeakHours | Response length is negative: {hours}"
    )

    for hour in hours:
        # Convert hour to datetime for comparison
        hour_dt = pd.to_datetime(hour)
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        assert hour_dt >= start_dt, (
            f"d2GreenTestGetPeakHours | Timestamp is not after start time: {hour}"
        )
        assert hour_dt <= end_dt, (
            f"d2GreenTestGetPeakHours | Timestamp is not before end time: {hour}"
        )
        # Check if hour is between 6am and 7pm
        hour_time = hour_dt.time()
        assert (
            hour_time >= pd.to_datetime("06:00:00").time()
            and hour_time <= pd.to_datetime("19:00:00").time()
        ), f"d2GreenTestGetPeakHours | Timestamp is not within gym hours: {hour}"


@pytest.mark.d1_blue
def test_d1_blue_get_peak_hours():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    date = "2025-04-22"
    start_time = "2025-04-22T06:00:00.000Z"
    end_time = "2025-04-22T19:00:00.000Z"
    peak = True
    hours = peakHoursHelper(thing_id, date, start_time, end_time, peak=peak)
    assert hours is not None, f"d1BlueTestGetPeakHours | Response is None: {hours}"
    assert len(hours) >= 0, (
        f"d1BlueTestGetPeakHours | Response length is negative: {hours}"
    )

    for hour in hours:
        # Convert hour to datetime for comparison
        hour_dt = pd.to_datetime(hour)
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        assert hour_dt >= start_dt, (
            f"d1BlueTestGetPeakHours | Timestamp is not after start time: {hour}"
        )
        assert hour_dt <= end_dt, (
            f"d1BlueTestGetPeakHours | Timestamp is not before end time: {hour}"
        )
        # Check if hour is between 6am and 7pm
        hour_time = hour_dt.time()
        assert (
            hour_time >= pd.to_datetime("06:00:00").time()
            and hour_time <= pd.to_datetime("19:00:00").time()
        ), f"d1BlueTestGetPeakHours | Timestamp is not within gym hours: {hour}"


@pytest.mark.d1_green
def test_d1_green_get_lat():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    lat = getLastLat(thing_id)
    assert lat is not None, f"d1GreenTestGetLat | Response is None: {lat}"
    assert abs(lat) > 0


@pytest.mark.d1_green2
def test_d1_green2_get_lat():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    lat = getLastLat(thing_id)
    assert lat is not None, f"d2GreenTestGetLat | Response is None: {lat}"
    assert abs(lat) > 0


@pytest.mark.d1_blue
def test_d1_blue_get_lat():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    lat = getLastLat(thing_id)
    assert lat is not None, f"d1BlueTestGetLat | Response is None: {lat}"
    assert abs(lat) > 0


@pytest.mark.unknown
def test_unknown_get_lat():
    thing_id = "unknown"
    lat = getLastLat(thing_id)
    assert lat is None, f"UnknownTestGetLat | Response is not None: {lat}"


@pytest.mark.d1_blue
def test_d1_blue_get_long():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    long = getLastLong(thing_id)
    assert long is not None, f"d1BlueTestGetLong | Response is None: {long}"
    assert abs(long) > 0


@pytest.mark.d1_green2
def test_d1_green2_get_long():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    long = getLastLong(thing_id)
    assert long is not None, f"d2GreenTestGetLong | Response is None: {long}"
    assert abs(long) > 0


@pytest.mark.d1_green
def test_d1_green_get_long():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    long = getLastLong(thing_id)
    assert long is not None, f"d1GreenTestGetLong | Response is None: {long}"
    assert abs(long) > 0


@pytest.mark.unknown
def test_unknown_get_long():
    thing_id = "unknown"
    long = getLastLong(thing_id)
    assert long is None, f"UnknownTestGetLong | Response is not None: {long}"


@pytest.mark.d1_green
def test_d1_green_get_last_used_time():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    last_used_time = getLastUsedTimeHelper(thing_id)
    assert last_used_time is not None, (
        f"d1GreenTestGetLastUsedTime | Response is None: {last_used_time}"
    )


@pytest.mark.d1_green2
def test_d1_green2_get_last_used_time():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    last_used_time = getLastUsedTimeHelper(thing_id)
    assert last_used_time is not None, (
        f"d2GreenTestGetLastUsedTime | Response is None: {last_used_time}"
    )


@pytest.mark.d1_blue
def test_d1_blue_get_last_used_time():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    last_used_time = getLastUsedTimeHelper(thing_id)
    assert last_used_time is not None, (
        f"d1BlueTestGetLastUsedTime | Response is None: {last_used_time}"
    )


@pytest.mark.unknown
def test_unknown_get_last_used_time():
    thing_id = "unknown"
    last_used_time = getLastUsedTimeHelper(thing_id)
    assert last_used_time is None, (
        f"UnknownTestGetLastUsedTime | Response is not None: {last_used_time}"
    )


@pytest.mark.unknown
def test_add_time_step():
    try:
        addTimeStepUtil()
        assert True
    except Exception as e:
        print(f"addTimeStepTest | Error: {e}")
        assert False, f"addTimeStepTest | Error: {e}"


@pytest.mark.d1_green
def test_d1_green_get_total_usage():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    total_usage = getTotalUsageUtil(thing_id)
    assert total_usage is not None, (
        f"d1GreenTestGetTotalUsage | Response is None: {total_usage}"
    )
    assert total_usage > 0


@pytest.mark.d1_green2
def test_d1_green2_get_total_usage():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    total_usage = getTotalUsageUtil(thing_id)
    assert total_usage is not None, (
        f"d2GreenTestGetTotalUsage | Response is None: {total_usage}"
    )
    assert total_usage > 0


@pytest.mark.d1_blue
def test_d1_blue_get_total_usage():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    total_usage = getTotalUsageUtil(thing_id)
    assert total_usage is not None, (
        f"d1BlueTestGetTotalUsage | Response is None: {total_usage}"
    )
    assert total_usage > 0, (
        f"d1BlueTestGetTotalUsage | Response is not 0: {total_usage}"
    )


@pytest.mark.d1_green
def test_d1_green_get_daily_usage():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    date = "2025-04-22"
    daily_usage = getDailyUsageUtil(thing_id, date)
    assert daily_usage is not None, (
        f"d1GreenTestGetDailyUsage | Response is None: {daily_usage}"
    )


@pytest.mark.d1_green2
def test_d1_green2_get_daily_usage():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    date = "2025-04-22"
    daily_usage = getDailyUsageUtil(thing_id, date)
    assert daily_usage is not None, (
        f"d2GreenTestGetDailyUsage | Response is None: {daily_usage}"
    )


@pytest.mark.d1_blue
def test_d1_blue_get_daily_usage():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    date = "2025-04-22"
    daily_usage = getDailyUsageUtil(thing_id, date)
    assert daily_usage is not None, (
        f"d1BlueTestGetDailyUsage | Response is None: {daily_usage}"
    )


@pytest.mark.unknown
def test_unknown_get_daily_usage():
    thing_id = "unknown"
    date = "2025-04-22"
    daily_usage = getDailyUsageUtil(thing_id, date)
    assert daily_usage == 0, (
        f"UnknownTestGetDailyUsage | Response is not 0: {daily_usage}"
    )


@pytest.mark.d1_green
def test_d1_green_get_daily_percentages():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    daily_percentages = getDailyPercentagesUtil(thing_id)
    assert daily_percentages is not None, (
        f"d1GreenTestGetDailyPercentages | Response is None: {daily_percentages}"
    )


@pytest.mark.d1_green2
def test_d1_green2_get_daily_percentages():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    daily_percentages = getDailyPercentagesUtil(thing_id)
    assert daily_percentages is not None, (
        f"d2GreenTestGetDailyPercentages | Response is None: {daily_percentages}"
    )
    assert len(daily_percentages) <= 7, (
        f"d2GreenTestGetDailyPercentages | Response is not 7: {daily_percentages}"
    )


@pytest.mark.d1_blue
def test_d1_blue_get_daily_percentages():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    daily_percentages = getDailyPercentagesUtil(thing_id)
    assert daily_percentages is not None, (
        f"d1BlueTestGetDailyPercentages | Response is None: {daily_percentages}"
    )
    assert len(daily_percentages) <= 7, (
        f"d1BlueTestGetDailyPercentages | Response is not 7: {daily_percentages}"
    )


@pytest.mark.d1_green
def test_d1_green_get_hourly_percentages():
    thing_id = "6ad4d9f7-8444-4595-bf0b-5fb62c36430c"
    hourly_percentages = getHourlyPercentagesUtil(thing_id)
    assert hourly_percentages is not None, (
        f"d1GreenTestGetHourlyPercentages | Response is None: {hourly_percentages}"
    )
    assert len(hourly_percentages) <= 24, (
        f"d1GreenTestGetHourlyPercentages | Response is not 24: {hourly_percentages}"
    )


@pytest.mark.d1_green2
def test_d1_green2_get_hourly_percentages():
    thing_id = "c7996422-9462-4fa7-8d02-bfe8c7aba7e4"
    hourly_percentages = getHourlyPercentagesUtil(thing_id)
    assert hourly_percentages is not None, (
        f"d2GreenTestGetHourlyPercentages | Response is None: {hourly_percentages}"
    )
    assert len(hourly_percentages) <= 24, (
        f"d2GreenTestGetHourlyPercentages | Response is not 24: {hourly_percentages}"
    )


@pytest.mark.d1_blue
def test_d1_blue_get_hourly_percentages():
    thing_id = "0a73bf83-27de-4d93-b2a0-f23cbe2ba2a8"
    hourly_percentages = getHourlyPercentagesUtil(thing_id)
    assert hourly_percentages is not None, (
        f"d1BlueTestGetHourlyPercentages | Response is None: {hourly_percentages}"
    )
    assert len(hourly_percentages) <= 24, (
        f"d1BlueTestGetHourlyPercentages | Response is not 24: {hourly_percentages}"
    )


@pytest.mark.unknown
def test_unknown_get_hourly_percentages():
    thing_id = "unknown"
    hourly_percentages = getHourlyPercentagesUtil(thing_id)
    assert hourly_percentages == [], (
        f"UnknownTestGetHourlyPercentages | Response is not empty: {hourly_percentages}"
    )
