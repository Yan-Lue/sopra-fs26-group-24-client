"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering

import styles from "@/styles/page.module.css";
import { AppstoreOutlined, ArrowLeftOutlined, GithubOutlined, RocketOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Card, Col, Divider, Row, Space, Tag, Timeline, Typography, theme } from "antd";
import { useRouter } from "next/navigation";

const { Title, Paragraph, Text } = Typography;

const highlights = [
  {
    title: "What is UWatch?",
    text: "A real-time collaborative voting app where friends can join sessions to vote on movies and discover what to watch together.",
    icon: <RocketOutlined />,
  },
  {
    title: "How it works",
    text: "Users create or join sessions with a code, vote on movie options in live sessions, and instantly see their voting results.",
    icon: <TeamOutlined />,
  },
  {
    title: "What does it solve?",
    text: "Solving the classic problem: deciding what movie to watch with friends. Simple, fast, and collaborative decision-making.",
    icon: <AppstoreOutlined />,
  },
];

const stack = [
  {
    title: "Frontend",
    text: "Next.js 15, React 19, TypeScript, Ant Design, WebSockets (STOMP.js, SockJS)",
  },
  {
    title: "Backend",
    text: "Java 17, Spring Boot 4.0, REST API, WebSocket support, MapStruct for data mapping",
  },
  {
    title: "Database",
    text: "PostgreSQL with Spring Data JPA",
  },
  {
    title: "DevOps & CI/CD",
    text: "GitHub Actions, Docker, SonarCloud (code quality), Vercel (frontend), Google App Engine (backend)",
  },
  {
    title: "Testing & Quality",
    text: "JUnit, Jacoco (coverage), SonarQube integration, PR automation",
  },
  {
    title: "Development Tools",
    text: "Deno (linting & formatting), Gradle, TypeScript, ESLint",
  },
];

const features = [
  "Create or join sessions with unique codes",
  "Real-time voting on personalized movie options",
  "Instant results and vote calculations",
  "Session history and past voting data",
  "Fully customizable user profiles and authentication",
  "Fully responsive mobile and desktop UI",
];

const workflowSteps = [
  { children: "User registers or logs in as a guest or authenticated user" },
  { children: "Create a new session or join an existing one" },
  { children: "Set filters and vote on suggestions" },
  { children: "Real-time voting updates for all participants" },
  { children: "View results and save session history" },
];

