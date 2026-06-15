import App from "../../src/App";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewsPage({ searchParams }: PageProps) {
  return <App view={{ kind: "reviews" }} searchParams={await searchParams} />;
}
