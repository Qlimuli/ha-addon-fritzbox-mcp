/**
 * Extra TR-064 helpers mixed into TR064Client via composition in index/server.
 * Kept separate for maintainability; methods mirror AVM public TR-064 docs.
 */
import type { TR064Client } from "./tr064.js";
import type {
  LanConfig,
  LanStats,
  DslInfo,
  UpdateInfo,
  WanAccessInfo,
  NightControlInfo,
  BoxTimeInfo,
  NetworkDevice,
} from "../types/tr064.js";
import { FritzInvalidParameterError } from "../types/errors.js";

/** Runtime extension: attach methods onto an existing TR064Client instance. */
export function extendTr064(client: TR064Client): TR064Client & Tr064Extra {
  const extra = new Tr064ExtraImpl(client);
  return Object.assign(client, {
    reboot: extra.reboot.bind(extra),
    getLanConfig: extra.getLanConfig.bind(extra),
    getLanStats: extra.getLanStats.bind(extra),
    getDslInfo: extra.getDslInfo.bind(extra),
    getUpdateInfo: extra.getUpdateInfo.bind(extra),
    checkUpdate: extra.checkUpdate.bind(extra),
    getWanAccessByIp: extra.getWanAccessByIp.bind(extra),
    setWanAccessByIp: extra.setWanAccessByIp.bind(extra),
    getHostByIp: extra.getHostByIp.bind(extra),
    getHostByMac: extra.getHostByMac.bind(extra),
    setHostFriendlyName: extra.setHostFriendlyName.bind(extra),
    getWlanNightControl: extra.getWlanNightControl.bind(extra),
    setWlanGlobalEnable: extra.setWlanGlobalEnable.bind(extra),
    startWps: extra.startWps.bind(extra),
    getBoxTime: extra.getBoxTime.bind(extra),
    getDiagnosticsSnapshot: extra.getDiagnosticsSnapshot.bind(extra),
  }) as TR064Client & Tr064Extra;
}

export interface Tr064Extra {
  reboot(): Promise<{ message: string }>;
  getLanConfig(): Promise<LanConfig>;
  getLanStats(): Promise<LanStats>;
  getDslInfo(): Promise<DslInfo>;
  getUpdateInfo(): Promise<UpdateInfo>;
  checkUpdate(): Promise<UpdateInfo>;
  getWanAccessByIp(ip: string): Promise<WanAccessInfo>;
  setWanAccessByIp(ip: string, disallow: boolean): Promise<WanAccessInfo>;
  getHostByIp(ip: string): Promise<NetworkDevice>;
  getHostByMac(mac: string): Promise<NetworkDevice>;
  setHostFriendlyName(mac: string, name: string): Promise<{ mac: string; name: string }>;
  getWlanNightControl(instance?: number): Promise<NightControlInfo[]>;
  setWlanGlobalEnable(enable: boolean): Promise<{ enabled: boolean }>;
  startWps(instance?: number): Promise<{ status: string; instance: number }>;
  getBoxTime(): Promise<BoxTimeInfo>;
  getDiagnosticsSnapshot(): Promise<Record<string, unknown>>;
}

class Tr064ExtraImpl {
  constructor(private readonly c: any) {}

  private soap(
    service: string,
    action: string,
    path: string,
    args?: Record<string, string>
  ) {
    return this.c.soapCall(service, action, path, args);
  }

  async reboot(): Promise<{ message: string }> {
    await this.soap("DeviceConfig:1", "Reboot", "/upnp/control/deviceconfig");
    return { message: "Reboot initiated" };
  }

