import { redirect } from "next/navigation";
import App from "../../../src/App";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function CaseDetailPage({ params }: PageProps) {
  const { caseId } = await params;
  const numericCaseId = Number(caseId);

  if (!Number.isFinite(numericCaseId)) {
    redirect("/cases");
  }

  return <App view={{ kind: "case-detail", caseId: numericCaseId }} searchParams={{}} />;
}
