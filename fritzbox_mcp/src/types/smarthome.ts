export interface SmartHomeDevice {
  ain: string;
  name: string;
  productname: string;
  manufacturer: string;
  present: boolean;
  type: "thermostat" | "switch" | "unknown";
  thermostat?: ThermostatState;
  switch?: SwitchState;
  battery?: {
    level: number;
    low: boolean;
  };
}

export interface ThermostatState {
  currentTemperature: number;
  targetTemperature: number | "ON" | "OFF";
  comfort: number;
  economy: number;
}

export interface SwitchState {
  on: boolean;
  power: number;
  energy: number;
}

export interface DeviceStats {
  ain: string;
  name: string;
  stats: unknown;
}