export default function Tech() {
    const router = useRouter();
    const { token } = theme.useToken(); 
  
  return (
    <div className={styles.page}>
      <Card
        className="overview-card"
        styles={{ body: { padding: 0 } }}
        style={{
          gridRow: 2,
          width: "100%",
          maxWidth: 1200,
          overflow: "hidden",
          borderRadius: 24,
        }}
      >
        <div
          style={{
            padding: "28px 28px 18px",
            background:
              "linear-gradient(135deg, rgba(212,175,55,0.14) 0%, rgba(74,31,43,0.92) 45%, rgba(26,10,15,1) 100%)",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="link"
            onClick={() => router.push("/")}
            icon={<ArrowLeftOutlined />}
            style={{ padding: 0, marginBottom: 18 }}
          >
            Back to Landing Page
          </Button>

          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Tag
              style={{
                width: "fit-content",
                background: "rgba(212,175,55,0.16)",
                color: token.colorWarning,
                border: "none",
                padding: "4px 10px",
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              Software Engineering Lab FS26 - Group 24
            </Tag>

            <Title level={2} style={{ margin: 0 }}>
              UWatch - The Ultimate Movie Decision App for Friends
            </Title>

            <Paragraph style={{ maxWidth: 820, marginBottom: 0, fontSize: 16, opacity: 0.92 }}>
              Never waste time deciding what to watch ever again. UWatch lets groups vote on movies in real-time, 
              with instant results to decide and session histories to relive it all. Simple, collaborative, and built with modern web technologies.
            </Paragraph>
          </Space>
        </div>

        <div style={{ padding: 28 }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
            {highlights.map((item) => (
              <Col xs={24} md={8} key={item.title}>
                <Card
                  style={{
                    height: "100%",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.02)",
                    borderColor: "rgba(212,175,55,0.18)",
                    border: `1px solid rgba(212,175,55,0.18)`
                  }}
                >
                  <Space orientation="vertical" size={10}>
                    <div style={{ fontSize: 28, color: token.colorWarning }}>{item.icon}</div>
                    <Title level={3} style={{ margin: 0 }}>
                      {item.title}
                    </Title>
                    <Text style={{ opacity: 0.85 }}>{item.text}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          <Divider style={{ borderColor: "rgba(255,255,255,0.08)" }} />

          <Row gutter={[32, 32]} style={{ marginBottom: 40 }}>
            <Col xs={24} lg={13}>
              <div style={{ marginBottom: 28 }}>
                <Title level={3} style={{ marginBottom: 20 }}>
                  Core Features
                </Title>
                <Row gutter={[12, 12]}>
                  {features.map((feature) => (
                    <Col xs={24} sm={12} key={feature}>
                      <Card
                        style={{
                          borderRadius: 14,
                          height: "100%",
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid rgba(255,255,255,0.06)`,
                        }}
                        styles={{ body: { padding: 16 } }}
                      >
                        <Text style={{ opacity: 0.9 }}>{feature}</Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>

              <div>
                <Title level={3} style={{ marginBottom: 20 }}>
                  User Flow
                </Title>
                <Timeline
                  items={workflowSteps}
                  style={{
                    padding: 16,
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 16,
                    border: `1px solid rgba(255,255,255,0.06)`,
                  }}
                />
              </div>
            </Col>

            <Col xs={24} lg={11}>
              <Title level={3} style={{ marginBottom: 20 }}>
                Tech Stack
              </Title>
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                {stack.map((item) => (
                  <Card
                    key={item.title}
                    style={{
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid rgba(212,175,55,0.12)`,
                    }}
                    styles={{ body: { padding: 16 } }}
                  >
                    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                      <Text type="secondary" style={{ fontSize: 18, color: token.colorWarning, fontWeight: 500 }}>
                        {item.title}
                      </Text>
                      <Text style={{ fontSize: 14, lineHeight: 1.4 }}>{item.text}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Col>
          </Row>

          <Card
            style={{
              borderRadius: 18,
              background: "linear-gradient(135deg, rgba(212,175,55,0.1), rgba(74,31,43,0.6))",
              border: `1px solid rgba(212,175,55,0.14)`,
              marginBottom: 28,
            }}
            styles={{ body: { padding: 24 } }}
          >
            <Space orientation="vertical" size={12}>
              <Title level={4} style={{ margin: 0, hyphens: "auto" }}>
                Development & Deployment
              </Title>
              <Paragraph style={{ marginBottom: 0, opacity: 0.9 }}>
                Being part of the Software Engineering Lab at the University of Zurich in the Spring Semester 2026, this project was built as a full-stack Spring Boot and Next.js course project with continuous integration via GitHub Actions, 
                automated testing and code quality checks through SonarCloud, and deployed on Google App Engine (backend) and Vercel (frontend). 
                The app uses WebSockets for real-time session updates and REST APIs for core functionality.
              </Paragraph>
            </Space>
          </Card>
        
          <footer className={styles.footer} style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 16 }}>
            <Button
              type="link"
              href="https://github.com/Yan-Lue/sopra-fs26-group-24-client"
              target="_blank"
              icon={<GithubOutlined style={{ color: "white"}}/>}
            >
              GitHub
            </Button>
            <Button type="link" href="https://nextjs.org" target="_blank"
              icon={
                <img 
                  src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg" 
                  style={{ height: '24px', width: '24px', transform: 'translateY(2px)' }} 
                  alt="Next.js" 
                />
              }>
              Next.js
            </Button>
          </footer>
        </div>
      </Card>
    </div>
  );
};

