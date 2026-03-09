"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "antd";
import { BookOutlined, CodeOutlined, GlobalOutlined } from "@ant-design/icons";
import styles from "@/styles/page.module.css";

export default function Home() {
  const router = useRouter();
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol>
          <li>
            <code>app/page.tsx</code>{" "}
            is the landing page for your application, currently being displayed.
          </li>
          <li>
            <code>app/login/page.tsx</code> is the login page for users.
          </li>
          <li>
            <code>app/users/page.tsx</code>{" "}
            is the dashboard that shows an overview of all users, fetched from
            the server.
          </li>
          <li>
            <code>app/users/[id]/page.tsx</code>{" "}
            is a slug page that shows info of a particular user. Since each user
            has its own id, each user has its own infopage, dynamically with the
            use of slugs.
          </li>
          <li>
            To test, modify the current page <code>app/page.tsx</code>{" "}
            and save to see your changes instantly.
          </li>
        </ol>

        <div className={styles.ctas}>
          <Button
            type="primary" // as defined in the ConfigProvider in [layout.tsx](./layout.tsx), all primary antd elements are colored #22426b, with buttons #75bd9d as override
            color="red" // if a single/specific antd component needs yet a different color, it can be explicitly overridden in the component as shown here
            variant="solid" // read more about the antd button and its options here: https://ant.design/components/button
            onClick={() =>
              globalThis.open(
                "https://vercel.com/new",
                "_blank",
                "noopener,noreferrer",
              )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Deploy now
          </Button>
          <Button
            type="default"
            variant="solid"
            onClick={() =>
              globalThis.open(
                "https://nextjs.org/docs",
                "_blank",
                "noopener,noreferrer",
              )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </Button>
          <Button
            type="primary"
            variant="solid"
            onClick={() => router.push("/login")}
          >
            Go to login
          </Button>
        </div>
      </main>
      <footer className={styles.footer}>
        <Button
          type="link"
          icon={<BookOutlined />}
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn
        </Button>
        <Button
          type="link"
          icon={<CodeOutlined />}
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Examples
        </Button>
        <Button
          type="link"
          icon={<GlobalOutlined />}
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Go to nextjs.org →
        </Button>
      </footer>
    </div>
  );
}
