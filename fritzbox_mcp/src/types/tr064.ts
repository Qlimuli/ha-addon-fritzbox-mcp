export interface SystemInfo {
  modelName: string;
  firmwareVersion: string;
  serialNumber: string;
  upTime?: number;
}

export interface WanStatus {
  externalIp: string;
  connectionStatus: string;
  uptime: number;
  lastError: string;
}

export interface BandwidthStats {
  totalBytesSent: number;
  totalBytesReceived: number;
  maxBitRateUp: number;
  maxBitRateDown: number;
}

export interface GuestWifiStatus {
  enabled: boolean;
  ssid: string;
  securityMode: string;
}

export interface NetworkDevice {
  hostname: string;
  ipAddress: string;
  macAddress: string;
  active: boolean;
  interfaceType: string;
  /** Mesh / WLAN AP the host is associated with when known */
  accessPoint?: string;
  /** Band or media: 2.4 GHz / 5 GHz / LAN / … */
  connection?: string;
}

export interface WlanChannelInfo {
  instance: number;
  channel: number;
  possibleChannels: number[];
  autoChannelEnabled: boolean;
  frequencyBand: string;
}

export interface WlanInfo {
  instance: number;
  enabled: boolean;
  status: string;
  ssid: string;
  bssid: string;
  channel: number;
  standard: string;
  beaconType: string;
  frequencyBand: string;
  autoChannelEnabled: boolean;
  possibleChannels: number[];
  /** Heuristic: typical DFS range 52–144 on 5 GHz */
  likelyDfsChannel: boolean;
}

export interface AssociatedWlanClient {
  instance: number;
  macAddress: string;
  ipAddress: string;
  authenticated: boolean;
  speedMbps: number;
  signalStrength: number;
  channelWidth: number;
}