  async getLanConfig(): Promise<LanConfig> {
    const r = await this.soap(
      "LANHostConfigManagement:1",
      "GetInfo",
      "/upnp/control/lanhostconfigmgm"
    );
    return {
      dhcpServerConfigurable:
        r.NewDHCPServerConfigurable === "1" || r.NewDHCPServerConfigurable === 1,
      dhcpRelay: r.NewDHCPRelay === "1" || r.NewDHCPRelay === 1,
      minAddress: String(r.NewMinAddress ?? ""),
      maxAddress: String(r.NewMaxAddress ?? ""),
      reservedAddresses: String(r.NewReservedAddresses ?? ""),
      dhcpServerEnable:
        r.NewDHCPServerEnable === "1" || r.NewDHCPServerEnable === 1,
      dnsServers: String(r.NewDNSServers ?? ""),
      domainName: String(r.NewDomainName ?? ""),
      ipRouters: String(r.NewIPRouters ?? ""),
      subnetMask: String(r.NewSubnetMask ?? ""),
    };
  }

  async getLanStats(): Promise<LanStats> {
    const r = await this.soap(
      "LANEthernetInterfaceConfig:1",
      "GetStatistics",
      "/upnp/control/lanethernetifcfg"
    );
    return {
      bytesSent: Number(r.NewBytesSent ?? 0),
      bytesReceived: Number(r.NewBytesReceived ?? 0),
      packetsSent: Number(r.NewPacketsSent ?? 0),
      packetsReceived: Number(r.NewPacketsReceived ?? 0),
    };
  }

  async getDslInfo(): Promise<DslInfo> {
    let basic: any = {};
    let extra: any = {};
    try {
      basic = await this.soap(
        "WANDSLInterfaceConfig:1",
        "GetInfo",
        "/upnp/control/wandslifconfig1"
      );
    } catch {
      /* cable/fiber boxes have no DSL */
    }
    try {
      extra = await this.soap(
        "WANDSLInterfaceConfig:1",
        "X_AVM-DE_GetDSLInfo",
        "/upnp/control/wandslifconfig1"
      );
    } catch {
      /* optional */
    }

    const extraOut: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(extra)) {
      if (k.startsWith("New") && v !== undefined && v !== null && v !== "") {
        extraOut[k.replace(/^New/, "")] = v as string;
      }
    }

