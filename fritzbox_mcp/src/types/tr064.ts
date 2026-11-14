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
  accessPoint?: string;
  connection?: string;
  wanAccess?: string;
  guest?: boolean;
  meshable?: boolean;
  friendlyName?: string;
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

export interface LanConfig {
  dhcpServerConfigurable: boolean;
  dhcpRelay: boolean;
  minAddress: string;
  maxAddress: string;
  reservedAddresses: string;
  dhcpServerEnable: boolean;
  dnsServers: string;
  domainName: string;
  ipRouters: string;
  subnetMask: string;
}

export interface LanStats {
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
}

export interface DslInfo {
  enable: boolean;
  status: string;
  dataPath: string;
  upstreamCurrRate: number;
  downstreamCurrRate: number;
  upstreamMaxRate: number;
  downstreamMaxRate: number;
  upstreamNoiseMargin: number;
  downstreamNoiseMargin: number;
  upstreamAttenuation: number;
  downstreamAttenuation: number;
  extra?: Record<string, string | number | boolean>;
}

export interface UpdateInfo {
  upgradeAvailable: boolean;
  updateState?: string;
  currentFwVersion?: string;
  lastFwVersion?: string;
  autoUpdateMode?: string;
  passwordRequired?: boolean;
}

export interface WanAccessInfo {
  ip: string;
  allowed: boolean;
  raw?: Record<string, string>;
}

export interface NightControlInfo {
  instance: number;
  nightControl: string;
  noForcedOff: boolean;
}

export interface BoxTimeInfo {
  ntpServer1?: string;
  ntpServer2?: string;
  currentLocalTime?: string;
  localTimeZone?: string;
  localTimeZoneName?: string;
  daylightSavingsUsed?: boolean;
}
