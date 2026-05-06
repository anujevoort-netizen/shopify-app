import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const price = Number(url.searchParams.get("price"));

  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop ?? url.searchParams.get("shop");

  if (!shop) {
    return Response.json(
      { error: "Missing shop", gstRate: 0, gst: 0 },
      { status: 400 },
    );
  }

  const settings = await db.shopSettings.findUnique({
    where: { shop },
  });

  const gstRate = settings?.gstRate || 0;
  const gst = Number(((price * gstRate) / 100).toFixed(2));

  return Response.json({ gstRate, gst });
};
