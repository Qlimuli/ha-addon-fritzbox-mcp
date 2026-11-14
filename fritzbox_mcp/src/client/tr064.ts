import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { AuthProvider } from "../auth/auth-provider.js";
import {
  SystemInfo,
  WanStatus,
  BandwidthStats,
  GuestWifiStatus,
  NetworkDevice,
  WlanInfo,
  WlanChannelInfo,
  AssociatedWlanClient,
} from "../types/tr064.js";
import { FritzInvalidParameterError } from "../types/errors.js";

const WLAN_INSTANCES = [1, 2, 3] as const;

function isLikelyDfs(channel: number, band: string): boolean {
  if (!/5/i.test(band) && channel < 50) return false;
  return channel >= 52 && channel <= 144;
}

export class TR064Client {
  private readonly http: AxiosInstance;
  private readonly parser = new XMLParser({ parseTagValue: false });
  private readonly host: string;
  private readonly auth: AuthProvider;

  constructor(host: string, auth: AuthProvider) {
    this.host = host;
    this.auth = auth;
    this.http = axios.create({
      baseURL: `http://${host}:49000`,
      timeout: 15_000,
    });
  }

  /** Public SOAP entry for extensions (HostFilter, DSL, …). */
  async soapCall(
    service: string,
    action: string,
    controlUrl: string,
    args?: Record<string, string>
  ): Promise<any> {
    const envelope = this.buildSoapEnvelope(service, action, args);
    const headers = {
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPAction: `"urn:dslforum-org:service:${service}#${action}"`,
    };

    let wwwAuthenticate: string;
    try {
      const { data } = await this.http.post(controlUrl, envelope, { headers });
      return this.parseSoapResponse(data, service, action);
    } catch (error: any) {
      if (error.response?.status !== 401) throw error;
      wwwAuthenticate = error.response.headers["www-authenticate"] ?? "";
      if (!wwwAuthenticate.startsWith("Digest")) throw error;
    }

    const authHeader = this.computeDigestAuth(wwwAuthenticate, "POST", controlUrl);
    const { data } = await this.http.post(controlUrl, envelope, {
      headers: { ...headers, Authorization: authHeader },
    });
    return this.parseSoapResponse(data, service, action);
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const result = await this.soapCall(
      "DeviceInfo:1",
      "GetInfo",
      "/upnp/control/deviceinfo"
    );
    return {
      modelName: result.NewModelName,
      firmwareVersion: result.NewSoftwareVersion,
      serialNumber: result.NewSerialNumber,
      upTime: result.NewUpTime !== undefined ? Number(result.NewUpTime) : undefined,
    };
  }

  async getWanStatus(): Promise<WanStatus> {
    let ipResult: any;
    let statusResult: any;
    try {
      [ipResult, statusResult] = await Promise.all([
        this.soapCall("WANPPPConnection:1", "GetExternalIPAddress", "/upnp/control/wanpppconn1"),
        this.soapCall("WANPPPConnection:1", "GetStatusInfo", "/upnp/control/wanpppconn1"),
      ]);
    } catch {
      [ipResult, statusResult] = await Promise.all([
        this.soapCall("WANIPConnection:1", "GetExternalIPAddress", "/upnp/control/wanipconnection1"),
        this.soapCall("WANIPConnection:1", "GetStatusInfo", "/upnp/control/wanipconnection1"),
      ]);
    }
    return {
      externalIp: ipResult.NewExternalIPAddress,
      connectionStatus: statusResult.NewConnectionStatus,
      uptime: Number(statusResult.NewUptime),
      lastError: statusResult.NewLastConnectionError,
    };
  }

  async getBandwidthStats(): Promise<BandwidthStats> {
    const [received, sent, rates] = await Promise.all([
      this.soapCall("WANCommonInterfaceConfig:1", "GetTotalBytesReceived", "/upnp/control/wancommonifconfig1"),
      this.soapCall("WANCommonInterfaceConfig:1", "GetTotalBytesSent", "/upnp/control/wancommonifconfig1"),
      this.soapCall("WANCommonInterfaceConfig:1", "GetCommonLinkProperties", "/upnp/control/wancommonifconfig1"),
    ]);
    return {
      totalBytesReceived: Number(received.NewTotalBytesReceived),
      totalBytesSent: Number(sent.NewTotalBytesSent),
      maxBitRateUp: Number(rates.NewLayer1UpstreamMaxBitRate),
      maxBitRateDown: Number(rates.NewLayer1DownstreamMaxBitRate),
    };
  }

