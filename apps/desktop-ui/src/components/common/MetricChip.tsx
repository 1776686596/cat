interface MetricChipProps {
  label: string;
  value: string;
}

export default function MetricChip({ label, value }: MetricChipProps) {
  return (
    <span className="metric-chip">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </span>
  );
}
