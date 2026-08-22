import os from "node:os";

export type SystemHealthMetrics = {
  capturedAt: string;
  hostname: string;
  platform: string;
  cpuCount: number;
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  processMemory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    heapUsedPercent: number;
  };
  uptimeSeconds: number;
  loadAverage: {
    oneMinute: number;
    fiveMinutes: number;
    fifteenMinutes: number;
  };
};

export function getSystemHealthMetrics(): SystemHealthMetrics {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  const processMemory = process.memoryUsage();
  const heapUsedPercent =
    processMemory.heapTotal > 0
      ? (processMemory.heapUsed / processMemory.heapTotal) * 100
      : 0;

  const [oneMinute, fiveMinutes, fifteenMinutes] = os.loadavg();

  return {
    capturedAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpuCount: os.cpus().length,
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
    },
    processMemory: {
      rssBytes: processMemory.rss,
      heapTotalBytes: processMemory.heapTotal,
      heapUsedBytes: processMemory.heapUsed,
      externalBytes: processMemory.external,
      heapUsedPercent,
    },
    uptimeSeconds: os.uptime(),
    loadAverage: {
      oneMinute,
      fiveMinutes,
      fifteenMinutes,
    },
  };
}