  async toggleGuestWifi(enable: boolean): Promise<GuestWifiStatus> {
    const instance = await this.resolveGuestInstance();
    await this.soapCall(`WLANConfiguration:${instance}`, "SetEnable", `/upnp/control/wlanconfig${instance}`, {
      NewEnable: enable ? "1" : "0",
    });
    const info = await this.soapCall(`WLANConfiguration:${instance}`, "GetInfo", `/upnp/control/wlanconfig${instance}`);
    return {
      enabled: info.NewEnable === "1" || info.NewEnable === 1,
      ssid: info.NewSSID,
      securityMode: info.NewBeaconType,
    };
  }

  async getDeviceLog(count = 20): Promise<string[]> {
    const attempts = [
      { service: "DeviceInfo:1", action: "GetDeviceLog", path: "/upnp/control/deviceinfo", field: "NewDeviceLog" },
      { service: "DeviceInfo:1", action: "X_AVM-DE_GetDeviceLog", path: "/upnp/control/deviceinfo", field: "NewDeviceLog" },
    ];
    let lastError: unknown;
    for (const a of attempts) {
      try {
        const result = await this.soapCall(a.service, a.action, a.path);
        const raw = result[a.field] ?? result.NewDeviceLog ?? "";
        if (typeof raw === "string" && raw.length > 0) {
          return String(raw).split("\n").filter(Boolean).slice(0, count);
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error("All GetDeviceLog attempts failed");
  }

  async reconnectWan(): Promise<{ message: string }> {
    try {
      await this.soapCall("WANPPPConnection:1", "ForceTermination", "/upnp/control/wanpppconn1");
    } catch {
      await this.soapCall("WANIPConnection:1", "ForceTermination", "/upnp/control/wanipconnection1");
    }
    return { message: "WAN reconnect initiated — new IP will be assigned shortly" };
  }

  async listNetworkDevices(): Promise<NetworkDevice[]> {
    try {
      return await this.listNetworkDevicesViaHostListPath();
    } catch {
      return this.listNetworkDevicesViaSoapEntries();
    }
  }

  private async listNetworkDevicesViaHostListPath(): Promise<NetworkDevice[]> {
    const pathResult = await this.soapCall("Hosts:1", "X_AVM-DE_GetHostListPath", "/upnp/control/hosts");
    const path = String(pathResult.NewX_AVM_DE_HostListPath ?? "");
    if (!path) throw new Error("Empty host list path");
    const { data } = await axios.get(`http://${this.host}:49000${path}`, { timeout: 15_000 });
    const parsed = this.parser.parse(String(data));
    const list = parsed.List ?? parsed.Item ?? parsed;
    let items = list.Item ?? list.item ?? list;
    if (!Array.isArray(items)) items = items ? [items] : [];
    return items.map((entry: any) => ({
      hostname: String(entry.HostName ?? entry.NewHostName ?? ""),
      ipAddress: String(entry.IPAddress ?? entry.NewIPAddress ?? ""),
      macAddress: String(entry.MACAddress ?? entry.NewMACAddress ?? ""),
      active: String(entry.Active ?? entry.NewActive ?? "0") === "1",
      interfaceType: String(entry.InterfaceType ?? entry.NewInterfaceType ?? "unknown"),
    }));
  }

  private async listNetworkDevicesViaSoapEntries(): Promise<NetworkDevice[]> {
    const countResult = await this.soapCall("Hosts:1", "GetHostNumberOfEntries", "/upnp/control/hosts");
    const count = Number(countResult.NewHostNumberOfEntries);
    const devices: NetworkDevice[] = [];
    for (let i = 0; i < count; i++) {
      const entry = await this.soapCall("Hosts:1", "GetGenericHostEntry", "/upnp/control/hosts", {
        NewIndex: String(i),
      });
      devices.push({
        hostname: entry.NewHostName ?? "",
        ipAddress: entry.NewIPAddress ?? "",
        macAddress: entry.NewMACAddress ?? "",
        active: entry.NewActive === "1" || entry.NewActive === 1,
        interfaceType: entry.NewInterfaceType ?? "unknown",
      });
    }
    return devices;
  }

  async getMeshTopology(): Promise<unknown> {
    const pathResult = await this.soapCall("Hosts:1", "X_AVM-DE_GetMeshListPath", "/upnp/control/hosts");
    const path = String(pathResult.NewX_AVM_DE_MeshListPath ?? "");
    if (!path) throw new Error("Empty mesh list path");
    const { data } = await axios.get(`http://${this.host}:49000${path}`, {
      timeout: 20_000,
      responseType: "text",
    });
    try {
      return JSON.parse(String(data));
    } catch {
      return { raw: String(data).slice(0, 50_000) };
    }
  }

  async listWlanConfigs(): Promise<WlanInfo[]> {
    const results: WlanInfo[] = [];
    for (const instance of WLAN_INSTANCES) {
      try {
        results.push(await this.getWlanInfo(instance));
      } catch {
        /* missing instance */
      }
    }
    return results;
  }

  async getWlanInfo(instance: number): Promise<WlanInfo> {
    this.assertWlanInstance(instance);
    const [info, channel, bssid] = await Promise.all([
      this.soapCall(`WLANConfiguration:${instance}`, "GetInfo", `/upnp/control/wlanconfig${instance}`),
      this.soapCall(`WLANConfiguration:${instance}`, "GetChannelInfo", `/upnp/control/wlanconfig${instance}`),
      this.soapCall(`WLANConfiguration:${instance}`, "GetBSSID", `/upnp/control/wlanconfig${instance}`).catch(() => ({
        NewBSSID: "",
      })),
    ]);
    const channelNum = Number(channel.NewChannel ?? info.NewChannel ?? 0);
    const band = String(channel.NewX_AVM_DE_FrequencyBand ?? info.NewX_AVM_DE_FrequencyBand ?? "");
    const possible = String(channel.NewPossibleChannels ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return {
      instance,
      enabled: info.NewEnable === "1" || info.NewEnable === 1,
      status: String(info.NewStatus ?? ""),
      ssid: String(info.NewSSID ?? ""),
      bssid: String(bssid.NewBSSID ?? ""),
      channel: channelNum,
      standard: String(info.NewStandard ?? ""),
      beaconType: String(info.NewBeaconType ?? ""),
      frequencyBand: band,
      autoChannelEnabled:
        channel.NewX_AVM_DE_AutoChannelEnabled === "1" ||
        channel.NewX_AVM_DE_AutoChannelEnabled === 1 ||
        channel.NewX_AVM_DEAuto_ChannelEnabled === "1" ||
        channel.NewX_AVM_DEAuto_ChannelEnabled === 1,
      possibleChannels: possible,
      likelyDfsChannel: isLikelyDfs(channelNum, band),
    };
  }

  async getChannelInfo(instance: number): Promise<WlanChannelInfo> {
    const info = await this.getWlanInfo(instance);
    return {
      instance: info.instance,
      channel: info.channel,
      possibleChannels: info.possibleChannels,
      autoChannelEnabled: info.autoChannelEnabled,
      frequencyBand: info.frequencyBand,
    };
  }

  async setChannel(instance: number, channel: number): Promise<WlanChannelInfo> {
    this.assertWlanInstance(instance);
    if (!Number.isInteger(channel) || channel < 1 || channel > 196) {
      throw new FritzInvalidParameterError(`Invalid channel ${channel}`);
    }
    await this.soapCall(`WLANConfiguration:${instance}`, "SetChannel", `/upnp/control/wlanconfig${instance}`, {
      NewChannel: String(channel),
    });
    return this.getChannelInfo(instance);
  }

  async setWlanEnable(instance: number, enable: boolean): Promise<{ instance: number; enabled: boolean }> {
    this.assertWlanInstance(instance);
    await this.soapCall(`WLANConfiguration:${instance}`, "SetEnable", `/upnp/control/wlanconfig${instance}`, {
      NewEnable: enable ? "1" : "0",
    });
    const info = await this.getWlanInfo(instance);
    return { instance, enabled: info.enabled };
  }

  async listAssociatedDevices(instance?: number): Promise<AssociatedWlanClient[]> {
    const instances = instance ? [instance] : ([...WLAN_INSTANCES] as number[]);
    const clients: AssociatedWlanClient[] = [];
    for (const inst of instances) {
      try {
        const total = await this.soapCall(
          `WLANConfiguration:${inst}`,
          "GetTotalAssociations",
          `/upnp/control/wlanconfig${inst}`
        );
        const n = Number(total.NewTotalAssociations ?? 0);
        for (let i = 0; i < n; i++) {
          try {
            const d = await this.soapCall(
              `WLANConfiguration:${inst}`,
              "GetGenericAssociatedDeviceInfo",
              `/upnp/control/wlanconfig${inst}`,
              { NewAssociatedDeviceIndex: String(i) }
            );
            clients.push({
              instance: inst,
              macAddress: String(d.NewAssociatedDeviceMACAddress ?? ""),
              ipAddress: String(d.NewAssociatedDeviceIPAddress ?? ""),
              authenticated: d.NewAssociatedDeviceAuthState === "1" || d.NewAssociatedDeviceAuthState === 1,
              speedMbps: Number(d.NewX_AVM_DE_Speed ?? 0),
              signalStrength: Number(d.NewX_AVM_DE_SignalStrength ?? 0),
              channelWidth: Number(d.NewX_AVM_DE_ChannelWidth ?? 0),
            });
          } catch {
            /* skip */
          }
        }
      } catch {
        /* missing */
      }
    }
    return clients;
  }

  async wakeOnLan(mac: string): Promise<{ message: string; mac: string }> {
    const normalized = mac.trim().toUpperCase();
    if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/.test(normalized)) {
      throw new FritzInvalidParameterError(`Invalid MAC address: ${mac}`);
    }
    await this.soapCall("Hosts:1", "X_AVM-DE_WakeOnLANByMACAddress", "/upnp/control/hosts", {
      NewMACAddress: normalized.replace(/-/g, ":"),
    });
    return { message: "Wake-on-LAN packet sent", mac: normalized };
  }

  private assertWlanInstance(instance: number): void {
    if (![1, 2, 3, 4].includes(instance)) {
      throw new FritzInvalidParameterError(`WLAN instance must be 1–4. Got: ${instance}`);
    }
  }

  private async resolveGuestInstance(): Promise<number> {
    for (const instance of [3, 2, 4, 1]) {
      try {
        await this.soapCall(`WLANConfiguration:${instance}`, "GetInfo", `/upnp/control/wlanconfig${instance}`);
        if (instance === 3) return 3;
      } catch {
        continue;
      }
    }
    return 3;
  }

  private computeDigestAuth(wwwAuthenticate: string, method: string, uri: string): string {
    const { username, password } = this.auth.getDigestAuth();
    const realm = wwwAuthenticate.match(/realm="([^"]+)"/)?.[1] ?? "";
    const nonce = wwwAuthenticate.match(/nonce="([^"]+)"/)?.[1] ?? "";
    const qop = wwwAuthenticate.match(/qop="([^"]+)"/)?.[1] ?? "auth";
    const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
    const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");
    const response = crypto
      .createHash("md5")
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest("hex");
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  }

  private buildSoapEnvelope(service: string, action: string, args?: Record<string, string>): string {
    const argsXml = args
      ? Object.entries(args)
          .map(([key, value]) => `<${key}>${this.escapeXml(value)}</${key}>`)
          .join("")
      : "";
    return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:dslforum-org:service:${service}">${argsXml}</u:${action}>
  </s:Body>
</s:Envelope>`;
  }

  private parseSoapResponse(xml: string, service: string, action: string): any {
    const parsed = this.parser.parse(xml);
    const body = parsed["s:Envelope"]?.["s:Body"];
    if (!body) throw new Error(`Invalid SOAP response from ${service}#${action}`);
    if (body["s:Fault"]) {
      const fault = body["s:Fault"];
      throw new Error(`SOAP fault from ${service}#${action}: ${fault.faultstring ?? fault.detail ?? "Unknown"}`);
    }
    const responseKey = `u:${action}Response`;
    return body[responseKey] ?? body[Object.keys(body)[0]];
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
