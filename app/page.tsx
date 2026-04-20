"use client";

import { useRouter } from "next/navigation";
import { Button, Typography, theme } from "antd";
import {
  GlobalOutlined, 
  PlayCircleOutlined 
} from "@ant-design/icons";
import styles from "@/styles/page.module.css";

const { Title } = Typography;

export default function Home() {
  const router = useRouter();
  const { token } = theme.useToken(); 

  const sectionStyle = {
  width: "100%",
  height: "400px",
  backgroundImage: "url('/Background.png')",
};

  return (
    <div className={styles.page} style={sectionStyle}>
      <main className={styles.landing}>

        <Typography style={{ textAlign: "center"}}>
          <Title level={1} style={{ color: "black" }}>
            Welcome to UWatch
          </Title>
          <Title level={4} style={{ color: "black" }}>
            The number one app to find your next movie or TV show to watch!
          </Title>
        </Typography>

        <div className={styles.ctas}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push("/login")}
          >
            Start App
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push("/tech")}
          >
            Learn More
          </Button>
        </div>
      </main>

      
    </div>
  );
}