import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page, Card, Text, TextField, Button } from "@shopify/polaris";
import db from "../db.server";

type ProductEdge = {
  node: {
    id: string;
    title: string;
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const settings = await db.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  const response = await admin.graphql(`
    {
      products(first: 5) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `);

  const data = (await response.json()) as {
    data: {
      products: {
        edges: ProductEdge[];
      };
    };
  };

  return {
    products: data.data.products.edges,
    gstRate: settings?.gstRate ?? 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const gstRate = Number(formData.get("gstRate"));

  if (!Number.isFinite(gstRate) || gstRate < 0) {
    return { ok: false, error: "Enter a valid GST rate." };
  }

  await db.shopSettings.upsert({
    where: { shop: session.shop },
    update: { gstRate },
    create: { shop: session.shop, gstRate },
  });

  return { ok: true, gstRate };
};


export default function Index() {
  const { products, gstRate } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [rate, setRate] = useState(String(gstRate));

  const shopify = useAppBridge();
  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("GST rate saved");
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="Smart GST Dashboard">
      <Card>
        <Text as="h2" variant="headingMd">
          GST Settings
        </Text>
        <fetcher.Form method="post">
          <TextField
            label="GST rate"
            name="gstRate"
            type="number"
            value={rate}
            onChange={setRate}
            suffix="%"
            min={0}
            step={0.01}
            autoComplete="off"
            error={fetcher.data?.ok === false ? fetcher.data.error : undefined}
          />
          <Button submit loading={isSaving}>
            Save GST rate
          </Button>
        </fetcher.Form>
      </Card>
      <Card>
        <Text as="h2" variant="headingMd">
          Products List
        </Text>

        {products.map((item) => (
          <Text key={item.node.id} as="p">
            {item.node.title}
          </Text>
        ))}
      </Card>

    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
