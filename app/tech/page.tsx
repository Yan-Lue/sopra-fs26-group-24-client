"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering

import styles from "@/styles/page.module.css";
import { Button, Card, Typography, theme} from "antd";
import {
    ArrowLeftOutlined,
    GlobalOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Title } = Typography;


export default function Tech() {
    const router = useRouter();
    const { token } = theme.useToken(); 
    const [loading, setLoading] = useState(false);
  
  return (
    <div className={styles.page}>

            <Card title="Tech Stack" style={{ gridRow: 2 }}>
                <Button
            type="link"
            className="redirect-link"
            onClick={() => router.push("/")}
            disabled={loading}
            icon={<ArrowLeftOutlined />}
            style={{ padding: 0, marginBottom: 16 }}
          >
            Back to Home
          </Button>
          <Typography >
          <Title level={4} >
            Introdcution:
          </Title>
          <p> This is a brief introduction to our tech stack. </p>
          
        </Typography>
            
            <p><strong>Frontend:</strong> Next.js, React, TypeScript, Ant Design</p>
            <p><strong>Backend:</strong> Java, SpringBoot</p>
            <p><strong>Database:</strong> PostgreSQL</p>
        </Card>
     

        
      <footer className={styles.footer}>
        <Button type="link" icon={<GlobalOutlined />} href="https://nextjs.org" target="_blank">
          Next.js →
        </Button>

        <Button
          type="link"
          shape="circle"
          icon={
            <img 
              src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg" 
              style={{ 
                height: '24px', 
                width: '24px',
                // Used AI for this --> this makes it use our primary color
                filter: `drop-shadow(100px 0 0 ${token.colorPrimary})`,
                transform: 'translateX(-100px)',
              }} 
              alt="GitHub"
            />
          }
          style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          href="https://github.com/Yan-Lue/sopra-fs26-group-24-client"
          target="_blank"
        />
      </footer>
    </div>
  );
};

