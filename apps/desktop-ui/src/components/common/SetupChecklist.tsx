import type { SetupChecklistItemView } from "../../types/appData";

interface SetupChecklistProps {
  items: SetupChecklistItemView[];
}

export default function SetupChecklist({ items }: SetupChecklistProps) {
  return (
    <div className="setup-checklist">
      {items.map((item) => (
        <div className="setup-checklist__item" key={item.id}>
          <div className="setup-checklist__copy">
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </div>
          <span className={`setup-checklist__status is-${item.status}`.trim()}>
            {getStatusLabel(item.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getStatusLabel(status: SetupChecklistItemView["status"]) {
  switch (status) {
    case "ready":
      return "已就绪";
    case "attention":
      return "待处理";
    case "planned":
      return "规划中";
  }
}