    return {
      enable: basic.NewEnable === "1" || basic.NewEnable === 1,
      status: String(basic.NewStatus ?? ""),
      dataPath: String(basic.NewDataPath ?? ""),
      upstreamCurrRate: Number(basic.NewUpstreamCurrRate ?? 0),
      downstreamCurrRate: Number(basic.NewDownstreamCurrRate ?? 0),
      upstreamMaxRate: Number(basic.NewUpstreamMaxRate ?? 0),
      downstreamMaxRate: Number(basic.NewDownstreamMaxRate ?? 0),
      upstreamNoiseMargin: Number(basic.NewUpstreamNoiseMargin ?? 0),
      downstreamNoiseMargin: Number(basic.NewDownstreamNoiseMargin ?? 0),
      upstreamAttenuation: Number(basic.NewUpstreamAttenuation ?? 0),
      downstreamAttenuation: Number(basic.NewDownstreamAttenuation ?? 0),
      extra: Object.keys(extraOut).length ? extraOut : undefined,
    };
  }

  async getUpdateInfo(): Promise<UpdateInfo> {
    const [ui, avm] = await Promise.all([
      this.soap("UserInterface:1", "GetInfo", "/upnp/control/userif").catch(
        () => ({})
      ),
      this.soap(
        "UserInterface:1",
        "X_AVM-DE_GetInfo",
        "/upnp/control/userif"
      ).catch(() => ({})),
    ]);
    return {
      upgradeAvailable:
        ui.NewUpgradeAvailable === "1" || ui.NewUpgradeAvailable === 1,
      updateState: String(ui.NewX_AVM_DE_UpdateState ?? ""),
      currentFwVersion: String(avm.NewX_AVM_DE_CurrentFwVersion ?? ""),
      lastFwVersion: String(avm.NewX_AVM_DE_LastFwVersion ?? ""),
      autoUpdateMode: String(avm.NewX_AVM_DE_AutoUpdateMode ?? ""),
      passwordRequired:
        ui.NewPasswordRequired === "1" || ui.NewPasswordRequired === 1,
    };
  }

  async checkUpdate(): Promise<UpdateInfo> {
    await this.soap(
      "UserInterface:1",
      "X_AVM-DE_CheckUpdate",
      "/upnp/control/userif"
    ).catch(() => undefined);
    return this.getUpdateInfo();
  }

  async getWanAccessByIp(ip: string): Promise<WanAccessInfo> {
    this.assertIp(ip);
    const r = await this.soap(
      "X_AVM-DE_HostFilter:1",
      "GetWANAccessByIP",
      "/upnp/control/x_hostfilter",
      { NewIPv4Address: ip }
    );
    const disallow =
      r.NewDisallow === "1" ||
      r.NewDisallow === 1 ||
      r.NewDisallow === true;
    return {
      ip,
      allowed: !disallow,
      raw: Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, String(v)])
      ),
    };
  }

  async setWanAccessByIp(ip: string, disallow: boolean): Promise<WanAccessInfo> {
    this.assertIp(ip);
    await this.soap(
      "X_AVM-DE_HostFilter:1",
      "DisallowWANAccessByIP",
      "/upnp/control/x_hostfilter",
      {
        NewIPv4Address: ip,
        NewDisallow: disallow ? "1" : "0",
      }
    );
    return this.getWanAccessByIp(ip);
  }

  async getHostByIp(ip: string): Promise<NetworkDevice> {
    this.assertIp(ip);
    const r = await this.soap(
      "Hosts:1",
      "X_AVM-DE_GetSpecificHostEntryByIP",
      "/upnp/control/hosts",
      { NewIPAddress: ip }
    ).catch(() =>
      this.soap("Hosts:1", "GetSpecificHostEntry", "/upnp/control/hosts", {
        NewMACAddress: "",
      })
    );
    return this.mapHost(r, ip);
  }

  async getHostByMac(mac: string): Promise<NetworkDevice> {
    const normalized = this.normMac(mac);
    const r = await this.soap(
      "Hosts:1",
      "GetSpecificHostEntry",
      "/upnp/control/hosts",
      { NewMACAddress: normalized }
    );
    return this.mapHost(r);
  }

  async setHostFriendlyName(
    mac: string,
    name: string
  ): Promise<{ mac: string; name: string }> {
    const normalized = this.normMac(mac);
    if (!name || name.length > 64) {
      throw new FritzInvalidParameterError("Friendly name must be 1–64 chars");
    }
    await this.soap(
      "Hosts:1",
      "X_AVM-DE_SetHostNameByMACAddress",
      "/upnp/control/hosts",
      { NewMACAddress: normalized, NewHostName: name }
    ).catch(async () => {
      await this.soap(
        "Hosts:1",
        "X_AVM-DE_SetFriendlyNameByMAC",
        "/upnp/control/hosts",
        { NewMACAddress: normalized, NewFriendlyName: name }
      );
    });
    return { mac: normalized, name };
  }

  async getWlanNightControl(instance = 0): Promise<NightControlInfo[]> {
    const instances = instance ? [instance] : [1, 2, 3];
    const out: NightControlInfo[] = [];
    for (const inst of instances) {
      try {
        const r = await this.soap(
          `WLANConfiguration:${inst}`,
          "X_AVM-DE_GetNightControl",
          `/upnp/control/wlanconfig${inst}`
        );
        out.push({
          instance: inst,
          nightControl: String(r.NewNightControl ?? ""),
          noForcedOff:
            r.NewNightTimeControlNoForcedOff === "1" ||
            r.NewNightTimeControlNoForcedOff === 1,
        });
      } catch {
        /* skip */
      }
    }
    return out;
  }

  async setWlanGlobalEnable(enable: boolean): Promise<{ enabled: boolean }> {
    await this.soap(
      "WLANConfiguration:1",
      "X_AVM-DE_SetWLANGlobalEnable",
      "/upnp/control/wlanconfig1",
      { NewX_AVM_DE_WLANGlobalEnable: enable ? "1" : "0" }
    );
    return { enabled: enable };
  }

  async startWps(
    instance = 1
  ): Promise<{ status: string; instance: number }> {
    const r = await this.soap(
      `WLANConfiguration:${instance}`,
      "X_AVM-DE_SetWPSConfig",
      `/upnp/control/wlanconfig${instance}`,
      {
        NewX_AVM_DE_WPSMode: "pbc",
        NewX_AVM_DE_WPSClientPIN: "",
      }
    );
    return {
      instance,
      status: String(r.NewX_AVM_DE_WPSStatus ?? "started"),
    };
  }

  async getBoxTime(): Promise<BoxTimeInfo> {
    const r = await this.soap("Time:1", "GetInfo", "/upnp/control/time");
    return {
      ntpServer1: String(r.NewNTPServer1 ?? ""),
      ntpServer2: String(r.NewNTPServer2 ?? ""),
      currentLocalTime: String(r.NewCurrentLocalTime ?? ""),
      localTimeZone: String(r.NewLocalTimeZone ?? ""),
      localTimeZoneName: String(r.NewLocalTimeZoneName ?? ""),
      daylightSavingsUsed:
        r.NewDaylightSavingsUsed === "1" || r.NewDaylightSavingsUsed === 1,
    };
  }

  async getDiagnosticsSnapshot(): Promise<Record<string, unknown>> {
    const [
      system,
      wan,
      bandwidth,
      wlan,
      clients,
      log,
      mesh,
      dsl,
      update,
    ] = await Promise.all([
      this.c.getSystemInfo().catch((e: Error) => ({ error: e.message })),
      this.c.getWanStatus().catch((e: Error) => ({ error: e.message })),
      this.c.getBandwidthStats().catch((e: Error) => ({ error: e.message })),
      this.c.listWlanConfigs().catch((e: Error) => ({ error: e.message })),
      this.c.listAssociatedDevices().catch((e: Error) => ({ error: e.message })),
      this.c.getDeviceLog(50).catch((e: Error) => ({ error: e.message })),
      this.c.getMeshTopology().catch((e: Error) => ({ error: e.message })),
      this.getDslInfo().catch((e: Error) => ({ error: e.message })),
      this.getUpdateInfo().catch((e: Error) => ({ error: e.message })),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      system,
      wan,
      bandwidth,
      wlan,
      wlanClients: clients,
      mesh,
      dsl,
      update,
      log,
      hints: {
        dfs:
          Array.isArray(wlan) &&
          wlan.some((w: any) => w.likelyDfsChannel),
        autoChannel:
          Array.isArray(wlan) &&
          wlan.some((w: any) => w.autoChannelEnabled),
        weakClients:
          Array.isArray(clients) &&
          clients.filter((c: any) => c.signalStrength > 0 && c.signalStrength < 40)
            .length,
      },
    };
  }

  private mapHost(r: any, fallbackIp = ""): NetworkDevice {
    return {
      hostname: String(r.NewHostName ?? r.NewX_AVM_DE_FriendlyName ?? ""),
      ipAddress: String(r.NewIPAddress ?? fallbackIp),
      macAddress: String(r.NewMACAddress ?? ""),
      active: r.NewActive === "1" || r.NewActive === 1,
      interfaceType: String(r.NewInterfaceType ?? "unknown"),
      wanAccess: String(r.NewX_AVM_DE_WANAccess ?? ""),
      guest: r.NewX_AVM_DE_Guest === "1" || r.NewX_AVM_DE_Guest === 1,
      meshable:
        r.NewX_AVM_DE_IsMeshable === "1" || r.NewX_AVM_DE_IsMeshable === 1,
      friendlyName: String(r.NewX_AVM_DE_FriendlyName ?? ""),
    };
  }

  private assertIp(ip: string): void {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      throw new FritzInvalidParameterError(`Invalid IPv4 address: ${ip}`);
    }
  }

  private normMac(mac: string): string {
    const normalized = mac.trim().toUpperCase().replace(/-/g, ":");
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalized)) {
      throw new FritzInvalidParameterError(`Invalid MAC address: ${mac}`);
    }
    return normalized;
  }
}
