import App from "../../src/App";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CasesPage({ searchParams }: PageProps) {
  return <App view={{ kind: "cases" }} searchParams={await searchParams} />;
}
