export function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${Math.round(bytesPerSecond / 1024)} KB/s`;
  }
  return `${bytesPerSecond} B/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function formatRelativeTime(timestamp?: number | null): string {
  if (!timestamp) {
    return "未知";
  }

  const nowMillis = Date.now();
  const diffSeconds = Math.max(0, Math.floor((nowMillis - timestamp) / 1000));
  if (diffSeconds < 5) {
    return "刚刚";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} 秒前`;
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)} 分钟前`;
  }
  return `${Math.floor(diffSeconds / 3600)} 小时前`;
}

export function humanizeDirection(direction?: string): string {
  switch (direction?.toLowerCase()) {
    case "outbound":
      return "上行";
    case "inbound":
      return "下行";
    default:
      return "双向";
  }
}

export function humanizeProtocol(protocol?: string): string {
  return protocol?.toUpperCase() ?? "UNKNOWN";
}
