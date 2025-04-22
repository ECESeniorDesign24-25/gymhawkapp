export interface Machine {
    machine: string;
    thing_id: string;
    state: string | Promise<string>;
    device_status: string;
    lat: number | null;
    lng: number | null;
    usagePercentage?: number; 
    last_used_time?: string;
    machine_type?: string;
    floor?: string | number;
    subscribed: boolean;
}