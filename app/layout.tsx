import "@/styles/globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SoPra Group 24",
  description: "sopra-fs26-template-client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: "#d4af37",
              colorText: "#f5e6d3",
              colorBgBase: "#1a0a0f",
              colorBgContainer: "#2d1319",
              colorBorder: "#4a1f2b",
              colorLink: "#c9a869",
              borderRadius: 8,
              fontSize: 16,
              fontFamily: "Outfit, sans-serif",
            },
            components: {
              Button: {
                colorPrimary: "#d4af37",
                colorTextLightSolid: "#1a0a0f",
                controlHeight: 38,
                primaryShadow: "none",
              },
              Input: {
                colorBorder: "#4a1f2b",
                colorTextPlaceholder: "#c9a869",
              },
              Form: {
                labelColor: "#f5e6d3",
              },
              Card: {
                colorBgContainer: "#2d1319",
                colorBorderSecondary: "#4a1f2b",
                headerFontSize: 24,
              },
            },
          }}
        >
          <AntdRegistry>
            <AntdApp>{children}</AntdApp>
          </AntdRegistry>
        </ConfigProvider>
      </body>
    </html>
  );
}
