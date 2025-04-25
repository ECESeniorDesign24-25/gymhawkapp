export enum Status {
    OFFLINE = "OFFLINE",
    ONLINE = "ONLINE",
    UNKNOWN = "UNKNOWN"
}

export enum StateInt {
    IN_USE = 0,
    AVAILABLE = 1
}

export enum StateString {
    IN_USE = "on",
    AVAILABLE = "off"
}

export enum StateColor {
    IN_USE = "rgba(139, 0, 0, 0.75)",
    AVAILABLE = "rgba(0, 100, 0, 0.75)",
    UNKNOWN = "rgba(128, 128, 128, 0.75)",
    OFFLINE = "rgba(128, 128, 128, 0.75)"
}

export function stateStrToEnum(str: string | undefined): StateInt {
    if (str === "on") {
        return StateInt.IN_USE;
    } else {
        return StateInt.AVAILABLE;
    }
}

export function statusStrToEnum(str: string | undefined): Status {
    if (str === "OFFLINE") {
        return Status.OFFLINE;
    } else if (str === "ONLINE") {
        return Status.ONLINE;
    } else {
        return Status.UNKNOWN;
    }
}