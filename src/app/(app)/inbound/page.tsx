import { PageHeader } from "@/components/ui";
import { InboundForm } from "@/components/InboundForm";

export default function InboundPage() {
  return (
    <div>
      <PageHeader
        title="快捷入库"
        description="手动录入款号、颜色、数量、尺码（可空默认均码），一键匹配/新建 SKU 并增加库存。"
      />
      <InboundForm />
    </div>
  );
}
